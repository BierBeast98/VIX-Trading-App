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
  /** VIX ≤ this level triggers a long entry (Einstiegsniveau) */
  entryThreshold: number;
  /** Minimum P&L% required to activate the trailing stop (Mindestrendite) */
  targetReturnPct: number;
  /** Trailing stop step size in % — floor rises by this for each gain step (Schritte) */
  stepPct: number;
  /** Certificate leverage multiplier (Hebel) */
  leverageRatio: number;
  /** Maximum hold period in days — used as fallback if trailing stop never triggers */
  maxHoldDays: number;
}

export interface BacktestResult {
  period: string;
  tradesSimulated: number;
  winRate: number;
  avgReturn: number;
  totalReturn: number;
  avgHoldDays: number;
  maxDrawdown: number;
  trailingStopExits: number;
  maxHoldExits: number;
  avgEntryVix: number;
}

export function runBacktest(
  history: { date: string; close: number }[],
  params: BacktestParams
): BacktestResult {
  const { entryThreshold, targetReturnPct, stepPct, leverageRatio, maxHoldDays } = params;

  const emptyResult = (period: string): BacktestResult => ({
    period,
    tradesSimulated: 0,
    winRate: 0,
    avgReturn: 0,
    totalReturn: 0,
    avgHoldDays: 0,
    maxDrawdown: 0,
    trailingStopExits: 0,
    maxHoldExits: 0,
    avgEntryVix: 0,
  });

  if (history.length < 2) return emptyResult("Nicht genug Daten");

  const periodLabel = `${history[0].date} – ${history[history.length - 1].date}`;

  const trades: {
    entryVix: number;
    return: number;
    holdDays: number;
    exitReason: "trailing_stop" | "max_hold";
  }[] = [];

  let i = 0;

  while (i < history.length - 1) {
    const entryVix = history[i].close;

    if (entryVix <= entryThreshold) {
      let peakPnl = 0;
      let floor: number | null = null;
      let exitIdx = Math.min(i + maxHoldDays, history.length - 1);
      let exitReason: "trailing_stop" | "max_hold" = "max_hold";
      let exitCertPnl = 0;

      for (let j = i + 1; j <= Math.min(i + maxHoldDays, history.length - 1); j++) {
        const vixChangePct = (history[j].close - entryVix) / entryVix * 100;
        const certPnl = vixChangePct * leverageRatio;

        peakPnl = Math.max(peakPnl, certPnl);

        // Trailing stop floor: activates when Mindestrendite is reached.
        // Floor starts one step below the target and rises with each additional step.
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
        entryVix,
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
    tradesSimulated: trades.length,
    winRate: wins.length / trades.length,
    avgReturn: returns.reduce((a, b) => a + b, 0) / returns.length,
    totalReturn: returns.reduce((a, b) => a + b, 0),
    avgHoldDays: totalHoldDays / trades.length,
    maxDrawdown,
    trailingStopExits,
    maxHoldExits: trades.length - trailingStopExits,
    avgEntryVix,
  };
}

export function suggestPositionSize(
  riskBudget: number,
  vixLevel: number,
  targetReturn: number
): { allocation: number; reason: string } {
  // Risk-adjusted allocation based on VIX level
  // Lower VIX = smaller position (higher risk of further decline)
  // Higher VIX = larger position (mean reversion more likely)
  let pct: number;
  let reason: string;

  if (vixLevel <= 14) {
    pct = 0.3;
    reason = "VIX sehr niedrig — konservative Positionsgröße (30%)";
  } else if (vixLevel <= 16) {
    pct = 0.4;
    reason = "VIX niedrig — moderate Positionsgröße (40%)";
  } else if (vixLevel <= 20) {
    pct = 0.5;
    reason = "VIX im normalen Bereich — Standard-Positionsgröße (50%)";
  } else if (vixLevel <= 25) {
    pct = 0.65;
    reason = "VIX erhöht — größere Position möglich (65%)";
  } else if (vixLevel <= 30) {
    pct = 0.75;
    reason = "VIX hoch — erhöhte Mean-Reversion-Wahrscheinlichkeit (75%)";
  } else {
    pct = 0.6;
    reason = "VIX sehr hoch — Vorsicht: Tail-Risk vorhanden (60%)";
  }

  return {
    allocation: riskBudget * pct,
    reason,
  };
}
