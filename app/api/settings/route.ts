import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
  try {
    const settings = await prisma.settings.upsert({
      where: { id: 1 },
      update: {},
      create: DEFAULT_SETTINGS,
    });
    return NextResponse.json(settings);
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
    return NextResponse.json(settings);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
