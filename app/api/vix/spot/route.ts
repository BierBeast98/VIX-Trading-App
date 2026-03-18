import { NextResponse } from "next/server";
import { getVixSpot, getVixFutures, getEurUsd, getVontobelFuturesQuote, getVixHistory } from "@/lib/yahoo-finance";
import { prisma } from "@/lib/prisma";
import { calcZScore } from "@/lib/utils";
import { memGet, memSet } from "@/lib/server-cache";

const MEM_TTL = 300_000; // 5 min — aligns with client refreshInterval
const CC = { "Cache-Control": "s-maxage=300, stale-while-revalidate=60" };

async function getSettings() {
  try {
    const settings = await prisma.settings.findUnique({
      where: { id: 1 },
      select: { vontobelIsin: true, rollingWindowDays: true },
    });
    return { vontobelIsin: settings?.vontobelIsin || undefined, rollingWindowDays: settings?.rollingWindowDays ?? 30 };
  } catch { return { vontobelIsin: undefined, rollingWindowDays: 30 }; }
}

export async function GET() {
  try {
    // 1. In-memory cache — fastest, no network round-trip
    const hit = memGet<Record<string, unknown>>("vix_spot");
    if (hit) return NextResponse.json(hit, { headers: CC });

    const { vontobelIsin, rollingWindowDays } = await getSettings();

    // 2. DB cache — skip if rollingWindowDays changed
    try {
      const cached = await prisma.vixCache.findUnique({ where: { id: "spot" } });
      if (cached && Date.now() - cached.updatedAt.getTime() < MEM_TTL) {
        const cachedData = cached.data as Record<string, unknown>;
        if (cachedData.rollingWindowDays === rollingWindowDays) {
          memSet("vix_spot", cachedData, MEM_TTL);
          return NextResponse.json(cachedData, { headers: CC });
        }
      }
    } catch { /* DB not yet configured — continue to live fetch */ }

    const [spot, futures, eurUsd, vontobelQuote] = await Promise.all([
      getVixSpot(),
      getVixFutures(),
      getEurUsd(),
      getVontobelFuturesQuote(vontobelIsin),
    ]);

    if (!spot) {
      return NextResponse.json({ error: "VIX data unavailable" }, { status: 503 });
    }

    // Z-Score: use cached history, fetch fresh if insufficient
    let zScore = 0;
    let rollingMean = 0;
    try {
      let closes: number[] = [];
      const history = await prisma.vixCache.findUnique({ where: { id: "history_closes" } });
      if (history) {
        closes = (history.data as { closes: number[] }).closes || [];
      }
      // If cached closes don't cover the rolling window, fetch fresh data
      if (closes.length < rollingWindowDays) {
        const freshHistory = await getVixHistory(rollingWindowDays + 5);
        if (freshHistory.length > 0) {
          closes = freshHistory.map((h) => h.close);
          await prisma.vixCache.upsert({
            where: { id: "history_closes" },
            update: { data: { closes } as any },
            create: { id: "history_closes", data: { closes } as any },
          });
        }
      }
      const windowCloses = closes.slice(-rollingWindowDays);
      if (windowCloses.length >= 2) {
        zScore = calcZScore(windowCloses, spot.price);
        rollingMean = windowCloses.reduce((a, b) => a + b, 0) / windowCloses.length;
      }
    } catch { /* skip z-score if DB unavailable */ }

    // Use Vontobel VIX Future as primary, fall back to Yahoo ^VIX3M
    const futurePrice = vontobelQuote?.price ?? futures?.price ?? null;
    const data = {
      spot,
      futures,
      vontobelFuture: vontobelQuote,
      spread: futurePrice != null ? futurePrice - spot.price : null,
      zScore: zScore.toFixed(2),
      rollingMean: rollingMean.toFixed(2),
      rollingWindowDays,
      timestamp: Date.now(),
      eurUsd,
    };

    // Store in-memory (instant for next hit within same instance)
    memSet("vix_spot", data, MEM_TTL);

    // Persist to DB async — don't block the response
    prisma.vixCache.upsert({
      where: { id: "spot" },
      update: { data: data as any },
      create: { id: "spot", data: data as any },
    }).catch(() => {});

    return NextResponse.json(data, { headers: CC });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
