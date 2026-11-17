import { NextRequest, NextResponse } from "next/server";
import { getVixSpot, getSpFutures, getVontobelFuturesQuote, getVontobelCertificatePrice } from "@/lib/yahoo-finance";
import { memGet, memSet } from "@/lib/server-cache";
import { allowed } from '@/lib/signals/auth';
import { prisma } from "@/lib/prisma";

const CACHE_KEY = "widget-data";
const CACHE_TTL = 30_000; // Same short freshness cache as dashboard.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "no-store",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/** Wraps a promise with a timeout — returns null on timeout */
function withTimeout<T>(promise: Promise<T | null>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

type WidgetPayload = { markets: Array<{ symbol: string; price?: number | null; source?: string | null; sourceAt?: number | null; feedMode?: string | null; marketStatus?: string | null; [key: string]: unknown }>; [key: string]: unknown };

// Recalculate age on every response, including in-memory cache hits.
function withVixFreshness(payload: WidgetPayload): WidgetPayload {
  const now = Date.now();
  return { ...payload, markets: payload.markets.map(market => {
    if (market.symbol !== "VIX") return market;
    const age = typeof market.sourceAt === "number" && Number.isFinite(market.sourceAt) && market.sourceAt > 0 ? now - market.sourceAt : null;
    return { ...market, stale: age == null || age < 0 || age > 300_000,
      realtimeFresh: market.source === "massive" && market.feedMode === "realtime" && market.marketStatus?.toLowerCase() !== "closed" && typeof market.price === "number" && Number.isFinite(market.price) && market.price > 0 && age != null && age >= 0 && age <= 300_000 };
  }) };
}

export async function GET(req: NextRequest) {
  const realtimeAccess = allowed(req);
  const provider = process.env.VIX_DATA_PROVIDER?.trim() || (process.env.MASSIVE_API_KEY?.trim() ? 'massive' : 'yahoo');
  const cacheKey = `${CACHE_KEY}:${provider}:${!!process.env.MASSIVE_API_KEY?.trim()}:${realtimeAccess}`;
  const cached = memGet<WidgetPayload>(cacheKey);
  if (cached) {
    return NextResponse.json(withVixFreshness(cached), { headers: CORS_HEADERS });
  }

  // Vontobel ISIN aus Settings lesen (Fallback auf Default)
  let vontobelIsin: string | undefined;
  try {
    const settings = await prisma.settings.findUnique({
      where: { id: 1 },
      select: { vontobelIsin: true },
    });
    vontobelIsin = settings?.vontobelIsin || undefined;
  } catch { /* use default */ }

  const [vixResult, vxResult, esResult, positionsResult] =
    await Promise.allSettled([
      withTimeout(getVixSpot({ allowRealtime: realtimeAccess }), 15000),
      withTimeout(getVontobelFuturesQuote(vontobelIsin), 8000),
      withTimeout(getSpFutures(), 8000),
      prisma.position.findMany({
        where: { status: "open" },
        select: {
          name: true,
          certificateId: true,
          entryPrice: true,
          currentPrice: true,
          direction: true,
          entryVix: true,
          // Stückzahl der offenen Trades für €-P&L (quantity liegt am Trade, nicht an der Position)
          trades: {
            where: { exitDate: null },
            select: { quantity: true },
          },
        },
      }),
    ]);

  const vix = vixResult.status === "fulfilled" ? vixResult.value : null;
  const vxRaw = vxResult.status === "fulfilled" ? vxResult.value : null;
  const es = esResult.status === "fulfilled" ? esResult.value : null;
  const positions =
    positionsResult.status === "fulfilled" ? positionsResult.value : [];

  // Live-Preise für offene Positionen via Vontobel holen (mit shared In-Memory Cache)
  const CERT_PRICE_TTL = 5 * 60 * 1000;
  const livePrices: Record<string, number | null> = {};
  await Promise.all(
    positions.map(async (p) => {
      if (!p.certificateId) return;
      const cacheKey = `vontobel_cert_price_${p.certificateId}`;
      const cached = memGet<number>(cacheKey);
      if (cached != null) {
        livePrices[p.certificateId] = cached;
        return;
      }
      const bid = await withTimeout(getVontobelCertificatePrice(p.certificateId), 8000);
      livePrices[p.certificateId] = bid;
      if (bid != null) {
        memSet(cacheKey, bid, CERT_PRICE_TTL);
        // Letzten bekannten Preis an der Position pflegen — dient als Fallback,
        // wenn Vontobel später nicht erreichbar ist (statt ewig alter Einstiegspreis)
        prisma.position
          .updateMany({ where: { certificateId: p.certificateId, status: "open" }, data: { currentPrice: bid } })
          .catch((e) => console.error(`[widget] currentPrice update ${p.certificateId}:`, e));
      }
    })
  );

  // changePct aus Vontobel previousClose berechnen
  const vxChangePct =
    vxRaw && vxRaw.previousClose > 0
      ? ((vxRaw.price - vxRaw.previousClose) / vxRaw.previousClose) * 100
      : null;

  const markets = [
    {
      symbol: "VIX",
      price: vix ? parseFloat(vix.price.toFixed(2)) : null,
      changePct: vix ? parseFloat(vix.changePct.toFixed(2)) : null,
      sourceAt: vix?.timestamp || null,
      receivedAt: vix?.receivedAt ?? null,
      source: vix?.source ?? null,
      feedMode: vix?.feedMode ?? "unknown",
      delayMinutes: vix?.delayMinutes ?? null,
      marketStatus: vix?.marketStatus ?? null,
    },
    {
      symbol: "VX",
      price: vxRaw ? parseFloat(vxRaw.price.toFixed(2)) : null,
      changePct: vxChangePct != null ? parseFloat(vxChangePct.toFixed(2)) : null,
    },
    {
      symbol: "ES=F",
      price: es ? parseFloat(es.price.toFixed(2)) : null,
      changePct: es ? parseFloat(es.changePct.toFixed(2)) : null,
    },
  ];

  const openPositions = positions.map((p) => {
    const livePrice = p.certificateId ? (livePrices[p.certificateId] ?? null) : null;
    // Fallback = letzter bekannter Preis (wird oben bei jedem Live-Abruf gepflegt);
    // priceStale signalisiert dem Widget, dass der Wert nicht live ist
    const fallbackPrice = p.currentPrice > 0 ? p.currentPrice : p.entryPrice;
    const currentPrice = livePrice ?? fallbackPrice;
    const priceStale = livePrice == null;
    const rawPnl =
      p.entryPrice > 0
        ? p.direction === "short"
          ? ((p.entryPrice - currentPrice) / p.entryPrice) * 100
          : ((currentPrice - p.entryPrice) / p.entryPrice) * 100
        : 0;
    const pnlPct = parseFloat(rawPnl.toFixed(2));
    const quantity = p.trades.reduce((sum, t) => sum + (t.quantity ?? 0), 0);
    const rawPnlEur =
      quantity > 0
        ? (p.direction === "short"
            ? p.entryPrice - currentPrice
            : currentPrice - p.entryPrice) * quantity
        : null;
    return {
      name: p.name || p.direction,
      entryPrice: parseFloat(p.entryPrice.toFixed(4)),
      currentPrice: parseFloat(currentPrice.toFixed(4)),
      pnlPct,
      pnlEur: rawPnlEur != null ? parseFloat(rawPnlEur.toFixed(2)) : null,
      priceStale,
      direction: p.direction,
    };
  });

  const payload = {
    updatedAt: new Date().toISOString(),
    markets,
    positions: openPositions,
  };

  memSet(cacheKey, payload, CACHE_TTL);

  return NextResponse.json(withVixFreshness(payload), { headers: CORS_HEADERS });
}
