import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { memGet, memSet, memDel } from "@/lib/server-cache";

const CACHE_KEY = "settings_data";
const CACHE_TTL = 60_000; // 60s — settings rarely change
const CC = { "Cache-Control": "s-maxage=60, stale-while-revalidate=120" };

const DEFAULT_SETTINGS = {
  id: 1,
  alertEmail: "",
  vixLowThreshold: 14.5,
  stdDevMultiplier: 2.0,
  rollingWindowDays: 30,
  targetReturnPct: 18.0,
  trailingStopConfig: { enabled: true, stepPct: 5 },
  riskBudget: 10000,
  spikeThresholdPct: 15.0,
  vontobelIsin: "DE000VJ4MNF2",
};

export async function GET() {
  // In-memory cache — settings are a single row that rarely changes
  const cached = memGet<object>(CACHE_KEY);
  if (cached) return NextResponse.json(cached, { headers: CC });

  try {
    const settings = await prisma.settings.upsert({
      where: { id: 1 },
      update: {},
      create: DEFAULT_SETTINGS,
    });
    memSet(CACHE_KEY, settings, CACHE_TTL);
    return NextResponse.json(settings, { headers: CC });
  } catch {
    return NextResponse.json(DEFAULT_SETTINGS);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const settings = await prisma.settings.upsert({
      where: { id: 1 },
      update: body,
      create: { id: 1, ...body },
    });
    // Invalidate cache so the next GET reads fresh data
    memDel(CACHE_KEY);
    return NextResponse.json(settings);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
