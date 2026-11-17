import { getVixSpot } from '@/lib/yahoo-finance';
import type { Config, Quote } from './engine';
import { issuerQuote, quoteTimestamp, type IssuerMetadata, type Series } from './vontobel-quote';
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
  let meta: IssuerMetadata | null = null;
  try { meta = match ? JSON.parse(match[1]).props.pageProps.additionalData : null; } catch { /* fail closed */ }
  return { ...empty, vix: vix?.price ?? null, vixAt: quoteTimestamp(vix?.timestamp), ...issuerQuote(cfg, meta, series) };
}
