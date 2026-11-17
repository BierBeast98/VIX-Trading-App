import { calcSharpeRatio, calcStepFloor } from "./utils";
import { holdingDays, tradeReturn, tradePnl, type TradeValues } from "./trade-metrics";

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
    alertTriggeredCount: evaluated.filter(t => t.alertTriggered).length,
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
   *  Entry signal still uses VIX spot (history). Requires a complete matching series; otherwise the model returns no trades. */
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
  if (![entryThreshold, targetReturnPct, stepPct, leverageRatio, maxHoldDays, stopLossPct, knockoutBarrierPct].every(Number.isFinite) || leverageRatio <= 0 || maxHoldDays < 1 || stepPct <= 0) return emptyResult("Ungültige Modellparameter");

  if (history.some((d, index) => !Number.isFinite(Date.parse(d.date)) || !Number.isFinite(d.close) || d.close <= 0 || (index > 0 && Date.parse(d.date) <= Date.parse(history[index - 1].date)))) return emptyResult("Ungültige Kursreihe");
  // Never splice spot levels into a partially missing futures series.
  if (futuresHistory && history.some(d => !Number.isFinite(futuresMap.get(d.date)) || futuresMap.get(d.date)! <= 0)) return emptyResult("Unvollständige Futures-Kursreihe");

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
      const deadline = Date.parse(history[i].date) + maxHoldDays * 86_400_000;
      let maxExitIdx = i + 1;
      while (maxExitIdx < history.length - 1 && Date.parse(history[maxExitIdx].date) < deadline) maxExitIdx++;
      let exitIdx = maxExitIdx;
      let exitReason: "trailing_stop" | "stop_loss" | "knockout" | "max_hold" = "max_hold";
      let exitCertPnl = 0;

      for (let j = i + 1; j <= maxExitIdx; j++) {
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
        const certPnl = Math.max(-100, vixChangePct * leverageRatio);
        if (certPnl === -100) {
          exitCertPnl = -100;
          exitIdx = j;
          exitReason = "knockout";
          break;
        }

        peakPnl = Math.max(peakPnl, certPnl);

        // Hard stop-loss
        if (stopLossPct > 0 && certPnl <= -stopLossPct) {
          exitCertPnl = certPnl;
          exitIdx = j;
          exitReason = "stop_loss";
          break;
        }

        // Trailing stop floor
        if (peakPnl >= targetReturnPct && stepPct > 0) {
          floor = calcStepFloor(targetReturnPct, stepPct, peakPnl);
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
        holdDays: (Date.parse(history[exitIdx].date) - Date.parse(history[i].date)) / 86_400_000,
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

  // Sequential full-allocation model equity; drawdown is relative to the running peak.
  let maxDrawdown = 0;
  let peak = 1;
  let equity = 1;
  for (const r of returns) {
    equity *= 1 + r / 100;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, (1 - equity / peak) * 100);
  }

  return {
    period: periodLabel,
    direction,
    tradesSimulated: trades.length,
    winRate: wins.length / trades.length,
    avgReturn: returns.reduce((a, b) => a + b, 0) / returns.length,
    totalReturn: (equity - 1) * 100,
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
