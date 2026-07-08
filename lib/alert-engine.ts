import { calcZScore, calcStepFloor } from "./utils";
import type { AlertType, AlertUrgency } from "./alert-types";

export type { AlertType } from "./alert-types";

export interface AlertResult {
  type: AlertType;
  /**
   * Identität der Alert-Bedingung für Arm/Re-Arm + Anti-Flap
   * (z.B. "entry", "profitTarget:DE000VY6F1Z4", "event:fomc-2026-07").
   */
  dedupeKey: string;
  message: string;
  vixLevel?: number;
  urgency: AlertUrgency;
  /** Edge-Event (z.B. Trailing-Floor aktiviert/angehoben): immer senden, kein Arm/Re-Arm. */
  edge?: boolean;
  details?: Record<string, unknown>;
}

export interface AlertSettings {
  vixLowThreshold: number;
  stdDevMultiplier: number;
  rollingWindowDays: number;
  targetReturnPct: number;
  spikeThresholdPct: number;
  trailingStopConfig: {
    enabled: boolean;
    stepPct: number;
  };
}

export interface SpikePosition {
  id: string;
  certificateId: string;
  entryVix: number;
  entryPrice: number;
  currentBarrier: number;
  leverageRatio: number;
  currentBid?: number | null;
}

export interface TrailingStopInput {
  positionId: string;
  certificateId: string;
  currentPnlPct: number;
  currentFloor: number | null;
  peakPnlPct: number | null;
  entryPrice: number;
  currentBid: number;
}

export interface TrailingStopResult {
  alert: AlertResult;
  newFloor: number;
  newPeakPnlPct: number;
}

export function checkVixEntry(
  vix: number,
  settings: AlertSettings
): AlertResult | null {
  if (vix <= settings.vixLowThreshold) {
    return {
      type: "entry",
      dedupeKey: "entry",
      message: `VIX erreicht Einstiegszone: ${vix.toFixed(2)} (Schwelle: ${settings.vixLowThreshold})`,
      vixLevel: vix,
      urgency: "high",
      details: { vix, threshold: settings.vixLowThreshold },
    };
  }

  return null;
}

export function checkStdDevAlert(
  history: number[],
  current: number,
  settings: AlertSettings
): AlertResult | null {
  if (history.length < 10) return null;

  const zScore = calcZScore(history, current);
  const absZ = Math.abs(zScore);

  if (absZ >= settings.stdDevMultiplier) {
    const direction = zScore > 0 ? "über" : "unter";
    return {
      type: "stddev",
      // Richtung im Key: Wechsel über/unter = neue Bedingung, feuert erneut
      dedupeKey: zScore > 0 ? "stddev:above" : "stddev:below",
      message: `VIX ist ${absZ.toFixed(1)} Standardabweichungen ${direction} dem ${settings.rollingWindowDays}-Tage-Mittelwert (VIX: ${current.toFixed(2)}, Z-Score: ${zScore.toFixed(2)})`,
      vixLevel: current,
      urgency: absZ >= settings.stdDevMultiplier * 1.5 ? "high" : "medium",
      details: { zScore, multiplier: settings.stdDevMultiplier, current },
    };
  }

  return null;
}

/** VIX-Spot-Spike (Yahoo Finance) — Tagesänderung ≥ Schwelle */
export function checkSpotSpike(
  spot: { price: number; changePct: number; previousClose: number },
  settings: AlertSettings
): AlertResult | null {
  if (Math.abs(spot.changePct) < settings.spikeThresholdPct) return null;

  const dir = spot.changePct > 0 ? "gestiegen" : "gefallen";
  return {
    type: "spike",
    dedupeKey: spot.changePct > 0 ? "spike:up" : "spike:down",
    message: `VIX Spike: ${spot.changePct >= 0 ? "+" : ""}${spot.changePct.toFixed(1)}% ${dir} (${spot.previousClose.toFixed(2)} → ${spot.price.toFixed(2)})`,
    vixLevel: spot.price,
    urgency: spot.changePct > 0 ? "high" : "medium",
    details: { source: "spot", changePct: spot.changePct, previousClose: spot.previousClose, price: spot.price },
  };
}

/** VIX-Future-Spike (Vontobel) — eigener Typ vxSpike, blockiert den Spot-Spike nicht mehr */
export function checkVixSpike(
  futurePrice: number,
  futurePrevClose: number,
  positions: SpikePosition[],
  settings: AlertSettings
): AlertResult | null {
  if (futurePrevClose <= 0) return null;

  const futureChangePct = ((futurePrice - futurePrevClose) / futurePrevClose) * 100;
  if (Math.abs(futureChangePct) < settings.spikeThresholdPct) return null;

  const direction = futureChangePct > 0 ? "gestiegen" : "gefallen";

  const posDetails = positions.map((p) => {
    const barrierDist = ((futurePrice - p.currentBarrier) / p.currentBarrier * 100);
    const pnlPct = (p.currentBid != null && p.entryPrice > 0)
      ? ((p.currentBid - p.entryPrice) / p.entryPrice * 100)
      : null;
    const pnlStr = pnlPct != null ? ` P&L: ${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(1)}%` : "";
    return {
      text: `${p.certificateId} (Barrier: ${barrierDist.toFixed(1)}%, Hebel: ${p.leverageRatio.toFixed(1)}x${pnlStr})`,
      barrierDist,
      pnlPct,
    };
  });

  const positionSummary = posDetails.length > 0
    ? `. Positionen: ${posDetails.map((d) => d.text).join("; ")}`
    : "";

  // VIX Future rising is dangerous for short-VIX certificates
  const isAdverse = futureChangePct > 0;

  return {
    type: "vxSpike",
    dedupeKey: futureChangePct > 0 ? "vxSpike:up" : "vxSpike:down",
    message: `VIX-Future-Spike: ${futureChangePct >= 0 ? "+" : ""}${futureChangePct.toFixed(1)}% ${direction} (${futurePrevClose.toFixed(2)} → ${futurePrice.toFixed(2)})${positionSummary}`,
    vixLevel: futurePrice,
    urgency: isAdverse ? "high" : "medium",
    details: {
      futureChangePct,
      futurePrevClose,
      futurePrice,
      positionCount: positions.length,
      positions: posDetails.map((d, i) => ({
        id: positions[i].id,
        certificateId: positions[i].certificateId,
        barrierDist: d.barrierDist,
        pnlPct: d.pnlPct,
      })),
    },
  };
}

export interface ProfitTargetInput {
  positionId: string;
  certificateId: string;
  direction: string;
  entryPrice: number;
  currentBid: number;
  currentPnlPct: number;
}

/** Gewinnziel: offene Position erreicht +X % P&L (unabhängig vom Trailing Stop) */
export function checkProfitTarget(
  pos: ProfitTargetInput,
  thresholdPct: number
): AlertResult | null {
  if (thresholdPct <= 0 || pos.currentPnlPct < thresholdPct) return null;

  return {
    type: "profitTarget",
    dedupeKey: `profitTarget:${pos.certificateId}`,
    message: `Gewinnziel erreicht: ${pos.certificateId} bei ${pos.currentPnlPct >= 0 ? "+" : ""}${pos.currentPnlPct.toFixed(1)}% P&L (Ziel: ${thresholdPct}%, Bid: ${pos.currentBid.toFixed(2)} €, Einstieg: ${pos.entryPrice.toFixed(2)} €)`,
    urgency: "medium",
    details: {
      positionId: pos.positionId,
      certificateId: pos.certificateId,
      direction: pos.direction,
      currentPnlPct: pos.currentPnlPct,
      thresholdPct,
      currentBid: pos.currentBid,
      entryPrice: pos.entryPrice,
    },
  };
}

export function checkTrailingStop(
  pos: TrailingStopInput,
  settings: AlertSettings
): TrailingStopResult | null {
  if (!settings.trailingStopConfig.enabled) return null;

  const { stepPct } = settings.trailingStopConfig;
  const targetReturn = settings.targetReturnPct;
  const { currentPnlPct, currentFloor, peakPnlPct, certificateId, entryPrice, currentBid } = pos;

  const floorPrice = (pct: number) => (entryPrice * (1 + pct / 100)).toFixed(2);
  const computedFloor = calcStepFloor(targetReturn, stepPct, currentPnlPct);

  // Case 1: Floor not yet activated — check if target reached
  if (currentFloor == null) {
    if (computedFloor == null) return null;

    const stopPrice = floorPrice(computedFloor);
    return {
      alert: {
        type: "trailingStop",
        dedupeKey: `trailingStop:${certificateId}`,
        edge: true,
        message: `Zielrendite erreicht: ${certificateId} bei ${currentPnlPct.toFixed(1)}% P&L (Bid: ${currentBid.toFixed(2)} €). Trailing Stop aktiviert, Floor: ${computedFloor.toFixed(1)}% → Stop-Loss bei ${stopPrice} €`,
        urgency: "medium",
        details: { positionId: pos.positionId, certificateId, currentPnlPct, newFloor: computedFloor, stopPrice, currentBid, event: "activated" },
      },
      newFloor: computedFloor,
      newPeakPnlPct: currentPnlPct,
    };
  }

  // Case 2: P&L dropped below floor — sell signal (Dauerbedingung, läuft über Arm/Re-Arm)
  if (currentPnlPct < currentFloor) {
    const stopPrice = floorPrice(currentFloor);
    return {
      alert: {
        type: "trailingStop",
        dedupeKey: `trailingStopBreach:${certificateId}`,
        message: `P&L unter Floor gefallen: ${certificateId} bei ${currentPnlPct.toFixed(1)}% (Bid: ${currentBid.toFixed(2)} €, Floor: ${currentFloor.toFixed(1)}% = ${stopPrice} €). Verkauf prüfen!`,
        urgency: "high",
        details: { positionId: pos.positionId, certificateId, currentPnlPct, currentFloor, stopPrice, currentBid, event: "breached" },
      },
      newFloor: currentFloor,
      newPeakPnlPct: peakPnlPct ?? currentPnlPct,
    };
  }

  // Case 3: New step crossed — raise floor
  if (computedFloor != null && computedFloor > currentFloor) {
    const stopPrice = floorPrice(computedFloor);
    return {
      alert: {
        type: "trailingStop",
        dedupeKey: `trailingStop:${certificateId}`,
        edge: true,
        message: `Floor angehoben: ${certificateId} bei ${currentPnlPct.toFixed(1)}% P&L (Bid: ${currentBid.toFixed(2)} €). Floor: ${currentFloor.toFixed(1)}% → ${computedFloor.toFixed(1)}% — Stop-Loss bei ${stopPrice} €`,
        urgency: "low",
        details: { positionId: pos.positionId, certificateId, currentPnlPct, oldFloor: currentFloor, newFloor: computedFloor, stopPrice, currentBid, event: "raised" },
      },
      newFloor: computedFloor,
      newPeakPnlPct: currentPnlPct,
    };
  }

  return null;
}
