import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { updateTradeSchema, tradeDerivedValues, validateTradeClosingCosts } from "@/lib/trade-validation";

const managedError = "Signalposition bitte über den Signalbereich bzw. per Screenshot abgleichen";
class TradeError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const parsed = updateTradeSchema.parse(await req.json());
    const trade = await prisma.$transaction(async (tx) => {
      const existing = await tx.trade.findUnique({ where: { id }, include: { position: true } });
      if (!existing) throw new TradeError("Trade not found", 404);
      if (existing.notes.startsWith("signal:") || existing.position?.notes.startsWith("signal:")) throw new TradeError(managedError, 409);
      const entryDate = parsed.entryDate !== undefined ? new Date(parsed.entryDate) : existing.entryDate;
      const exitDate = parsed.exitDate !== undefined ? (parsed.exitDate === null ? null : new Date(parsed.exitDate)) : existing.exitDate;
      validateTradeClosingCosts(exitDate, parsed);
      const merged = { ...existing, ...parsed, entryDate, exitDate };
      if ((parsed.entryPrice !== undefined || parsed.exitPrice !== undefined) && parsed.returnPct === undefined) merged.returnPct = null;
      const data = {
        ...parsed, entryDate, exitDate,
        entryVix: parsed.entryVix === null ? 0 : (parsed.entryVix ?? existing.entryVix),
        ...(!exitDate ? { exitPrice: null, exitVix: null, exitFees: null, taxWithheld: null } : {}),
        ...tradeDerivedValues(merged),
      };
      const updated = await tx.trade.update({ where: { id }, data });
      if (updated.positionId) {
        const siblings = await tx.trade.findMany({ where: { positionId: updated.positionId } });
        const hasOpen = siblings.some(t => t.exitDate === null);
        await tx.position.update({ where: { id: updated.positionId }, data: {
          status: hasOpen ? "open" : "closed",
          ...(siblings.length === 1 ? {
            certificateId: updated.certificateId, direction: updated.direction,
            entryPrice: updated.entryPrice ?? 0, entryVix: updated.entryVix,
            barrierLevel: updated.barrierLevel,
            ...(updated.leverageRatio != null ? { leverageRatio: updated.leverageRatio } : {}),
          } : {}),
          ...(!hasOpen && updated.exitPrice != null ? { currentPrice: updated.exitPrice } : {}),
          ...(hasOpen && existing.exitDate !== null ? { currentPrice: updated.entryPrice ?? 0 } : {}),
        } });
      }
      return updated;
    });
    return NextResponse.json(trade);
  } catch (err) {
    if (err instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues }, { status: 400 });
    if (err instanceof TradeError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.$transaction(async (tx) => {
      const trade = await tx.trade.findUnique({ where: { id }, include: { position: true } });
      if (!trade) throw new TradeError("Trade not found", 404);
      if (trade.notes.startsWith("signal:") || trade.position?.notes.startsWith("signal:")) throw new TradeError(managedError, 409);
      await tx.trade.delete({ where: { id } });
      if (trade.positionId) {
        const remaining = await tx.trade.findMany({ where: { positionId: trade.positionId } });
        if (remaining.length === 0) await tx.position.delete({ where: { id: trade.positionId } });
        else await tx.position.update({ where: { id: trade.positionId }, data: { status: remaining.some(t => t.exitDate === null) ? "open" : "closed" } });
      }
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof TradeError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
