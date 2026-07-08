import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { memGet, memSet, memDel } from "@/lib/server-cache";
import { alertConfigSchema, normalizeAlertConfig, DEFAULT_ALERT_CONFIG } from "@/lib/alert-config";

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
  alertConfig: DEFAULT_ALERT_CONFIG,
};

// Nur bekannte Felder mit plausiblen Grenzen — das frühere PUT hat den
// kompletten Body ungeprüft in die DB geschrieben
const settingsSchema = z
  .object({
    alertEmail: z.union([z.literal(""), z.email()]),
    vixLowThreshold: z.number().min(5).max(50),
    vixHighThreshold: z.number().min(10).max(100),
    stdDevMultiplier: z.number().min(0.5).max(5),
    rollingWindowDays: z.number().int().min(5).max(250),
    targetReturnPct: z.number().min(1).max(200),
    trailingStopConfig: z.object({
      enabled: z.boolean(),
      stepPct: z.number().min(0.5).max(50),
    }),
    riskBudget: z.number().min(0),
    barrierWarningPct: z.number().min(0).max(100),
    spikeThresholdPct: z.number().min(1).max(100),
    vontobelIsin: z.union([z.literal(""), z.string().regex(/^[A-Z0-9]{12}$/)]),
    alertConfig: alertConfigSchema,
  })
  .partial();

function withNormalizedConfig<T extends { alertConfig?: unknown }>(settings: T) {
  return { ...settings, alertConfig: normalizeAlertConfig(settings.alertConfig) };
}

export async function GET() {
  // In-memory cache — settings are a single row that rarely changes
  const cached = memGet<object>(CACHE_KEY);
  if (cached) return NextResponse.json(cached, { headers: CC });

  try {
    const settings = await prisma.settings.upsert({
      where: { id: 1 },
      update: {},
      create: { ...DEFAULT_SETTINGS, alertConfig: DEFAULT_ALERT_CONFIG },
    });
    const payload = withNormalizedConfig(settings);
    memSet(CACHE_KEY, payload, CACHE_TTL);
    return NextResponse.json(payload, { headers: CC });
  } catch {
    return NextResponse.json(DEFAULT_SETTINGS);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: z.flattenError(parsed.error).fieldErrors },
        { status: 400 }
      );
    }

    const settings = await prisma.settings.upsert({
      where: { id: 1 },
      update: parsed.data,
      create: { ...DEFAULT_SETTINGS, ...parsed.data, id: 1 },
    });
    // Invalidate cache so the next GET reads fresh data
    memDel(CACHE_KEY);
    return NextResponse.json(withNormalizedConfig(settings));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
