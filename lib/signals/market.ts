import { trackedVontobel } from '@/lib/archive/capture';
import { realtimeVixUsable } from '@/lib/vix-feed-model';
import { getVixSpot, type VixQuote } from '@/lib/yahoo-finance';
import { prisma } from '@/lib/prisma';
import type { Config, Quote } from './engine';
import { issuerQuote, quoteTimestamp, type IssuerMetadata, type Series } from './vontobel-quote';
async function sharedVixSpot(cfg: Config) {
  if (cfg.vixEntryPolicy !== 'delayed20') return getVixSpot();
  try {
    const row = await prisma.marketObservation.findFirst({ where: {
      source: 'yahoo', instrument: 'YAHOO:^VIX', kind: 'index_quote',
      receivedAt: { gte: new Date(Date.now() - 4 * 60000) },
      sourceAt: { gte: new Date(Date.now() - 20 * 60000), lte: new Date(Date.now() + 60000) },
      last: { gt: 0 },
    }, orderBy: { receivedAt: 'desc' } });
    if (row?.last && row.sourceAt) return { price: row.last, timestamp: row.sourceAt.getTime(), source: 'yahoo' as const, feedMode: 'delayed' as const };
  } catch { /* A direct source fetch is safer if the archive is unavailable. */ }
  return getVixSpot({ allowRealtime: false });
}
export async function loadQuote(cfg: Config): Promise<Quote> {
  const empty: Quote = { isin: cfg.isin, at: new Date().toISOString(), vix: null, vixAt: null, vixRealtime: false, future: null, futureAt: null, bid: null, ask: null, productAt: null };
  const validIsin = /^[A-Z0-9]{12}$/.test(cfg.isin);
  const [spot, chart, page] = await Promise.allSettled([
    sharedVixSpot(cfg),
    validIsin ? trackedVontobel(`https://markets.vontobel.com/api/v1/charts/products/${cfg.isin}/detail/0?c=de-de`, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store', signal: AbortSignal.timeout(12000),
    }).then(async r => { if (!r.ok) throw new Error('Kursquelle nicht verfügbar'); return r.json(); }) : Promise.resolve(null),
    validIsin ? trackedVontobel(`https://markets.vontobel.com/de-de/produkte/hebel/mini-futures/${cfg.isin}`, { cache: 'no-store', signal: AbortSignal.timeout(12000) }, cfg).then(r => {
      if (!r.ok) throw new Error('Emittentenstatus nicht verfügbar');
      return r.text();
    }) : Promise.resolve(''),
  ]);
  const vix = spot.status === 'fulfilled' ? spot.value : null;
  const series: Series[] = chart.status === 'fulfilled' && Array.isArray(chart.value?.payload?.series) ? chart.value.payload.series : [];
  const match = page.status === 'fulfilled' ? page.value.match(/<script[^>]*>(\{"props":\{"pageProps":.*?})<\/script>/s) : null;
  let meta: IssuerMetadata | null = null;
  try { meta = match ? JSON.parse(match[1]).props.pageProps.additionalData : null; } catch { /* fail closed */ }
  return { ...empty, vix: vix?.price ?? null, vixAt: quoteTimestamp(vix?.timestamp), vixRealtime: realtimeVixUsable(vix as VixQuote | null), vixSource: vix?.source, vixFeedMode: vix?.feedMode, vixFeedError: vix && 'feedError' in vix ? vix.feedError : undefined, ...issuerQuote(cfg, meta, series) };
}
