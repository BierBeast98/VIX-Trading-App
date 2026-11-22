import type { Config } from '@/lib/signals/engine';
import { iso, type Sample } from './normalize';

type VerifiedTarget = Pick<Config, 'isin' | 'productVerified' | 'futureSymbol' | 'futureExpiry' | 'barrier'>;
export type ArchiveTarget = VerifiedTarget | { isin: string; held: true };

function validIsin(isin: string): boolean {
  if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) return false;
  const digits = isin.replace(/[A-Z]/g, char => String(char.charCodeAt(0) - 55)).split('').reverse();
  const sum = digits.reduce((total, char, i) => {
    const value = Number(char) * (i % 2 === 0 ? 1 : 2);
    return total + (value > 9 ? value - 9 : value);
  }, 0);
  return sum % 10 === 0;
}

export function verifiedArchiveTarget(target: ArchiveTarget): target is VerifiedTarget {
  return !('held' in target) && target.productVerified && validIsin(target.isin) &&
    /^[A-Z0-9]+$/i.test(target.futureSymbol) && /^\d{4}-\d{2}-\d{2}$/.test(target.futureExpiry) &&
    Number.isFinite(target.barrier) && target.barrier > 0;
}

export function eligibleArchiveTarget(target: ArchiveTarget): boolean {
  return 'held' in target ? validIsin(target.isin) : verifiedArchiveTarget(target);
}

type IssuerPrice = { latest?: unknown; bid?: unknown; ask?: unknown; latestTimestamp?: unknown; bidTimestamp?: unknown; askTimestamp?: unknown; currency?: unknown };
type IssuerData = {
  data?: { isin?: unknown; isActive?: unknown; currency?: unknown; direction?: unknown; barrier?: unknown; barrierLevel?: unknown; stopLossBarrier?: unknown; stopLoss?: unknown; strikePrice?: unknown; ratio?: unknown; financingSpread?: unknown; isEndOfLifeComplete?: unknown };
  price?: IssuerPrice;
  underlyings?: { symbol?: unknown; name?: unknown; currency?: unknown; price?: IssuerPrice }[];
};
const positive = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
const label = (value: unknown) => typeof value === 'string' && value ? value : null;

export function strategyIssuerSamples(target: ArchiveTarget, issuer: IssuerData | null): Sample[] {
  if (!eligibleArchiveTarget(target)) return [];
  const configured = verifiedArchiveTarget(target) ? target : null;
  const data = issuer?.data?.isin === target.isin ? issuer.data : null;
  const underlying = data && Array.isArray(issuer?.underlyings) ? issuer.underlyings[0] : null;
  const observedSymbol = label(underlying?.symbol);
  const active = typeof data?.isActive === 'boolean' ? data.isActive : null;
  const status = active === null ? 'unavailable' : !active ? 'inactive' :
    !configured ? 'active_unmapped' : data?.currency !== 'EUR' || data.direction !== 1 ? 'product_ineligible' :
    observedSymbol !== configured.futureSymbol ? 'mapping_mismatch' : 'active';
  const mappingVerified = status === 'active';
  const metadata = {
    status, active, mappingVerified,
    productIsin: target.isin, observedSymbol, configuredSymbol: configured?.futureSymbol ?? null,
    underlyingName: label(underlying?.name), configuredBarrier: configured?.barrier ?? null,
    barrier: positive(data?.stopLoss) ?? positive(data?.stopLossBarrier) ?? positive(data?.barrierLevel) ?? positive(data?.barrier),
    strikePrice: positive(data?.strikePrice), ratio: positive(data?.ratio), financingSpread: positive(data?.financingSpread),
    endOfLifeComplete: typeof data?.isEndOfLifeComplete === 'boolean' ? data.isEndOfLifeComplete : null,
    futureExpiry: mappingVerified ? configured?.futureExpiry ?? null : null,
    configuredFutureExpiry: configured?.futureExpiry ?? null,
  };
  const product = { source: 'vontobel', instrument: `ISIN:${target.isin}`, isin: target.isin,
    currency: label(data?.currency), contract: mappingVerified ? observedSymbol : null };
  const samples: Sample[] = [{ ...product, kind: 'strategy_product_status', quality: 'status_observed', metadata }];

  if (status !== 'active' && status !== 'mapping_mismatch' && status !== 'active_unmapped') return samples;
  const price = issuer?.price;
  const bidAt = iso(price?.bidTimestamp ?? price?.latestTimestamp);
  const askAt = iso(price?.askTimestamp ?? price?.latestTimestamp);
  const bid = bidAt ? positive(price?.bid) : null;
  const ask = askAt ? positive(price?.ask) : null;

  if (bid !== null || ask !== null) {
    samples.push({ ...product, kind: 'strategy_certificate_quote', sourceAt: bid !== null ? bidAt : askAt,
      bid, ask, metadata: { ...metadata, bidSourceAt: bid !== null ? bidAt : null, askSourceAt: ask !== null ? askAt : null } });
  }

  const futurePrice = underlying?.price;
  const futureAt = iso(futurePrice?.latestTimestamp);
  const last = positive(futurePrice?.latest);
  if (mappingVerified && futureAt && last !== null) {
    samples.push({ source: 'vontobel', instrument: `VX:${observedSymbol}`, isin: target.isin,
      kind: 'strategy_vx_quote', contract: observedSymbol, currency: label(futurePrice?.currency) ?? label(underlying?.currency),
      sourceAt: futureAt, last, metadata });
  }
  return samples;
}

export function strategyIssuerPageSamples(text: string, target: ArchiveTarget): Sample[] {
  const match = text.match(/<script[^>]*>(\{"props":\{"pageProps":.*?})<\/script>/s);
  try {
    return strategyIssuerSamples(target, match ? JSON.parse(match[1])?.props?.pageProps?.additionalData ?? null : null);
  } catch {
    return strategyIssuerSamples(target, null);
  }
}
