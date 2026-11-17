import { createHash } from 'node:crypto';
export type Sample = { source: string; instrument: string; kind: string; currency?: string | null;
  isin?: string | null; contract?: string | null; sourceAt?: string | null; quality?: string;
  last?: number | null; bid?: number | null; ask?: number | null; open?: number | null;
  high?: number | null; low?: number | null; close?: number | null; volume?: number | null;
  metadata?: Record<string, string | number | boolean | null> };
export function iso(value: unknown): string | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  if (typeof value === 'number' && (!Number.isFinite(value) || value <= 0)) return null;
  const d = new Date(typeof value === 'number' && value < 1e12 ? value * 1000 : value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}
const numeric = (v: unknown): number | null => typeof v === 'number' && Number.isFinite(v) ? v : null;
const positive = (v: unknown): number | null => { const n = numeric(v); return n !== null && n > 0 ? n : null; };
export function quality(sample: Sample, receivedAt: Date): string {
  if (!sample.sourceAt || !Number.isFinite(Date.parse(sample.sourceAt))) return 'missing_timestamp';
  const age = receivedAt.getTime() - Date.parse(sample.sourceAt);
  if (age < -60000) return 'future_timestamp';
  if (sample.quality) return sample.quality;
  return age > 5 * 60000 ? 'stale' : 'fresh';
}
export function sampleKey(sample: Sample, fetchId: string): string {
  // A changed value at the same source timestamp is a separate revision; unchanged values deduplicate.
  return createHash('sha256').update(JSON.stringify([sample.source,sample.instrument,sample.kind,
    sample.currency ?? null,sample.isin ?? null,sample.contract ?? null,sample.sourceAt ?? fetchId,
    sample.last ?? null,sample.bid ?? null,sample.ask ?? null,sample.open ?? null,
    sample.high ?? null,sample.low ?? null,sample.close ?? null,sample.volume ?? null])).digest('hex');
}
export function yahooSamples(symbol: string, operation: string, result: unknown): Sample[] {
  const data = result as Record<string, unknown> | null;
  if (!data) return [];
  const base = { source: 'yahoo', instrument: `YAHOO:${symbol}`, currency: typeof data.currency === 'string' ? data.currency : null };
  if (operation === 'quote') {
    const last = positive(data.regularMarketPrice); if (last === null) return [];
    return [{ ...base, kind: symbol === '^VIX3M' ? 'index_proxy_quote' : symbol === '^VIX' ? 'index_quote' : 'market_quote',
      sourceAt: iso(data.regularMarketTime), last,
      ...(symbol === '^VIX' ? { quality: 'delayed' } : {}),
      metadata: { symbol, proxyForVx: symbol === '^VIX3M', priceField: 'regularMarketPrice', ...(symbol === '^VIX' ? { feedMode: 'delayed', delayMinutes: 15 } : {}) } }];
  }
  const rows = Array.isArray(result) ? result : Array.isArray(data.quotes) ? data.quotes : [];
  return rows.flatMap((r: Record<string, unknown>) => {
    if (positive(r.close) === null || !iso(r.date)) return [];
    return [{ ...base, kind: operation === 'historical' ? 'daily_bar' : 'intraday_bar', sourceAt: iso(r.date), quality: 'historical',
      open: numeric(r.open), high: numeric(r.high), low: numeric(r.low), close: numeric(r.close), volume: numeric(r.volume),
      metadata: { symbol, proxyForVx: symbol === '^VIX3M' } }];
  });
}
export function vontobelSamples(text: string, isin: string, type: 'page' | 'chart'): Sample[] {
  if (type === 'page') {
    const match = text.match(/<script[^>]*>(\{"props":\{"pageProps":.*?})<\/script>/s);
    if (!match) return [];
    const m = JSON.parse(match[1])?.props?.pageProps?.additionalData;
    if (m?.data?.isin !== isin) return [];
    const samples: Sample[] = []; const p = m.price;
    if (positive(p?.bid) !== null || positive(p?.ask) !== null) samples.push({ source: 'vontobel', instrument: `ISIN:${isin}`, isin, kind: 'certificate_quote', currency: m.data.currency ?? null,
      sourceAt: iso(p?.latestTimestamp), bid: positive(p?.bid), ask: positive(p?.ask), last: positive(p?.latest),
      metadata: { active: m.data.isActive === true, direction: m.data.direction ?? null, timestampField: 'price.latestTimestamp' } });
    for (const u of m.underlyings ?? []) {
      if (typeof u.symbol !== 'string' || positive(u.price?.latest) === null) continue;
      samples.push({ source: 'vontobel', instrument: `VX:${u.symbol}`, isin, contract: u.symbol, kind: 'future_quote', currency: u.price.currency ?? u.currency ?? null,
        sourceAt: iso(u.price.latestTimestamp), last: positive(u.price.latest),
        ...(m.data.isActive === true ? {} : { quality: 'unverified_contract' }),
        metadata: { underlyingName: String(u.name ?? ''), associatedProduct: isin, mapping: 'issuer_current_snapshot', activeProduct: m.data.isActive === true } });
    }
    return samples;
  }
  const chart = JSON.parse(text); const result: Sample[] = [];
  for (const s of chart?.payload?.series ?? []) for (const p of s.points ?? []) {
    const value = positive(s.isProduct ? p.bid : p.close); const at = iso(p.timestamp);
    if (value === null || at === null) continue;
    result.push({ source: 'vontobel', isin, instrument: s.isProduct ? `ISIN:${isin}` : `UNVERIFIED_UNDERLYING_SERIES:${isin}`,
      kind: s.isProduct ? 'certificate_bid_point' : 'unverified_underlying_point', sourceAt: at,
      quality: s.isProduct ? 'historical' : 'unverified_contract', ...(s.isProduct ? { bid: value } : { close: value }),
      metadata: { priceIdentifier: String(s.priceIdentifier ?? ''), note: s.isProduct ? 'Bid-Stichprobe, keine OHLC-Kerze' : 'Historische Kontraktidentität nicht pro Punkt ausgewiesen; kein einzelner VX-Kontrakt' } });
  }
  return result;
}
export function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  // Prevent spreadsheet formulas in provider metadata/identifiers.
  const safe = typeof value === 'string' && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g,'""')}"`;
}
