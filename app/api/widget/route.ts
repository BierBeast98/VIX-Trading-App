import { NextResponse } from "next/server";
import { getVixSpot, getVixFutures, getSpFutures } from "@/lib/yahoo-finance";
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

export async function GET() {
  const cached = memGet<object>(CACHE_KEY);
  if (cached) {
    return NextResponse.json(cached, { headers: CORS_HEADERS });
  }

  const [vixResult, vxResult, esResult, positionsResult] =
    await Promise.allSettled([
      getVixSpot(),
      getVixFutures(),
      getSpFutures(),
      prisma.position.findMany({
        where: { status: "open" },
        select: {
          name: true,
          entryPrice: true,
          currentPrice: true,
          direction: true,
          entryVix: true,
        },
      }),
    ]);

  const vix = vixResult.status === "fulfilled" ? vixResult.value : null;
  const vx = vxResult.status === "fulfilled" ? vxResult.value : null;
  const es = esResult.status === "fulfilled" ? esResult.value : null;
  const positions =
    positionsResult.status === "fulfilled" ? positionsResult.value : [];

  const markets = [
    {
      symbol: "VIX",
      price: vix ? parseFloat(vix.price.toFixed(2)) : null,
      changePct: vix ? parseFloat(vix.changePct.toFixed(2)) : null,
    },
    {
      symbol: "VX",
      price: vx ? parseFloat(vx.price.toFixed(2)) : null,
      changePct: vx ? parseFloat(vx.changePct.toFixed(2)) : null,
    },
    {
      symbol: "ES=F",
      price: es ? parseFloat(es.price.toFixed(2)) : null,
      changePct: es ? parseFloat(es.changePct.toFixed(2)) : null,
    },
  ];

  const openPositions = positions.map((p) => {
    const pnlPct =
      p.entryPrice > 0
        ? parseFloat(
            (((p.currentPrice - p.entryPrice) / p.entryPrice) * 100).toFixed(2)
          )
        : 0;
    return {
      name: p.name || p.direction,
      entryPrice: parseFloat(p.entryPrice.toFixed(4)),
      currentPrice: parseFloat(p.currentPrice.toFixed(4)),
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
