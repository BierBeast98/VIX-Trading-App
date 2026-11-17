import type { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from "next/server";
import { getVixSpot, getVixFutures, getEurUsd, getVontobelFuturesQuote, getVixHistory } from "@/lib/yahoo-finance";
import { prisma } from "@/lib/prisma";
import { calcZScore } from "@/lib/utils";
import { allowed } from '@/lib/signals/auth';
import { memGet, memSet } from "@/lib/server-cache";

const MEM_TTL = 30_000; // Short server cache; source timestamp remains unchanged.
const CACHE_KEY = "vix_spot_feed_v2";
const CC = { "Cache-Control": "no-store" };

async function getSettings() {
  try {
    const settings = await prisma.settings.findUnique({
      where: { id: 1 },
      select: { vontobelIsin: true, rollingWindowDays: true },
    });
    return { vontobelIsin: settings?.vontobelIsin || undefined, rollingWindowDays: settings?.rollingWindowDays ?? 30 };
  } catch { return { vontobelIsin: undefined, rollingWindowDays: 30 }; }
}

export async function GET(req: NextRequest) {
  try {
    const realtimeAccess = allowed(req);
    const cacheKey = `${CACHE_KEY}:${realtimeAccess ? 'private' : 'public'}`;
    const databaseCacheId = realtimeAccess ? 'spot_private_feed_v2' : 'spot';
    const feedConfig = `${process.env.VIX_DATA_PROVIDER?.trim() || (process.env.MASSIVE_API_KEY?.trim() ? 'massive' : 'yahoo')}:${!!process.env.MASSIVE_API_KEY?.trim()}:${realtimeAccess}`;
    // 1. In-memory cache — fastest, no network round-trip
    const hit = memGet<Record<string, unknown>>(cacheKey);
    if (hit?.feedConfig === feedConfig) return NextResponse.json(hit, { headers: CC });

    const { vontobelIsin, rollingWindowDays } = await getSettings();

    // 2. DB cache — skip if rollingWindowDays changed
    try {
      const cached = await prisma.vixCache.findUnique({ where: { id: databaseCacheId } });
      if (cached && Date.now() - cached.updatedAt.getTime() < MEM_TTL) {
        const cachedData = cached.data as Record<string, unknown>;
        if (cachedData.rollingWindowDays === rollingWindowDays && cachedData.feedSchemaVersion === 2 && cachedData.feedConfig === feedConfig) {
          memSet(cacheKey, cachedData, Math.max(1, MEM_TTL - (Date.now() - cached.updatedAt.getTime())));
          return NextResponse.json(cachedData, { headers: CC });
        }
      }
    } catch { /* DB not yet configured — continue to live fetch */ }

    const [spot, futures, eurUsd, vontobelQuote] = await Promise.all([
      getVixSpot({ allowRealtime: realtimeAccess }),
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
            update: { data: { closes } },
            create: { id: "history_closes", data: { closes } },
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
    // Single Source of Truth für die VX-Änderung: Server berechnet aus derselben
    // Quelle wie den Preis — Dashboard und iOS-Widget zeigen damit identische Werte
    const futureSource: "vontobel" | "yahoo-vix3m" | null = vontobelQuote
      ? "vontobel"
      : futures
        ? "yahoo-vix3m"
        : null;
    const futurePrevClose = vontobelQuote?.previousClose ?? futures?.previousClose ?? null;
    const futureChangePct =
      futurePrice != null && futurePrevClose != null && futurePrevClose > 0
        ? ((futurePrice - futurePrevClose) / futurePrevClose) * 100
        : null;
    const data = {
      feedSchemaVersion: 2, feedConfig, realtimeAccess,
      spot,
      futures,
      vontobelFuture: vontobelQuote,
      futureChangePct,
      futureSource,
      spread: futurePrice != null ? futurePrice - spot.price : null,
      zScore: zScore.toFixed(2),
      rollingMean: rollingMean.toFixed(2),
      rollingWindowDays,
      timestamp: Date.now(),
      eurUsd,
    };

    // Store in-memory (instant for next hit within same instance)
    memSet(cacheKey, data, MEM_TTL);

    // Persist to DB async — don't block the response
    prisma.vixCache.upsert({
      where: { id: databaseCacheId },
      update: { data: data as unknown as Prisma.InputJsonValue },
      create: { id: databaseCacheId, data: data as unknown as Prisma.InputJsonValue },
    }).catch((e) => console.error("[vix/spot] cache upsert:", e));

    return NextResponse.json(data, { headers: CC });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
