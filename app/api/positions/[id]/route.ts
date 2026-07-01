import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const position = await prisma.position.update({ where: { id }, data: body });
    return NextResponse.json(position);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const position = await prisma.position.findUnique({ where: { id } });
    if (!position) {
      return NextResponse.json({ error: "Position not found" }, { status: 404 });
    }

    // Letzten bekannten Bid aus dem Cache als Ausstiegskurs vorbefüllen —
    // bleibt über den Trade-Editor korrigierbar
    let exitBid: number | null = null;
    try {
      const row = await prisma.vixCache.findUnique({
        where: { id: `vontobel_${position.certificateId}` },
      });
      const bid = (row?.data as { bid?: unknown } | null)?.bid;
      if (typeof bid === "number" && Number.isFinite(bid) && bid > 0) exitBid = bid;
    } catch { /* Cache optional */ }

    // Position UND verknüpfte offene Trades atomar schließen — sonst bleiben
    // Trades ohne exitDate zurück (Desktop-Schließen vs. Mobile-Trade-PUT)
    const now = new Date();
    const openTrades = await prisma.trade.findMany({
      where: { positionId: id, exitDate: null },
    });
    await prisma.$transaction([
      prisma.position.update({ where: { id }, data: { status: "closed" } }),
      ...openTrades.map((t) =>
        prisma.trade.update({
          where: { id: t.id },
          data: {
            exitDate: now,
            holdDays: Math.round((now.getTime() - t.entryDate.getTime()) / 86_400_000),
            ...(exitBid != null
              ? {
                  exitPrice: exitBid,
                  ...(t.entryPrice && t.entryPrice > 0
                    ? { returnPct: ((exitBid - t.entryPrice) / t.entryPrice) * 100 }
                    : {}),
                }
              : {}),
          },
        })
      ),
    ]);

    return NextResponse.json({ success: true, closedTrades: openTrades.length });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
