import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVixSpot, getVontobelFuturesQuote } from "@/lib/yahoo-finance";
import {
  checkVixEntry,
  checkStdDevAlert,
  checkVixSpike,
  checkTrailingStop,
  type AlertSettings,
  type AlertResult,
} from "@/lib/alert-engine";
import { sendAlertEmail } from "@/lib/resend";
import { getEventsWithin2Hours } from "@/lib/economic-calendar";
import { isWithinTradingHours } from "@/lib/trading-hours";


export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  const testMode = new URL(req.url).searchParams.get("test") === "true";

  if (!testMode && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Skip outside trading hours (07:00–22:30 CET/CEST) — VIX certificates illiquid outside window
  if (!testMode && !isWithinTradingHours()) {
    return NextResponse.json({ message: "Outside trading hours (07:00–22:30 CET)" });
  }

  try {
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    if (!settings || !settings.alertEmail) {
      return NextResponse.json({ message: "No settings or email configured" });
    }

    const alertSettings: AlertSettings = {
      vixLowThreshold: settings.vixLowThreshold,
      stdDevMultiplier: settings.stdDevMultiplier,
      rollingWindowDays: settings.rollingWindowDays,
      targetReturnPct: settings.targetReturnPct,
      spikeThresholdPct: settings.spikeThresholdPct,
      trailingStopConfig: settings.trailingStopConfig as {
        enabled: boolean;
        stepPct: number;
      },
    };

    const triggered: AlertResult[] = [];

    // Externe Quellen + DB-Reads parallel statt sequenziell
    const vontobelIsin = settings.vontobelIsin || undefined;
    const [spot, futureQuote, positions, histCache] = await Promise.all([
      getVixSpot(),
      getVontobelFuturesQuote(vontobelIsin),
      prisma.position.findMany({ where: { status: "open" } }),
      prisma.vixCache.findUnique({ where: { id: "history_closes" } }),
    ]);
    if (!spot) {
      return NextResponse.json({ message: "VIX data unavailable" });
    }

    // Gecachte Bids für alle offenen Positionen in EINEM Query
    // (statt zwei findUnique-Runden pro Position für Spike + Trailing Stop)
    const bidByCert = new Map<string, number | null>();
    if (positions.length > 0) {
      try {
        const rows = await prisma.vixCache.findMany({
          where: { id: { in: positions.map((p) => `vontobel_${p.certificateId}`) } },
        });
        for (const row of rows) {
          const bid = (row.data as { bid?: number | null }).bid ?? null;
          bidByCert.set(row.id.replace(/^vontobel_/, ""), bid);
        }
      } catch (e) {
        console.error("[alerts/check] bid cache read:", e);
      }
    }

    // Entry alerts
    const entryAlert = checkVixEntry(spot.price, alertSettings);
    if (entryAlert) triggered.push(entryAlert);

    // Std dev alert — use rolling window from settings
    if (histCache) {
      const allCloses = (histCache.data as { closes: number[] }).closes || [];
      const windowCloses = allCloses.slice(-settings.rollingWindowDays);
      const stdAlert = checkStdDevAlert(windowCloses, spot.price, alertSettings);
      if (stdAlert) triggered.push(stdAlert);
    }

    // VIX Spot Spike (Yahoo Finance — already fetched, most reliable source for VIX)
    if (Math.abs(spot.changePct) >= alertSettings.spikeThresholdPct) {
      const dir = spot.changePct > 0 ? "gestiegen" : "gefallen";
      triggered.push({
        type: "spike",
        message: `VIX Spike: ${spot.changePct >= 0 ? "+" : ""}${spot.changePct.toFixed(1)}% ${dir} (${spot.previousClose.toFixed(2)} → ${spot.price.toFixed(2)})`,
        vixLevel: spot.price,
        urgency: spot.changePct > 0 ? "high" : "medium",
        details: { source: "spot", changePct: spot.changePct, previousClose: spot.previousClose, price: spot.price },
      });
    }

    // VX Futures Spike (Vontobel) — unabhängig von offenen Positionen
    if (futureQuote && futureQuote.previousClose > 0) {
      const spikeAlert = checkVixSpike(
        futureQuote.price,
        futureQuote.previousClose,
        positions.map((p) => ({
          id: p.id,
          certificateId: p.certificateId,
          entryVix: p.entryVix,
          entryPrice: p.entryPrice,
          currentBarrier: p.currentBarrier,
          leverageRatio: p.leverageRatio,
          currentBid: bidByCert.get(p.certificateId) ?? null,
        })),
        alertSettings
      );
      if (spikeAlert) triggered.push(spikeAlert);
    }

    // Trailing Stop — Bids kommen aus dem bereits geladenen bidByCert-Batch
    if (positions.length > 0 && alertSettings.trailingStopConfig.enabled) {
      const tsResults = positions.map((p) => {
        const bid = bidByCert.get(p.certificateId) ?? null;
        if (bid == null || p.entryPrice <= 0) return null;

        const currentPnlPct = ((bid - p.entryPrice) / p.entryPrice) * 100;
        const tsResult = checkTrailingStop(
          {
            positionId: p.id,
            certificateId: p.certificateId,
            currentPnlPct,
            currentFloor: p.trailingStopFloor,
            peakPnlPct: p.peakPnlPct,
            entryPrice: p.entryPrice,
            currentBid: bid,
          },
          alertSettings
        );
        return tsResult ? { alert: tsResult.alert, positionId: p.id, newFloor: tsResult.newFloor, newPeakPnlPct: tsResult.newPeakPnlPct } : null;
      });

      // Apply position updates in parallel for all triggered trailing stops
      const updates = tsResults.filter((r): r is NonNullable<typeof r> => r !== null);
      triggered.push(...updates.map((r) => r.alert));
      await Promise.all(
        updates.map((r) =>
          prisma.position.update({
            where: { id: r.positionId },
            data: { trailingStopFloor: r.newFloor, peakPnlPct: r.newPeakPnlPct },
          })
        )
      );
    }

    // Economic event alerts (2h warning)
    const upcomingEvents = getEventsWithin2Hours();
    for (const event of upcomingEvents) {
      triggered.push({
        type: "event",
        message: `Bevorstehendes Event in <2 Stunden: ${event.title} (${event.time} Uhr)`,
        urgency: event.impact === "high" ? "high" : "medium",
        details: { event },
      });
    }

    // Send emails and log — with 30-min cooldown per alert type
    // Cooldown-Typen in EINEM Query laden statt einer Abfrage pro Alert
    const cooldownCutoff = new Date(Date.now() - 30 * 60 * 1000);
    const typesOnCooldown = new Set(
      (
        await prisma.alertLog.findMany({
          where: { sentAt: { gte: cooldownCutoff } },
          select: { alertType: true },
        })
      ).map((r) => r.alertType)
    );

    const sent: AlertResult[] = [];
    for (const alert of triggered) {
      if (typesOnCooldown.has(alert.type)) continue;
      typesOnCooldown.add(alert.type); // verhindert Doppel-Versand desselben Typs im selben Lauf
      if (settings.alertEmail) {
        await sendAlertEmail(alert, settings.alertEmail);
      }
      await prisma.alertLog.create({
        data: {
          alertType: alert.type,
          message: alert.message,
          vixLevel: spot.price,
        },
      });
      sent.push(alert);
    }

    return NextResponse.json({
      checked: true,
      vix: spot.price,
      alertsTriggered: triggered.length,
      alertsSent: sent.length,
      alerts: triggered.map((a) => ({ type: a.type, message: a.message, sent: sent.includes(a) })),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
