import type { VixQuote } from './yahoo-finance';
export type VixFeedSource = 'yahoo' | 'massive';
export type FeedMode = 'realtime' | 'delayed' | 'unknown';
export class VixFeedError extends Error {
  constructor(public code: string) { super(code); this.name = 'VixFeedError'; }
}
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
const numeric = (value: unknown, fallback = 0): number => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
/** Massive timestamps are nanoseconds since epoch, never the local retrieval time. */
export function parseMassiveVix(payload: unknown, receivedAt: number): VixQuote {
  const data = record(payload);
  if (data.status !== 'OK') throw new VixFeedError('provider_response_error');
  const results = Array.isArray(data.results) ? data.results : [];
  const rows = results.map(record).filter(row => row.ticker === 'I:VIX');
  if (rows.length !== 1) throw new VixFeedError('vix_identity_missing');
  const row = rows[0], session = record(row.session);
  if (row.error) throw new VixFeedError(row.error === 'NOT_ENTITLED' ? 'vix_not_entitled' : 'provider_response_error');
  if (row.type !== 'indices' || numeric(row.value) <= 0) throw new VixFeedError('invalid_vix_quote');
  const ns = row.last_updated;
  let timestamp = 0;
  if (typeof ns === 'string' && /^\d{19}$/.test(ns)) timestamp = Number(BigInt(ns) / 1000000n);
  else if (typeof ns === 'number' && Number.isFinite(ns) && ns >= 1e18 && ns < 1e19) timestamp = Math.floor(ns / 1e6);
  if (!Number.isFinite(timestamp) || timestamp <= 0) throw new VixFeedError('missing_source_timestamp');
  const feedMode = row.timeframe === 'REAL-TIME' ? 'realtime' : row.timeframe === 'DELAYED' ? 'delayed' : 'unknown';
  const price = numeric(row.value), previousClose = numeric(session.previous_close);
  return { symbol: '^VIX', price, timestamp, source: 'massive', feedMode, receivedAt,
    delayMinutes: feedMode === 'realtime' ? 0 : feedMode === 'delayed' ? 15 : null,
    marketStatus: typeof row.market_status === 'string' ? row.market_status : undefined,
    change: numeric(session.change, previousClose > 0 ? price - previousClose : 0),
    changePct: numeric(session.change_percent, previousClose > 0 ? (price / previousClose - 1) * 100 : 0),
    open: numeric(session.open), high: numeric(session.high), low: numeric(session.low), previousClose,
    fiftyTwoWeekHigh: 0, fiftyTwoWeekLow: 0 };
}
export function realtimeVixUsable(quote: VixQuote | null, now = Date.now()): boolean {
  const age = quote ? now - quote.timestamp : NaN;
  return !!quote && quote.source === 'massive' && quote.feedMode === 'realtime' && quote.marketStatus !== 'closed' &&
    Number.isFinite(quote.price) && quote.price > 0 && Number.isFinite(age) && age >= -60000 && age <= 300000;
}
