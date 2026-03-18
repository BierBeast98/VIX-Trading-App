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


export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  const testMode = new URL(req.url).searchParams.get("test") === "true";

  if (!testMode && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    // Get current VIX
    const spot = await getVixSpot();
    if (!spot) {
      return NextResponse.json({ message: "VIX data unavailable" });
    }

    // Entry alerts
    const entryAlert = checkVixEntry(spot.price, alertSettings);
    if (entryAlert) triggered.push(entryAlert);

    // Std dev alert — use rolling window from settings
    const histCache = await prisma.vixCache.findUnique({ where: { id: "history_closes" } });
    if (histCache) {
      const allCloses = (histCache.data as { closes: number[] }).closes || [];
      const windowCloses = allCloses.slice(-settings.rollingWindowDays);
      const stdAlert = checkStdDevAlert(windowCloses, spot.price, alertSettings);
      if (stdAlert) triggered.push(stdAlert);
    }

    // VIX Spike alert — based on VIX Future + certificate prices
    const positions = await prisma.position.findMany({ where: { status: "open" } });
    if (positions.length > 0) {
      const vontobelIsin = settings.vontobelIsin || undefined;
      const futureQuote = await getVontobelFuturesQuote(vontobelIsin);

      if (futureQuote && futureQuote.previousClose > 0) {
        // Fetch current bid prices for each position's certificate
        const bidPrices = await Promise.all(
          positions.map(async (p) => {
            try {
              const cached = await prisma.vixCache.findUnique({
                where: { id: `vontobel_${p.certificateId}` },
              });
              if (cached) {
                const data = cached.data as { bid?: number | null };
                return data.bid ?? null;
              }
            } catch { /* noop */ }
            return null;
          })
        );

        const spikeAlert = checkVixSpike(
          futureQuote.price,
          futureQuote.previousClose,
          positions.map((p, i) => ({
            id: p.id,
            certificateId: p.certificateId,
            entryVix: p.entryVix,
            entryPrice: p.entryPrice,
            currentBarrier: p.currentBarrier,
            leverageRatio: p.leverageRatio,
            currentBid: bidPrices[i],
          })),
          alertSettings
        );
        if (spikeAlert) triggered.push(spikeAlert);
      }
    }

    // Trailing Stop — check all open positions in parallel
    if (positions.length > 0 && alertSettings.trailingStopConfig.enabled) {
      const tsResults = await Promise.all(
        positions.map(async (p) => {
          let bid: number | null = null;
          try {
            const cached = await prisma.vixCache.findUnique({
              where: { id: `vontobel_${p.certificateId}` },
            });
            if (cached) {
              const data = cached.data as { bid?: number | null };
              bid = data.bid ?? null;
            }
          } catch { /* noop */ }

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
        })
      );

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

    // Send emails and log
    for (const alert of triggered) {
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
    }

    return NextResponse.json({
      checked: true,
      vix: spot.price,
      alertsTriggered: triggered.length,
      alerts: triggered.map((a) => a.message),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
