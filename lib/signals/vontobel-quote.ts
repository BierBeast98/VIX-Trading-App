import type { Config, Quote } from './engine';
export type Point = { timestamp?: number; bid?: number; ask?: number; close?: number };
export type Series = { isProduct?: boolean; points?: Point[] };
type Price = { bid?: number; ask?: number; latest?: number; latestTimestamp?: string; bidTimestamp?: string; askTimestamp?: string };
export type IssuerMetadata = { data?: { isin?: string; isActive?: boolean; currency?: string; direction?: number };
  price?: Price; underlyings?: { symbol?: string; price?: Price }[] };
export function quoteTimestamp(value: unknown): string | null {
  const date = typeof value === 'string' ? new Date(value) : typeof value === 'number' && Number.isFinite(value) && value > 0 ? new Date(value < 1e12 ? value * 1000 : value) : null;
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
const newest = (points: Point[] = []) => [...points].filter(p => typeof p.timestamp === 'number').sort((a, b) => b.timestamp! - a.timestamp!)[0];
const positive = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
/** latestTimestamp dates the issuer's current price snapshot. Never substitute retrieval time. */
export function issuerQuote(cfg: Config, meta: IssuerMetadata | null, series: Series[]): Pick<Quote, 'bid' | 'ask' | 'productAt' | 'askAt' | 'future' | 'futureAt' | 'productValid' | 'issuerStatus' | 'error'> {
  const p = meta?.price, u = meta?.underlyings?.[0];
  const product = newest(series.find(s => s.isProduct === true)?.points);
  const productAt = quoteTimestamp(p?.bidTimestamp ?? p?.latestTimestamp);
  const askAt = quoteTimestamp(p?.askTimestamp ?? p?.latestTimestamp);
  const futureAt = quoteTimestamp(u?.price?.latestTimestamp);
  const productData = meta?.data;
  const issuerStatus: Quote['issuerStatus'] = !productData?.isin ? 'unavailable'
    : productData.isin !== cfg.isin ? 'mismatch'
    : productData.isActive === false ? 'inactive'
    : productData.isActive !== true ? 'unavailable'
    : productData.currency !== 'EUR' || productData.direction !== 1 || u?.symbol !== cfg.futureSymbol ? 'mismatch'
    : 'active';
  const error = {
    unavailable: 'Produktstatus beim Emittenten nicht verfügbar.',
    mismatch: 'Produktdaten oder VX-Basisvertrag weichen von der geprüften Zuordnung ab.',
    inactive: 'Prüfprodukt beim Emittenten inaktiv.',
    active: undefined,
  }[issuerStatus];
  const correctIsin = productData?.isin === cfg.isin;
  const liveBid = correctIsin && positive(p?.bid) && productAt !== null;
  const liveAsk = correctIsin && positive(p?.ask) && askAt !== null;
  const liveFuture = issuerStatus === 'active' && positive(u?.price?.latest) && futureAt !== null;
  return {
    bid: liveBid ? p!.bid! : product?.bid ?? null,
    ask: liveAsk ? p!.ask! : product?.ask ?? null,
    productAt: liveBid ? productAt : quoteTimestamp(product?.timestamp),
    askAt: liveAsk ? askAt : product?.ask != null ? quoteTimestamp(product.timestamp) : null,
    future: liveFuture ? u!.price!.latest! : null,
    futureAt: liveFuture ? futureAt : null, productValid: issuerStatus === 'active', issuerStatus,
    error: error ?? (!(liveAsk || positive(product?.ask)) ? 'Die Kursquelle liefert keinen datierten Briefkurs; Kaufsignale bleiben gesperrt.' : undefined),
  };
}
