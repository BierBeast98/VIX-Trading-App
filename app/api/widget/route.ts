import { NextResponse } from "next/server";
import { getVixSpot, getSpFutures, getVontobelFuturesQuote, getVontobelCertificatePrice } from "@/lib/yahoo-finance";
import { memGet, memSet } from "@/lib/server-cache";
import { prisma } from "@/lib/prisma";

const CACHE_KEY = "widget-data";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
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

export async function GET() {
  const cached = memGet<object>(CACHE_KEY);
  if (cached) {
    return NextResponse.json(cached, { headers: CORS_HEADERS });
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
      withTimeout(getVixSpot(), 8000),
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
      if (bid != null) memSet(cacheKey, bid, CERT_PRICE_TTL);
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
    const livePrice = p.certificateId ? livePrices[p.certificateId] : null;
    const currentPrice = livePrice ?? p.currentPrice;
    const rawPnl =
      p.entryPrice > 0
        ? p.direction === "short"
          ? ((p.entryPrice - currentPrice) / p.entryPrice) * 100
          : ((currentPrice - p.entryPrice) / p.entryPrice) * 100
        : 0;
    const pnlPct = parseFloat(rawPnl.toFixed(2));
    return {
      name: p.name || p.direction,
      entryPrice: parseFloat(p.entryPrice.toFixed(4)),
      currentPrice: parseFloat(currentPrice.toFixed(4)),
      pnlPct,
      direction: p.direction,
    };
  });

  const payload = {
    updatedAt: new Date().toISOString(),
    markets,
    positions: openPositions,
  };

  memSet(CACHE_KEY, payload, CACHE_TTL);

  return NextResponse.json(payload, { headers: CORS_HEADERS });
}
