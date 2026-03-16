import { NextRequest, NextResponse } from "next/server";
import { getVixHistory, getVix3MHistory, getSP500History, getVixIntraday, getVixFuturesIntraday } from "@/lib/yahoo-finance";
import { prisma } from "@/lib/prisma";
import { saveIntradayData, getStoredIntraday, mergeIntradayData } from "@/lib/vix-intraday-store";

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

      return NextResponse.json({ vix, vix3m });
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

    // Try cache (DB optional)
    try {
      const cached = await prisma.vixCache.findUnique({ where: { id: cacheKey } });
      if (cached && Date.now() - cached.updatedAt.getTime() < cacheTTL) {
        return NextResponse.json(cached.data);
      }
    } catch { /* DB not yet configured */ }

    const [vixHistory, vix3mHistory, sp500History] = await Promise.all([
      getVixHistory(days),
      getVix3MHistory(days),
      getSP500History(days),
    ]);

    const data = { vix: vixHistory, vix3m: vix3mHistory, sp500: sp500History, period, days };

    // Try to persist cache (DB optional)
    try {
      if (vixHistory.length > 0) {
        const closes = vixHistory.map((h) => h.close);
        await prisma.vixCache.upsert({
          where: { id: "history_closes" },
          update: { data: { closes } as any },
          create: { id: "history_closes", data: { closes } as any },
        });
      }
      await prisma.vixCache.upsert({
        where: { id: cacheKey },
        update: { data: data as any },
        create: { id: cacheKey, data: data as any },
      });
    } catch { /* DB not yet configured */ }

    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
