import { trackedVontobel } from '@/lib/archive/capture';
/**
 * GET /api/vontobel/batch?isins=ISIN1,ISIN2,...
 *
 * Fetches both price data and intraday chart data for multiple ISINs in a
 * single request. Replaces the per-position individual price + intraday calls
 * on the dashboard (N positions × 2 calls → 1 call).
 *
 * Uses the same in-memory cache keys as the individual routes so both share
 * the same warm cache within the Node.js process.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVontobelCertificateIntraday } from "@/lib/yahoo-finance";
import { memGet, memSet } from "@/lib/server-cache";

const PRICE_TTL = 300_000; // 5 min — aligns with client refreshInterval
const INTRADAY_TTL = 300_000;
const CC = { "Cache-Control": "s-maxage=300, stale-while-revalidate=60" };
const MAX_ISINS = 20;

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: "https://markets.vontobel.com/",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "de-DE,de;q=0.9",
};

async function getPrice(isin: string): Promise<object> {
  const key = `vontobel_${isin}`;

  // 1. In-memory cache (shared with /api/vontobel/price)
  const hit = memGet<object>(key);
  if (hit) return hit;

  // 2. DB cache
  try {
    const row = await prisma.vixCache.findUnique({ where: { id: key } });
    if (row && Date.now() - row.updatedAt.getTime() < PRICE_TTL) {
      memSet(key, row.data as object, PRICE_TTL);
      return row.data as object;
    }
  } catch { /* DB optional */ }

  // 3. Fresh fetch from Vontobel chart API
  try {
    const resp = await trackedVontobel(
      `https://markets.vontobel.com/api/v1/charts/products/${isin}/detail/0?c=de-de`,
      { headers: FETCH_HEADERS, next: { revalidate: 0 } }
    );
    if (!resp.ok) {
      console.error(`[vontobel/batch] ${isin}: HTTP ${resp.status}`);
      return { isin, bid: null, underlying: null, timestamp: null };
    }

    const json = await resp.json();
    const series: any[] = json?.payload?.series ?? [];
    const productSeries = series.find((s) => s.isProduct === true);
    const underlyingSeries = series.find((s) => s.isProduct === false);

    const rawBid = productSeries?.points?.[0]?.bid;
    const bid = typeof rawBid === "number" && Number.isFinite(rawBid) && rawBid > 0 ? rawBid : null;
    const data = {
      isin,
      bid,
      underlying: underlyingSeries?.points?.[0]?.close ?? null,
      timestamp: productSeries?.points?.[0]?.timestamp ?? null,
    };

    memSet(key, data, PRICE_TTL);
    prisma.vixCache
      .upsert({ where: { id: key }, update: { data: data as any }, create: { id: key, data: data as any } })
      .catch((e) => console.error(`[vontobel/batch] cache upsert ${isin}:`, e));

    // Letzten bekannten Preis an der Position pflegen — dient als Fallback,
    // wenn Vontobel später nicht erreichbar ist (statt ewig alter Einstiegspreis)
    if (bid != null) {
      prisma.position
        .updateMany({ where: { certificateId: isin, status: "open" }, data: { currentPrice: bid } })
        .catch((e) => console.error(`[vontobel/batch] currentPrice update ${isin}:`, e));
    }

    return data;
  } catch (err) {
    console.error(`[vontobel/batch] ${isin}:`, err);
    return { isin, bid: null, underlying: null, timestamp: null };
  }
}

async function getIntraday(isin: string): Promise<unknown[]> {
  const key = `cert_intraday_${isin}`;

  // In-memory cache (shared with /api/vontobel/intraday)
  const hit = memGet<unknown[]>(key);
  if (hit) return hit;

  try {
    const data = await getVontobelCertificateIntraday(isin);
    memSet(key, data, INTRADAY_TTL);
    return data;
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const isinsParam = req.nextUrl.searchParams.get("isins");
  if (!isinsParam) {
    return NextResponse.json({ error: "Missing isins parameter" }, { status: 400 });
  }

  const isins = isinsParam
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z0-9]{12}$/.test(s))
    .slice(0, MAX_ISINS);

  if (isins.length === 0) {
    return NextResponse.json({ error: "No valid ISINs provided" }, { status: 400 });
  }

  // Fetch all prices and intraday data fully in parallel
  const [priceResults, intradayResults] = await Promise.all([
    Promise.all(isins.map(getPrice)),
    Promise.all(isins.map(getIntraday)),
  ]);

  const prices: Record<string, object> = {};
  const intraday: Record<string, unknown[]> = {};
  for (let i = 0; i < isins.length; i++) {
    prices[isins[i]] = priceResults[i];
    intraday[isins[i]] = intradayResults[i];
  }

  return NextResponse.json({ prices, intraday }, { headers: CC });
}
