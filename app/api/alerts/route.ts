import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const days = searchParams.get("days");
    const limit = parseInt(searchParams.get("limit") || "100");
    const unacknowledgedOnly = searchParams.get("unacknowledged") === "true";

    const where: Record<string, unknown> = {};

    if (type && type !== "all") {
      where.alertType = type;
    }

    if (days) {
      const d = parseInt(days);
      if (d > 0) {
        where.sentAt = { gte: new Date(Date.now() - d * 86_400_000) };
      }
    }

    if (unacknowledgedOnly) {
      where.acknowledged = false;
    }

    const alerts = await prisma.alertLog.findMany({
      where,
      orderBy: { sentAt: "desc" },
      take: limit,
    });

    const unacknowledgedCount = await prisma.alertLog.count({
      where: { acknowledged: false },
    });

    return NextResponse.json({ alerts, unacknowledgedCount });
  } catch {
    return NextResponse.json({ alerts: [], unacknowledgedCount: 0 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.id) {
      await prisma.alertLog.update({
        where: { id: body.id },
        data: { acknowledged: true },
      });
    } else {
      await prisma.alertLog.updateMany({
        where: { acknowledged: false },
        data: { acknowledged: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
