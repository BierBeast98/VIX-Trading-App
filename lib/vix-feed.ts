import { persistFetch } from './archive/capture';
import { parseMassiveVix, VixFeedError } from './vix-feed-model';
import type { VixQuote } from './yahoo-finance';
export async function fetchMassiveVix(key: string): Promise<VixQuote> {
  const startedAt = new Date(), id = crypto.randomUUID();
  let httpStatus: number | undefined, responseBytes: number | undefined;
  let value: VixQuote | undefined, errorCode: string | undefined;
  try {
    // Fixed host, no redirects, and credentials in a header rather than URLs/logs.
    const response = await fetch('https://api.massive.com/v3/snapshot/indices?ticker=I%3AVIX', {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(12000),
    });
    httpStatus = response.status;
    if (!response.ok) throw new VixFeedError(response.status === 401 ? 'provider_unauthorized' : response.status === 403 ? 'vix_not_entitled' : response.status === 429 ? 'provider_rate_limit' : `provider_http_${response.status}`);
    const body = await response.text(); responseBytes = Buffer.byteLength(body, 'utf8');
    value = parseMassiveVix(JSON.parse(body), Date.now());
    if (value.feedMode !== 'realtime') errorCode = value.feedMode === 'delayed' ? 'provider_delayed' : 'provider_timeframe_unknown';
  } catch (error) {
    errorCode = error instanceof VixFeedError ? error.code : 'provider_unavailable';
  }
  await persistFetch({ id, source: 'massive', instrument: 'MASSIVE:I:VIX', operation: 'index_snapshot', startedAt,
    success: !!value, measurement: 'http_request', httpStatus, responseBytes, errorCode,
    samples: value ? [{ source: 'massive', instrument: 'MASSIVE:I:VIX', kind: 'index_quote', sourceAt: new Date(value.timestamp).toISOString(),
      last: value.price, ...(value.feedMode === 'realtime' ? {} : { quality: value.feedMode === 'delayed' ? 'delayed' : 'unknown_entitlement' }),
      metadata: { symbol: 'I:VIX', timeframe: value.feedMode ?? 'unknown', marketStatus: value.marketStatus ?? null } }] : [],
  });
  if (!value) throw new VixFeedError(errorCode ?? 'provider_unavailable');
  return value;
}
