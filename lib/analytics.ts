import { calcSharpeRatio } from "./utils";
import { holdingDays, tradeReturn, tradePnl, tradeNetResult, type TradeValues } from "./trade-metrics";

export interface TradeRecord extends TradeValues {
  id: string;
  certificateId: string;
  entryVix: number;
  exitVix?: number | null;
  barrierLevel: number;
  holdDays?: number | null;
  alertTriggered: boolean;
}

export interface PerformanceMetrics {
  totalTrades: number;
  closedTrades: number;
  analyzedTrades: number;
  invalidDateTrades: number;
  missingReturnTrades: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  avgReturn: number;
  avgWin: number;
  avgLoss: number;
  avgHoldDays: number;
  /** Per-trade mean / standard deviation, not an annualized account Sharpe. */
  sharpeRatio: number;
  bestTrade: number;
  worstTrade: number;
  /** Sum of certificate returns, not an account return. */
  totalReturn: number;
  /** Account returns require a dated account baseline and cash-flow history. */
  compoundReturn: null;
  annualizedReturn: null;
  periodDays: number;
  firstTradeDate: string | null;
  lastTradeDate: string | null;
  /** Gross realized certificate P&L; legacy records do not track fees reliably. */
  totalPnlEur: number;
  tradesWithEurData: number;
  pnlBeforeTax: number;
  tradesWithFees: number;
  pnlAfterTax: number;
  tradesWithTax: number;
  alertTriggeredCount: number;
  earlyExitCount: number;
}

export function calcPerformanceMetrics(trades: TradeRecord[]): PerformanceMetrics {
  const closed = trades.filter(t => t.exitDate != null);
  const dated = closed.filter(t => holdingDays(t.entryDate, t.exitDate) != null);
  const evaluated = dated.filter(t => tradeReturn(t) != null);
  const returns = evaluated.map(t => tradeReturn(t)!);
  const wins = returns.filter(r => r > 0);
  const losses = returns.filter(r => r < 0);
  const average = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const eurTrades = dated.filter(t => tradePnl(t) != null);
  const net = eurTrades.map(tradeNetResult);
  const beforeTax = net.flatMap(t => t.beforeTax != null ? [t.beforeTax] : []);
  const afterTax = net.flatMap(t => t.afterTax != null ? [t.afterTax] : []);
  const firstEntry = dated.length ? Math.min(...dated.map(t => new Date(t.entryDate).getTime())) : null;
  const lastExit = dated.length ? Math.max(...dated.map(t => new Date(t.exitDate!).getTime())) : null;
  return {
    totalTrades: trades.length,
    closedTrades: closed.length,
    analyzedTrades: evaluated.length,
    invalidDateTrades: closed.length - dated.length,
    missingReturnTrades: dated.length - evaluated.length,
    winCount: wins.length,
    lossCount: losses.length,
    winRate: evaluated.length ? wins.length / evaluated.length : 0,
    avgReturn: average(returns),
    avgWin: average(wins),
    avgLoss: average(losses),
    avgHoldDays: average(dated.map(t => holdingDays(t.entryDate, t.exitDate)!)),
    sharpeRatio: calcSharpeRatio(returns),
    bestTrade: returns.length ? Math.max(...returns) : 0,
    worstTrade: returns.length ? Math.min(...returns) : 0,
    totalReturn: returns.reduce((a, b) => a + b, 0),
    compoundReturn: null,
    annualizedReturn: null,
    periodDays: firstEntry != null && lastExit != null ? (lastExit - firstEntry) / 86_400_000 : 0,
    firstTradeDate: firstEntry != null ? new Date(firstEntry).toISOString() : null,
    lastTradeDate: lastExit != null ? new Date(lastExit).toISOString() : null,
    totalPnlEur: eurTrades.reduce((a, t) => a + tradePnl(t)!, 0),
    tradesWithEurData: eurTrades.length,
    pnlBeforeTax: beforeTax.reduce((a, b) => a + b, 0),
    tradesWithFees: beforeTax.length,
    pnlAfterTax: afterTax.reduce((a, b) => a + b, 0),
    tradesWithTax: afterTax.length,
    alertTriggeredCount: evaluated.filter(t => t.alertTriggered).length,
    earlyExitCount: 0,
  };
}

export function analyzeEntryLevels(trades: TradeRecord[]) {
  const buckets = new Map<number, { count: number; totalReturn: number; wins: number }>();
  for (const trade of trades) {
    if (!trade.exitDate || holdingDays(trade.entryDate, trade.exitDate) == null || !Number.isFinite(trade.entryVix) || trade.entryVix <= 0) continue;
    const result = tradeReturn(trade);
    if (result == null) continue;
    const level = Math.floor(trade.entryVix / 2) * 2;
    const bucket = buckets.get(level) ?? { count: 0, totalReturn: 0, wins: 0 };
    bucket.count++;
    bucket.totalReturn += result;
    if (result > 0) bucket.wins++;
    buckets.set(level, bucket);
  }
  return Array.from(buckets).sort(([a], [b]) => a - b).map(([level, { count, totalReturn, wins }]) => ({
    range: `${level}-${level + 2}`, count, avgReturn: totalReturn / count, winRate: wins / count,
  }));
}
