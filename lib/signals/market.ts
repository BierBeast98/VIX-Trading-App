import { getVixSpot } from '@/lib/yahoo-finance';
import type { Config, Quote } from './engine';
type Point = { timestamp?: number; bid?: number; ask?: number; close?: number };
type Series = { isProduct?: boolean; points?: Point[] };
const timestamp = (value: unknown): string | null => {
  if (typeof value === 'string') { const n = Date.parse(value); return Number.isFinite(n) ? new Date(n).toISOString() : null; }
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  const date = new Date(value < 1e12 ? value * 1000 : value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};
const newest = (points: Point[] = []) => [...points].filter(p => typeof p.timestamp === 'number').sort((a, b) => b.timestamp! - a.timestamp!)[0];
export async function loadQuote(cfg: Config): Promise<Quote> {
  const empty: Quote = { isin: cfg.isin, at: new Date().toISOString(), vix: null, vixAt: null, future: null, futureAt: null, bid: null, ask: null, productAt: null };
  if (!/^[A-Z0-9]{12}$/.test(cfg.isin)) return { ...empty, error: 'Bitte zuerst ein Long-Zertifikat hinterlegen' };
  const [spot, chart, page] = await Promise.allSettled([
    getVixSpot(),
    fetch(`https://markets.vontobel.com/api/v1/charts/products/${cfg.isin}/detail/0?c=de-de`, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store', signal: AbortSignal.timeout(12000),
    }).then(async r => { if (!r.ok) throw new Error('Kursquelle nicht verfügbar'); return r.json(); }),
    fetch(`https://markets.vontobel.com/de-de/produkte/hebel/mini-futures/${cfg.isin}`, { cache: 'no-store', signal: AbortSignal.timeout(12000) }).then(r => r.text()),
  ]);
  const vix = spot.status === 'fulfilled' ? spot.value : null;
  const series: Series[] = chart.status === 'fulfilled' && Array.isArray(chart.value?.payload?.series) ? chart.value.payload.series : [];
  const match = page.status === 'fulfilled' ? page.value.match(/<script[^>]*>(\{"props":\{"pageProps":.*?})<\/script>/s) : null;
  let meta; try { meta = match ? JSON.parse(match[1]).props.pageProps.additionalData : null; } catch { meta = null; }
  const verified = meta?.data?.isin === cfg.isin && meta?.data?.isActive === true && meta?.data?.currency === 'EUR' && meta?.underlyings?.[0]?.symbol === cfg.futureSymbol;
  const price = meta?.price;
  const product = newest(series.find(s => s.isProduct === true)?.points);
  const future = newest(series.find(s => s.isProduct === false)?.points);
  return { ...empty, vix: vix?.price ?? null, vixAt: timestamp(vix?.timestamp),
    // Only the selected certificate's underlying series, never ^VIX3M.
    future: future?.close ?? null, futureAt: timestamp(future?.timestamp),
    bid: product?.bid ?? price?.bid ?? null, ask: product?.ask ?? price?.ask ?? null,
    productAt: product?.bid != null ? timestamp(product.timestamp) : timestamp(price?.bidTimestamp),
    askAt: product?.ask != null ? timestamp(product.timestamp) : timestamp(price?.askTimestamp), productValid: verified,
    error: !verified ? 'Produkt nicht aktiv, nicht in EUR oder VX-Basisvertrag stimmt nicht mit der geprüften Zuordnung überein.' : !(product?.ask ?? price?.ask) ? 'Die aktuelle Kursquelle liefert keinen Briefkurs. Kaufsignale bleiben gesperrt, bis echte Geld-/Briefkurse verfügbar sind.' : undefined };
}
