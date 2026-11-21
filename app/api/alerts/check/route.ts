import { freshBid } from '@/lib/alert-quote';
import { runSignalsCheck } from '@/lib/signals/service';
import { cronAllowed } from '@/lib/signals/auth';
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVixSpot, getVontobelFuturesQuote } from "@/lib/yahoo-finance";
import {
  checkVixEntry,
  checkStdDevAlert,
  checkSpotSpike,
  checkVixSpike,
  checkProfitTarget,
  checkTrailingStop,
  type AlertSettings,
} from "@/lib/alert-engine";
import { dispatchAlerts, type Evaluation } from "@/lib/alert-dispatch";
import { normalizeAlertConfig } from "@/lib/alert-config";
import { getEventsWithin2Hours } from "@/lib/economic-calendar";
import { isWithinTradingHours } from "@/lib/trading-hours";

// Quotes/Bids älter als 30 Min gelten als stale — keine Alerts auf veralteten Daten
const STALE_MS = 30 * 60 * 1000;

export async function GET(req: NextRequest) {
  // Bearer-Auth ist IMMER Pflicht (der frühere ?test=true-Bypass ist entfernt).
  // ?force=true  → Handelszeit-Gate umgehen
  // ?dryRun=true → komplett schreibfrei: keine Mails, kein AlertLog/AlertState, keine Floor-Writes
  if (!cronAllowed(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(req.url).searchParams;
  const force = params.get("force") === "true";
  const dryRun = params.get("dryRun") === "true";

  // Manual strategy has its own broker hours. Never run it through the legacy force bypass.
  const manualSignals = dryRun ? { checked: false, message: 'dryRun: Signalzustand unverändert' }
    : await runSignalsCheck().catch(() => ({ checked: false, message: 'Signalprüfung fehlgeschlagen' }));

  const useManualSignals = "managed" in manualSignals && manualSignals.managed === true;

  // Skip outside trading hours (07:00–22:30 CET/CEST) — VIX certificates illiquid outside window
  if (!force && !isWithinTradingHours()) {
    return NextResponse.json({ message: "Outside trading hours (07:00–22:30 CET)", manualSignals });
  }

  try {
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    if (!settings || !settings.alertEmail) {
      return NextResponse.json({ message: "No settings or email configured", manualSignals });
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
    const config = normalizeAlertConfig(settings.alertConfig);

    // Externe Quellen + DB-Reads parallel statt sequenziell
    const vontobelIsin = settings.vontobelIsin || undefined;
    const [spot, futureQuote, positions, histCache] = await Promise.all([
      getVixSpot(),
      getVontobelFuturesQuote(vontobelIsin),
      prisma.position.findMany({ where: { status: "open", NOT: { notes: { startsWith: "signal:" } } } }),
      prisma.vixCache.findUnique({ where: { id: "history_closes" } }),
    ]);
    if (!spot) {
      return NextResponse.json({ message: "VIX data unavailable" });
    }

    const now = Date.now();
    const staleSpot = !Number.isFinite(spot.timestamp) || spot.timestamp <= 0 || now - spot.timestamp > STALE_MS || spot.timestamp - now > 60_000;

    // Gecachte Bids für alle offenen Positionen in EINEM Query (inkl. Frische-Check)
    const bidByCert = new Map<string, { bid: number | null; fresh: boolean }>();
    if (positions.length > 0) {
      try {
        const rows = await prisma.vixCache.findMany({
          where: { id: { in: positions.map((p) => `vontobel_${p.certificateId}`) } },
        });
        for (const row of rows) {
          const bid = freshBid(row.data, now, STALE_MS);
          bidByCert.set(row.id.replace(/^vontobel_/, ""), { bid, fresh: bid !== null });
        }
      } catch (e) {
        console.error("[alerts/check] bid cache read:", e);
      }
    }

    // Für JEDEN überwachten Key eine Evaluation — auch wenn die Bedingung false ist,
    // sonst kann dispatchAlerts nie re-armen.
    const evaluations: Evaluation[] = [];

    // Entry + Std-Dev + Spot-Spike nur mit frischem Spot bewerten
    if (!staleSpot) {
      if (config.entry.enabled && !useManualSignals) {
        evaluations.push({ key: "entry", alert: checkVixEntry(spot.price, alertSettings) });
      }

      if (config.stddev.enabled && histCache) {
        const allCloses = (histCache.data as { closes: number[] }).closes || [];
        const windowCloses = allCloses.slice(-settings.rollingWindowDays);
        const stdAlert = checkStdDevAlert(windowCloses, spot.price, alertSettings);
        evaluations.push(
          { key: "stddev:above", alert: stdAlert?.dedupeKey === "stddev:above" ? stdAlert : null },
          { key: "stddev:below", alert: stdAlert?.dedupeKey === "stddev:below" ? stdAlert : null }
        );
      }

      if (config.spike.enabled) {
        const spikeAlert = checkSpotSpike(spot, alertSettings);
        evaluations.push(
          { key: "spike:up", alert: spikeAlert?.dedupeKey === "spike:up" ? spikeAlert : null },
          { key: "spike:down", alert: spikeAlert?.dedupeKey === "spike:down" ? spikeAlert : null }
        );
      }
    }

    // VX-Futures-Spike (Vontobel-Quote hat eigenen Timestamp aus dem Seiten-Scrape)
    if (config.vxSpike.enabled && futureQuote && futureQuote.previousClose > 0) {
      const vxAlert = checkVixSpike(
        futureQuote.price,
        futureQuote.previousClose,
        positions.map((p) => ({
          id: p.id,
          certificateId: p.certificateId,
          entryVix: p.entryVix,
          entryPrice: p.entryPrice,
          currentBarrier: p.currentBarrier,
          leverageRatio: p.leverageRatio,
          currentBid: bidByCert.get(p.certificateId)?.bid ?? null,
        })),
        alertSettings
      );
      evaluations.push(
        { key: "vxSpike:up", alert: vxAlert?.dedupeKey === "vxSpike:up" ? vxAlert : null },
        { key: "vxSpike:down", alert: vxAlert?.dedupeKey === "vxSpike:down" ? vxAlert : null }
      );
    }

    // Positions-Alerts (Gewinnziel + Trailing Stop) — nur mit frischem Bid;
    // bei stale Bid keine Evaluation (weder feuern noch fälschlich re-armen)
    const floorUpdates = new Map<string, { positionId: string; newFloor: number; newPeakPnlPct: number }>();
    for (const p of positions) {
      const cached = bidByCert.get(p.certificateId);
      if (!cached || cached.bid == null || !cached.fresh || p.entryPrice <= 0) continue;

      const bid = cached.bid;
      const currentPnlPct = ((bid - p.entryPrice) / p.entryPrice) * 100;

      if (config.profitTarget.enabled) {
        evaluations.push({
          key: `profitTarget:${p.certificateId}`,
          alert: checkProfitTarget(
            {
              positionId: p.id,
              certificateId: p.certificateId,
              direction: p.direction,
              entryPrice: p.entryPrice,
              currentBid: bid,
              currentPnlPct,
            },
            config.profitTarget.thresholdPct
          ),
        });
      }

      if (alertSettings.trailingStopConfig.enabled) {
        const ts = checkTrailingStop(
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
        // Breach ist eine Dauerbedingung mit Re-Arm; activated/raised sind Edge-Events
        const breachKey = `trailingStopBreach:${p.certificateId}`;
        if (ts?.alert.edge) {
          evaluations.push({ key: ts.alert.dedupeKey, alert: ts.alert });
          evaluations.push({ key: breachKey, alert: null });
          floorUpdates.set(ts.alert.dedupeKey, {
            positionId: p.id,
            newFloor: ts.newFloor,
            newPeakPnlPct: ts.newPeakPnlPct,
          });
        } else {
          evaluations.push({ key: breachKey, alert: ts?.alert ?? null });
        }
      }
    }

    // Wirtschaftsevents (2h-Vorwarnung) — genau 1 Mail pro Event, keine Tages-Erinnerung
    if (config.event.enabled) {
      for (const event of getEventsWithin2Hours()) {
        evaluations.push({
          key: `event:${event.id}`,
          remindDaily: false,
          alert: {
            type: "event",
            dedupeKey: `event:${event.id}`,
            message: `Bevorstehendes Event in <2 Stunden: ${event.title} (${event.time} Uhr)`,
            urgency: event.impact === "high" ? "high" : "medium",
            details: { event },
          },
        });
      }
    }

    const { sent, suppressed } = await dispatchAlerts(evaluations, {
      email: settings.alertEmail,
      vixLevel: spot.price,
      dryRun,
    });

    // Trailing-Floor nur persistieren, wenn der zugehörige Edge-Alert wirklich gesendet wurde —
    // sonst laufen DB-Zustand und Benachrichtigungen auseinander
    if (!dryRun) {
      const sentFloorUpdates = sent
        .map((a) => floorUpdates.get(a.dedupeKey))
        .filter((u): u is NonNullable<typeof u> => u != null);
      await Promise.all(
        sentFloorUpdates.map((u) =>
          prisma.position.update({
            where: { id: u.positionId },
            data: { trailingStopFloor: u.newFloor, peakPnlPct: u.newPeakPnlPct },
          })
        )
      );
    }

    const triggered = evaluations.filter((e) => e.alert != null);
    return NextResponse.json({
      checked: true,
      manualSignals,
      dryRun,
      vix: spot.price,
      staleSpot,
      alertsTriggered: triggered.length,
      alertsSent: sent.length,
      alerts: triggered.map((e) => {
        const wasSent = sent.some((s) => s.dedupeKey === e.key);
        const sup = suppressed.find((s) => s.alert.dedupeKey === e.key);
        return {
          type: e.alert!.type,
          dedupeKey: e.key,
          message: e.alert!.message,
          sent: wasSent,
          suppressedReason: sup?.reason ?? null,
        };
      }),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
