import { calcSharpeRatio } from "./utils";

export interface TradeRecord {
  id: string;
  certificateId: string;
  entryDate: Date;
  exitDate?: Date | null;
  entryVix: number;
  exitVix?: number | null;
  barrierLevel: number;
  returnPct?: number | null;
  holdDays?: number | null;
  alertTriggered: boolean;
}

export interface PerformanceMetrics {
  totalTrades: number;
  closedTrades: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  avgReturn: number;
  avgWin: number;
  avgLoss: number;
  avgHoldDays: number;
  sharpeRatio: number;
  bestTrade: number;
  worstTrade: number;
  totalReturn: number;
  alertTriggeredCount: number;
  earlyExitCount: number;
}

export function calcPerformanceMetrics(trades: TradeRecord[]): PerformanceMetrics {
  const closed = trades.filter((t) => t.exitDate && t.returnPct !== null && t.returnPct !== undefined);

  if (closed.length === 0) {
    return {
      totalTrades: trades.length,
      closedTrades: 0,
      winCount: 0,
      lossCount: 0,
      winRate: 0,
      avgReturn: 0,
      avgWin: 0,
      avgLoss: 0,
      avgHoldDays: 0,
      sharpeRatio: 0,
      bestTrade: 0,
      worstTrade: 0,
      totalReturn: 0,
      alertTriggeredCount: 0,
      earlyExitCount: 0,
    };
  }

  const returns = closed.map((t) => t.returnPct!);
  const wins = returns.filter((r) => r > 0);
  const losses = returns.filter((r) => r < 0);
  const holdDays = closed.map((t) => t.holdDays ?? 0).filter((d) => d > 0);

  return {
    totalTrades: trades.length,
    closedTrades: closed.length,
    winCount: wins.length,
    lossCount: losses.length,
    winRate: wins.length / closed.length,
    avgReturn: returns.reduce((a, b) => a + b, 0) / returns.length,
    avgWin: wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0,
    avgLoss: losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0,
    avgHoldDays: holdDays.length > 0 ? holdDays.reduce((a, b) => a + b, 0) / holdDays.length : 0,
    sharpeRatio: calcSharpeRatio(returns),
    bestTrade: Math.max(...returns),
    worstTrade: Math.min(...returns),
    totalReturn: returns.reduce((a, b) => a + b, 0),
    alertTriggeredCount: closed.filter((t) => t.alertTriggered).length,
    earlyExitCount: 0,
  };
}

export interface BacktestParams {
  /** Trade direction: "long" (profit when VIX rises) or "short" (profit when VIX falls) */
  direction: "long" | "short";
  /** Long: VIX ≤ threshold triggers entry. Short: VIX ≥ threshold triggers entry. */
  entryThreshold: number;
  /** Minimum P&L% required to activate the trailing stop (Mindestrendite) */
  targetReturnPct: number;
  /** Trailing stop step size in % — floor rises by this for each gain step (Schritte) */
  stepPct: number;
  /** Certificate leverage multiplier (Hebel) */
  leverageRatio: number;
  /** Maximum hold period in days — used as fallback if trailing stop never triggers */
  maxHoldDays: number;
  /** Hard stop-loss in % (e.g. 20 = exit when certPnl < -20%). 0 = disabled. */
  stopLossPct: number;
  /** Knockout barrier distance from entry in % (e.g. 30 = barrier 30% above/below entry VIX). 0 = disabled. */
  knockoutBarrierPct: number;
}

export interface BacktestResult {
  period: string;
  direction: "long" | "short";
  tradesSimulated: number;
  winRate: number;
  avgReturn: number;
  totalReturn: number;
  avgHoldDays: number;
  maxDrawdown: number;
  trailingStopExits: number;
  stopLossExits: number;
  knockoutExits: number;
  maxHoldExits: number;
  avgEntryVix: number;
  trades: BacktestTrade[];
}

export interface BacktestTrade {
  entryDate: string;
  exitDate: string;
  entryVix: number;
  exitVix: number;
  returnPct: number;
  exitReason: "trailing_stop" | "stop_loss" | "knockout" | "max_hold";
  holdDays: number;
}

export function runBacktest(
  history: { date: string; close: number }[],
  params: BacktestParams,
  /** Optional VIX futures history — if provided, P&L is calculated on futures prices.
   *  Entry signal still uses VIX spot (history). Falls back to spot when no futures price exists. */
  futuresHistory?: { date: string; close: number }[]
): BacktestResult {
  const { direction, entryThreshold, targetReturnPct, stepPct, maxHoldDays, stopLossPct, knockoutBarrierPct } = params;
  const leverageRatio = Math.abs(params.leverageRatio); // immer positiv — Richtung wird durch isShort gesteuert
  const isShort = direction === "short";

  // Build date → futures price lookup; falls back to spot when missing
  const futuresMap = new Map(futuresHistory?.map((d) => [d.date, d.close]) ?? []);
  const getFuturesPrice = (date: string, spotFallback: number) =>
    futuresMap.get(date) ?? spotFallback;

  const emptyResult = (period: string): BacktestResult => ({
    period,
    direction,
    tradesSimulated: 0,
    winRate: 0,
    avgReturn: 0,
    totalReturn: 0,
    avgHoldDays: 0,
    maxDrawdown: 0,
    trailingStopExits: 0,
    stopLossExits: 0,
    knockoutExits: 0,
    maxHoldExits: 0,
    avgEntryVix: 0,
    trades: [],
  });

  if (history.length < 2) return emptyResult("Nicht genug Daten");

  const periodLabel = `${history[0].date} – ${history[history.length - 1].date}`;

  const trades: {
    entryDate: string;
    exitDate: string;
    entryVix: number;
    exitVix: number;
    return: number;
    holdDays: number;
    exitReason: "trailing_stop" | "stop_loss" | "knockout" | "max_hold";
  }[] = [];

  let i = 0;

  while (i < history.length - 1) {
    const entrySpotVix = history[i].close;

    // Entry condition: long = VIX low, short = VIX high
    const entryCondition = isShort
      ? entrySpotVix >= entryThreshold
      : entrySpotVix <= entryThreshold;

    if (entryCondition) {
      const entryFuturesVix = getFuturesPrice(history[i].date, entrySpotVix);

      // Knockout barrier: absolute VIX level that triggers -100% loss
      const knockoutLevel = knockoutBarrierPct > 0
        ? isShort
          ? entryFuturesVix * (1 + knockoutBarrierPct / 100)  // short: knocked out if VIX rises above
          : entryFuturesVix * (1 - knockoutBarrierPct / 100)  // long:  knocked out if VIX falls below
        : null;

      let peakPnl = 0;
      let floor: number | null = null;
      let exitIdx = Math.min(i + maxHoldDays, history.length - 1);
      let exitReason: "trailing_stop" | "stop_loss" | "knockout" | "max_hold" = "max_hold";
      let exitCertPnl = 0;

      for (let j = i + 1; j <= Math.min(i + maxHoldDays, history.length - 1); j++) {
        const currentFuturesVix = getFuturesPrice(history[j].date, history[j].close);

        // Knockout check — total loss
        if (knockoutLevel !== null) {
          const isKnockedOut = isShort
            ? currentFuturesVix >= knockoutLevel
            : currentFuturesVix <= knockoutLevel;
          if (isKnockedOut) {
            exitCertPnl = -100;
            exitIdx = j;
            exitReason = "knockout";
            break;
          }
        }

        // Direction-adjusted P&L: short profits when VIX falls, long when VIX rises
        const vixChangePct = isShort
          ? (entryFuturesVix - currentFuturesVix) / entryFuturesVix * 100
          : (currentFuturesVix - entryFuturesVix) / entryFuturesVix * 100;
        const certPnl = vixChangePct * leverageRatio;

        peakPnl = Math.max(peakPnl, certPnl);

        // Hard stop-loss
        if (stopLossPct > 0 && certPnl < -stopLossPct) {
          exitCertPnl = certPnl;
          exitIdx = j;
          exitReason = "stop_loss";
          break;
        }

        // Trailing stop floor
        if (peakPnl >= targetReturnPct && stepPct > 0) {
          const stepsAbove = Math.floor((peakPnl - targetReturnPct) / stepPct);
          floor = targetReturnPct - stepPct + stepsAbove * stepPct;
        }

        exitCertPnl = certPnl;
        exitIdx = j;

        if (floor !== null && certPnl < floor) {
          exitReason = "trailing_stop";
          break;
        }
      }

      trades.push({
        entryDate: history[i].date,
        exitDate: history[exitIdx].date,
        entryVix: entrySpotVix,
        exitVix: getFuturesPrice(history[exitIdx].date, history[exitIdx].close),
        return: exitCertPnl,
        holdDays: exitIdx - i,
        exitReason,
      });

      i = exitIdx + 1;
    } else {
      i++;
    }
  }

  if (trades.length === 0) return emptyResult(periodLabel);

  const returns = trades.map((t) => t.return);
  const wins = returns.filter((r) => r > 0);
  const totalHoldDays = trades.reduce((a, t) => a + t.holdDays, 0);
  const avgEntryVix = trades.reduce((a, t) => a + t.entryVix, 0) / trades.length;
  const trailingStopExits = trades.filter((t) => t.exitReason === "trailing_stop").length;
  const stopLossExits = trades.filter((t) => t.exitReason === "stop_loss").length;
  const knockoutExits = trades.filter((t) => t.exitReason === "knockout").length;

  let maxDrawdown = 0;
  let peak = 0;
  let cumReturn = 0;
  for (const r of returns) {
    cumReturn += r;
    if (cumReturn > peak) peak = cumReturn;
    const dd = peak - cumReturn;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  return {
    period: periodLabel,
    direction,
    tradesSimulated: trades.length,
    winRate: wins.length / trades.length,
    avgReturn: returns.reduce((a, b) => a + b, 0) / returns.length,
    totalReturn: returns.reduce((a, b) => a + b, 0),
    avgHoldDays: totalHoldDays / trades.length,
    maxDrawdown,
    trailingStopExits,
    stopLossExits,
    knockoutExits,
    maxHoldExits: trades.length - trailingStopExits - stopLossExits - knockoutExits,
    avgEntryVix,
    trades: trades.map((t) => ({
      entryDate: t.entryDate,
      exitDate: t.exitDate,
      entryVix: t.entryVix,
      exitVix: t.exitVix,
      returnPct: t.return,
      exitReason: t.exitReason,
      holdDays: t.holdDays,
    })),
  };
}

export function suggestPositionSize(
  riskBudget: number,
  vixLevel: number,
  targetReturn: number
): { allocation: number; reason: string } {
  // Long-VIX-Spike-Strategie: Einstieg wenn VIX niedrig → Profit bei Spike.
  // Niedriger VIX = idealer Einstieg = größte Allokation.
  // Hoher VIX = Spike läuft bereits = kleines Risiko, unattraktiver Einstieg.
  let pct: number;
  let reason: string;

  if (vixLevel <= 14) {
    pct = 0.7;
    reason = "VIX sehr niedrig — idealer Einstieg, hohes Spike-Potenzial (70%)";
  } else if (vixLevel <= 16) {
    pct = 0.6;
    reason = "VIX niedrig — guter Einstieg, klassische Long-Zone (60%)";
  } else if (vixLevel <= 20) {
    pct = 0.4;
    reason = "VIX moderat — akzeptabler Einstieg, reduzierte Größe (40%)";
  } else if (vixLevel <= 25) {
    pct = 0.25;
    reason = "VIX erhöht — Spike möglicherweise im Gang, kleiner Einstieg (25%)";
  } else if (vixLevel <= 30) {
    pct = 0.15;
    reason = "VIX hoch — ungünstiger Einstiegszeitpunkt, Rückschlagsrisiko (15%)";
  } else {
    pct = 0.05;
    reason = "VIX extrem hoch — Spike läuft bereits, kein neuer Long-Einstieg empfohlen (5%)";
  }

  return {
    allocation: riskBudget * pct,
    reason,
  };
}
