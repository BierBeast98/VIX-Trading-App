import { NextRequest, NextResponse } from "next/server";
import { getVixHistory, getVix3MHistory, getSP500History, getVixIntraday, getVixFuturesIntraday } from "@/lib/yahoo-finance";
import { prisma } from "@/lib/prisma";
import { saveIntradayData, getStoredIntraday, mergeIntradayData } from "@/lib/vix-intraday-store";
import { memGet, memSet } from "@/lib/server-cache";

async function getVontobelIsin(): Promise<string | undefined> {
  try {
    const settings = await prisma.settings.findUnique({ where: { id: 1 }, select: { vontobelIsin: true } });
    return settings?.vontobelIsin || undefined;
  } catch { return undefined; }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "1m";
  const type = searchParams.get("type") || "daily";

  try {
    if (type === "intraday") {
      // In-memory cache for intraday (5 min TTL — aligns with client refreshInterval)
      const hit = memGet<object>("intraday");
      if (hit) return NextResponse.json(hit, { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=60" } });

      const isin = await getVontobelIsin();
      const [freshVix, freshFutures] = await Promise.all([
        getVixIntraday(),
        getVixFuturesIntraday(isin),
      ]);

      // Persist new data points to DB (non-blocking)
      saveIntradayData("VIX", freshVix).catch(() => {});
      saveIntradayData("FUTURES", freshFutures).catch(() => {});

      // Load stored data for last 3 days (covers weekends) and merge with fresh
      const from = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const to = new Date();
      const [storedVix, storedFutures] = await Promise.all([
        getStoredIntraday("VIX", from, to),
        getStoredIntraday("FUTURES", from, to),
      ]);

      const vix = mergeIntradayData(storedVix, freshVix);
      const vix3m = mergeIntradayData(storedFutures, freshFutures);
      const result = { vix, vix3m };

      memSet("intraday", result, 300_000);
      return NextResponse.json(result, { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=60" } });
    }

    const days =
      period === "1w" ? 7
      : period === "1m" ? 30
      : period === "3m" ? 90
      : period === "5y" ? 1825
      : period === "10y" ? 3650
      : 365; // default 1y
    const cacheKey = `history_${period}`;
    const cacheTTL = days <= 30 ? 5 * 60_000 : 60 * 60_000;
    // CDN cache: short periods 5 min, long periods 1 hour
    const cdnTTL = days <= 7 ? 120 : days <= 90 ? 300 : 3600;
    const histCC = { "Cache-Control": `s-maxage=${cdnTTL}, stale-while-revalidate=${cdnTTL * 2}` };

    // In-memory cache
    const memHit = memGet<object>(cacheKey);
    if (memHit) return NextResponse.json(memHit, { headers: histCC });

    // DB cache (DB optional)
    try {
      const cached = await prisma.vixCache.findUnique({ where: { id: cacheKey } });
      if (cached && Date.now() - cached.updatedAt.getTime() < cacheTTL) {
        memSet(cacheKey, cached.data as object, cacheTTL);
        return NextResponse.json(cached.data, { headers: histCC });
      }
    } catch { /* DB not yet configured */ }

    const [vixHistory, vix3mHistory, sp500History] = await Promise.all([
      getVixHistory(days),
      getVix3MHistory(days),
      getSP500History(days),
    ]);

    const data = { vix: vixHistory, vix3m: vix3mHistory, sp500: sp500History, period, days };

    memSet(cacheKey, data, cacheTTL);

    // Persist to DB async — don't block the response
    Promise.all([
      vixHistory.length > 0
        ? prisma.vixCache.upsert({
            where: { id: "history_closes" },
            update: { data: { closes: vixHistory.map((h) => h.close) } as any },
            create: { id: "history_closes", data: { closes: vixHistory.map((h) => h.close) } as any },
          })
        : Promise.resolve(),
      prisma.vixCache.upsert({
        where: { id: cacheKey },
        update: { data: data as any },
        create: { id: cacheKey, data: data as any },
      }),
    ]).catch(() => {});

    return NextResponse.json(data, { headers: histCC });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
