import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { memGet, memSet } from "@/lib/server-cache";

const CACHE_TTL = 300_000; // 5 min — aligns with client refreshInterval
const CC = { "Cache-Control": "s-maxage=300, stale-while-revalidate=60" };

export async function GET(req: NextRequest) {
  const isin = req.nextUrl.searchParams.get("isin");
  if (!isin || !/^[A-Z0-9]{12}$/.test(isin)) {
    return NextResponse.json({ error: "Invalid ISIN" }, { status: 400 });
  }

  const cacheKey = `vontobel_${isin}`;

  // 1. In-memory cache
  const hit = memGet<object>(cacheKey);
  if (hit) return NextResponse.json(hit, { headers: CC });

  // 2. DB cache
  try {
    const cached = await prisma.vixCache.findUnique({ where: { id: cacheKey } });
    if (cached && Date.now() - cached.updatedAt.getTime() < CACHE_TTL) {
      memSet(cacheKey, cached.data as object, CACHE_TTL);
      return NextResponse.json(cached.data, { headers: CC });
    }
  } catch { /* DB optional */ }

  // Fetch from Vontobel chart API (server-side, no CORS restriction)
  try {
    const url = `https://markets.vontobel.com/api/v1/charts/products/${isin}/detail/0/0?c=de-de`;
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": `https://markets.vontobel.com/de-de/produkte/hebel/mini-futures/${isin}`,
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "de-DE,de;q=0.9",
      },
      next: { revalidate: 0 },
    });

    if (!resp.ok) {
      return NextResponse.json({ error: `Vontobel returned ${resp.status}` }, { status: 502 });
    }

    const json = await resp.json();
    const series: any[] = json?.payload?.series ?? [];

    const productSeries = series.find((s) => s.isProduct === true);
    const underlyingSeries = series.find((s) => s.isProduct === false);

    const latestProduct = productSeries?.points?.[0];
    const latestUnderlying = underlyingSeries?.points?.[0];

    const data = {
      isin,
      bid: latestProduct?.bid ?? null,
      underlying: latestUnderlying?.close ?? null,
      timestamp: latestProduct?.timestamp ?? null,
    };

    memSet(cacheKey, data, CACHE_TTL);

    // Persist to DB async
    prisma.vixCache.upsert({
      where: { id: cacheKey },
      update: { data: data as any },
      create: { id: cacheKey, data: data as any },
    }).catch(() => {});

    return NextResponse.json(data, { headers: CC });
  } catch (err) {
    console.error("[vontobel/price]", err);
    return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
  }
}
