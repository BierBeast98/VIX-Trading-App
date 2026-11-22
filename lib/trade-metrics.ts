/** Shared read-only calculations. Stored historical values are never rewritten here. */
export interface TradeValues {
  entryDate: Date | string;
  exitDate?: Date | string | null;
  entryPrice?: number | null;
  exitPrice?: number | null;
  quantity?: number | null;
  returnPct?: number | null;
  entryFees?: number | null;
  exitFees?: number | null;
  taxWithheld?: number | null;
}

export function holdingDays(entry: Date | string, exit?: Date | string | null): number | null {
  if (!exit) return null;
  const elapsed = new Date(exit).getTime() - new Date(entry).getTime();
  return Number.isFinite(elapsed) && elapsed >= 0 ? elapsed / 86_400_000 : null;
}

export function certificateReturn(entry?: number | null, exit?: number | null): number | null {
  return entry != null && exit != null && Number.isFinite(entry) && Number.isFinite(exit) && entry > 0 && exit >= 0
    ? (exit / entry - 1) * 100 : null;
}

export function tradeReturn(trade: TradeValues): number | null {
  const derived = certificateReturn(trade.entryPrice, trade.exitPrice);
  // Actual certificate prices take precedence over a stale saved percentage, including a zero exit.
  if (derived != null) return derived;
  return trade.returnPct != null && Number.isFinite(trade.returnPct) && trade.returnPct >= -100
    ? trade.returnPct : null;
}

export function tradePnl(trade: TradeValues): number | null {
  return certificateReturn(trade.entryPrice, trade.exitPrice) != null &&
    trade.quantity != null && Number.isFinite(trade.quantity) && trade.quantity > 0
    ? (trade.exitPrice! - trade.entryPrice!) * trade.quantity : null;
}

function knownAmount(amount: number | null | undefined): amount is number {
  return amount != null && Number.isFinite(amount) && amount >= 0;
}

/** Open trades and incomplete broker statements cannot yield realized net amounts. */
export function tradeNetResult(trade: TradeValues) {
  const gross = trade.exitDate && holdingDays(trade.entryDate, trade.exitDate) != null ? tradePnl(trade) : null;
  const beforeTax = gross != null && knownAmount(trade.entryFees) && knownAmount(trade.exitFees)
    ? gross - trade.entryFees - trade.exitFees : null;
  const afterTax = beforeTax != null && knownAmount(trade.taxWithheld) ? beforeTax - trade.taxWithheld : null;
  const invested = beforeTax != null ? trade.entryPrice! * trade.quantity! + trade.entryFees! : null;
  return {
    gross, beforeTax, afterTax,
    afterTaxReturnPct: afterTax != null && invested != null && invested > 0 ? afterTax / invested * 100 : null,
  };
}
