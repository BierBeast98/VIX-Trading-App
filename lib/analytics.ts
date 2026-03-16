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

export interface BacktestResult {
  period: string;
  tradesSimulated: number;
  winRate: number;
  avgReturn: number;
  totalReturn: number;
  bestEntry: number;
  maxDrawdown: number;
}

export function runBacktest(
  history: { date: string; close: number }[],
  entryThreshold: number,
  exitThreshold: number,
  holdDays = 10
): BacktestResult {
  if (history.length < holdDays + 1) {
    return {
      period: "Nicht genug Daten",
      tradesSimulated: 0,
      winRate: 0,
      avgReturn: 0,
      totalReturn: 0,
      bestEntry: 0,
      maxDrawdown: 0,
    };
  }

  const trades: { entryVix: number; exitVix: number; return: number }[] = [];
  let i = 0;

  while (i < history.length - holdDays) {
    const vix = history[i].close;

    if (vix <= entryThreshold) {
      const exitIdx = Math.min(i + holdDays, history.length - 1);
      const exitVix = history[exitIdx].close;
      // Knockout long VIX: profit when VIX rises
      const ret = ((exitVix - vix) / vix) * 100;
      trades.push({ entryVix: vix, exitVix, return: ret });
      i = exitIdx + 1;
    } else {
      i++;
    }
  }

  if (trades.length === 0) {
    return {
      period: `${history[0].date} – ${history[history.length - 1].date}`,
      tradesSimulated: 0,
      winRate: 0,
      avgReturn: 0,
      totalReturn: 0,
      bestEntry: 0,
      maxDrawdown: 0,
    };
  }

  const returns = trades.map((t) => t.return);
  const wins = returns.filter((r) => r > 0);
  const avgEntry = trades.reduce((a, b) => a + b.entryVix, 0) / trades.length;

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
    period: `${history[0].date} – ${history[history.length - 1].date}`,
    tradesSimulated: trades.length,
    winRate: wins.length / trades.length,
    avgReturn: returns.reduce((a, b) => a + b, 0) / returns.length,
    totalReturn: returns.reduce((a, b) => a + b, 0),
    bestEntry: avgEntry,
    maxDrawdown,
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
