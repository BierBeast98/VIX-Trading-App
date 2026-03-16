import { prisma } from "./prisma";

interface IntradayPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Save intraday data points to DB. Skips duplicates via upsert on (symbol, timestamp).
 */
export async function saveIntradayData(
  symbol: "VIX" | "FUTURES",
  points: IntradayPoint[]
): Promise<number> {
  if (points.length === 0) return 0;

  // Filter valid points
  const valid = points.filter(
    (p) => p.close != null && p.close > 0 && p.date
  );
  if (valid.length === 0) return 0;

  // Batch upsert — skipDuplicates for efficiency
  const data = valid.map((p) => ({
    symbol,
    timestamp: new Date(p.date),
    open: p.open ?? 0,
    high: p.high ?? 0,
    low: p.low ?? 0,
    close: p.close,
    volume: p.volume ?? 0,
  }));

  try {
    const result = await prisma.vixIntraday.createMany({
      data,
      skipDuplicates: true,
    });
    return result.count;
  } catch (err) {
    console.error(`Error saving ${symbol} intraday data:`, err);
    return 0;
  }
}

/**
 * Get stored intraday data for a symbol within a time range.
 */
export async function getStoredIntraday(
  symbol: "VIX" | "FUTURES",
  from: Date,
  to: Date
): Promise<IntradayPoint[]> {
  try {
    const rows = await prisma.vixIntraday.findMany({
      where: {
        symbol,
        timestamp: { gte: from, lte: to },
      },
      orderBy: { timestamp: "asc" },
    });

    return rows.map((r) => ({
      date: r.timestamp.toISOString(),
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      volume: r.volume,
    }));
  } catch (err) {
    console.error(`Error reading ${symbol} intraday data:`, err);
    return [];
  }
}

/**
 * Merge fresh API data with stored DB data, deduplicated by timestamp.
 * Fresh data wins on conflict.
 */
export function mergeIntradayData(
  stored: IntradayPoint[],
  fresh: IntradayPoint[]
): IntradayPoint[] {
  const map = new Map<string, IntradayPoint>();

  for (const p of stored) {
    map.set(new Date(p.date).toISOString(), p);
  }
  // Fresh data overwrites stored on same timestamp
  for (const p of fresh) {
    map.set(new Date(p.date).toISOString(), p);
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}
