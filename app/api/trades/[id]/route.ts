import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const UpdateTradeSchema = z.object({
  certificateId: z.string().optional(),
  direction: z.enum(["long", "short"]).optional(),
  entryDate: z.string().optional(),
  exitDate: z.string().optional().nullable(),
  entryVix: z.number().optional().nullable(),
  exitVix: z.number().optional().nullable(),
  barrierLevel: z.number().optional(),
  strikePrice: z.number().optional().nullable(),
  leverageRatio: z.number().optional().nullable(),
  ratio: z.number().optional().nullable(),
  entryPrice: z.number().optional().nullable(),
  exitPrice: z.number().optional().nullable(),
  quantity: z.number().int().optional().nullable(),
  returnPct: z.number().optional().nullable(),
  holdDays: z.number().optional().nullable(),
  alertTriggered: z.boolean().optional(),
  notes: z.string().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = UpdateTradeSchema.parse(body);

    const updateData: Record<string, unknown> = { ...parsed };
    if (parsed.entryDate) updateData.entryDate = new Date(parsed.entryDate);
    if (parsed.exitDate) updateData.exitDate = new Date(parsed.exitDate);

    // Auto-calculate returnPct from entry/exit prices if both are present
    if (parsed.entryPrice && parsed.exitPrice) {
      updateData.returnPct = ((parsed.exitPrice - parsed.entryPrice) / parsed.entryPrice) * 100;
    }

    const trade = await prisma.trade.update({
      where: { id },
      data: updateData,
    });

    // If trade now has a real exitDate, close the linked position
    // If exitDate was removed (null), reopen it
    if (trade.positionId) {
      const hasExit = trade.exitDate != null;
      await prisma.position.update({
        where: { id: trade.positionId },
        data: { status: hasExit ? "closed" : "open" },
      }).catch(() => { /* position may not exist */ });
    }

    return NextResponse.json(trade);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const trade = await prisma.trade.findUnique({ where: { id } });
    await prisma.trade.delete({ where: { id } });
    // Also delete linked position if it exists
    if (trade?.positionId) {
      await prisma.position.delete({ where: { id: trade.positionId } }).catch(() => {});
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
