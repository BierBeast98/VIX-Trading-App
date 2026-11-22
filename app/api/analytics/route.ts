import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeEntryLevels, calcPerformanceMetrics } from "@/lib/analytics";

export async function GET() {
  try {
    const trades = await prisma.trade.findMany({ orderBy: { entryDate: "asc" } });
    return NextResponse.json({
      metrics: calcPerformanceMetrics(trades),
      entryAnalysis: analyzeEntryLevels(trades),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
