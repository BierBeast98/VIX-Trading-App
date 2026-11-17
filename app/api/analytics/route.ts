import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcPerformanceMetrics } from "@/lib/analytics";
import { holdingDays, tradeReturn } from "@/lib/trade-metrics";

export async function GET() {
  try {
    const trades = await prisma.trade.findMany({ orderBy: { entryDate: "asc" } });

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
      (t) => t.exitDate && holdingDays(t.entryDate, t.exitDate) != null && tradeReturn(t) != null && Number.isFinite(t.entryVix) && t.entryVix > 0
    );

    const entryBuckets: Record<string, { count: number; totalReturn: number; wins: number }> = {};
    for (const trade of closedWithReturn) {
      const bucket = `${Math.floor(trade.entryVix / 2) * 2}-${Math.floor(trade.entryVix / 2) * 2 + 2}`;
      if (!entryBuckets[bucket]) entryBuckets[bucket] = { count: 0, totalReturn: 0, wins: 0 };
      entryBuckets[bucket].count++;
      entryBuckets[bucket].totalReturn += tradeReturn(trade) ?? 0;
      if ((tradeReturn(trade) ?? 0) > 0) entryBuckets[bucket].wins++;
    }

    const entryAnalysis = Object.entries(entryBuckets)
      .map(([range, data]) => ({
        range,
        count: data.count,
        avgReturn: data.count > 0 ? data.totalReturn / data.count : 0,
        winRate: data.count > 0 ? data.wins / data.count : 0,
      }))
      .sort((a, b) => parseFloat(a.range) - parseFloat(b.range));

    const result = { metrics, entryAnalysis };
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
