import { quoteTimestamp } from '@/lib/signals/vontobel-quote';

/** Use the original issuer timestamp, never the time when a DB cache row was written. */
export function freshBid(data: unknown, now: number, maxAge: number): number | null {
  if (!data || typeof data !== 'object') return null;
  const { bid, timestamp } = data as { bid?: unknown; timestamp?: unknown };
  if (typeof bid !== 'number' || !Number.isFinite(bid) || bid <= 0) return null;
  const original = quoteTimestamp(timestamp);
  if (!original) return null;
  const age = now - Date.parse(original);
  return age >= -60_000 && age <= maxAge ? bid : null;
}
