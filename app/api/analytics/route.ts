import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcPerformanceMetrics, suggestPositionSize } from "@/lib/analytics";
import { memGet, memSet } from "@/lib/server-cache";

const CACHE_KEY = "analytics_result";
const CACHE_TTL = 60_000; // 60s — trades are rarely added; stale data is acceptable

export async function GET() {
  // In-memory cache — avoids full trade table scan + metric computation on every request
  const cached = memGet<object>(CACHE_KEY);
  if (cached) {
    return NextResponse.json(cached, { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" } });
  }

  try {
    let trades: Awaited<ReturnType<typeof prisma.trade.findMany>> = [];
    let settings: Awaited<ReturnType<typeof prisma.settings.findUnique>> = null;
    try {
      [trades, settings] = await Promise.all([
        prisma.trade.findMany({ orderBy: { entryDate: "asc" } }),
        prisma.settings.findUnique({ where: { id: 1 } }),
      ]);
    } catch { /* DB not configured */ }

    const metrics = calcPerformanceMetrics(
      trades.map((t) => ({
        ...t,
        entryDate: t.entryDate,
        exitDate: t.exitDate,
        returnPct: t.returnPct,
        holdDays: t.holdDays,
      }))
    );

    // Entry level analysis
    const closedWithReturn = trades.filter(
      (t) => t.exitDate && t.returnPct !== null
    );

    const entryBuckets: Record<string, { count: number; totalReturn: number; wins: number }> = {};
    for (const trade of closedWithReturn) {
      const bucket = `${Math.floor(trade.entryVix / 2) * 2}-${Math.floor(trade.entryVix / 2) * 2 + 2}`;
      if (!entryBuckets[bucket]) entryBuckets[bucket] = { count: 0, totalReturn: 0, wins: 0 };
      entryBuckets[bucket].count++;
      entryBuckets[bucket].totalReturn += trade.returnPct ?? 0;
      if ((trade.returnPct ?? 0) > 0) entryBuckets[bucket].wins++;
    }

    const entryAnalysis = Object.entries(entryBuckets)
      .map(([range, data]) => ({
        range,
        count: data.count,
        avgReturn: data.count > 0 ? data.totalReturn / data.count : 0,
        winRate: data.count > 0 ? data.wins / data.count : 0,
      }))
      .sort((a, b) => a.range.localeCompare(b.range));

    const result = { metrics, entryAnalysis, riskBudget: settings?.riskBudget ?? 10000 };
    memSet(CACHE_KEY, result, CACHE_TTL);
    return NextResponse.json(result, { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" } });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
