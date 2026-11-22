import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { closePositionSchema, tradeDerivedValues, updatePositionSchema } from "@/lib/trade-validation";

class PositionError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
const managedError = "Signalposition bitte über den Signalbereich bzw. per Screenshot abgleichen";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const parsed = updatePositionSchema.parse(await req.json());
    const position = await prisma.$transaction(async (tx) => {
      const existing = await tx.position.findUnique({ where: { id }, include: { trades: true } });
      if (!existing) throw new PositionError("Position not found", 404);
      if (existing.notes.startsWith("signal:") || existing.trades.some(t => t.notes.startsWith("signal:"))) throw new PositionError(managedError, 409);
      const tradeFields = ["certificateId", "direction", "entryPrice", "entryVix", "barrierLevel", "leverageRatio"] as const;
      if (existing.trades.length && tradeFields.some(key => parsed[key] !== undefined && parsed[key] !== existing[key])) {
        throw new PositionError("Einstiegsdaten bitte im verknüpften Trade bearbeiten", 409);
      }
      return tx.position.update({ where: { id }, data: parsed });
    });
    return NextResponse.json(position);
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues }, { status: 400 });
    if (err instanceof PositionError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    // A cached quote is not an execution. Require the actual fill and full sold
    // quantity; partial executions must be recorded as separate trades.
    const body = await req.text();
    if (!body) return NextResponse.json({ error: "Zum Schließen tatsächlichen Verkaufskurs, Ausstiegsdatum und verkaufte Stückzahl im Trade erfassen" }, { status: 409 });
    const parsed = closePositionSchema.parse(JSON.parse(body));
    const exitDate = new Date(parsed.exitDate);
    const closedTrades = await prisma.$transaction(async (tx) => {
      const position = await tx.position.findUnique({ where: { id }, include: { trades: true } });
      if (!position) throw new PositionError("Position not found", 404);
      if (position.notes.startsWith("signal:") || position.trades.some(t => t.notes.startsWith("signal:"))) throw new PositionError(managedError, 409);
      const openTrades = position.trades.filter(t => t.exitDate === null);
      if (!openTrades.length) throw new PositionError("Keine offenen Trades vorhanden; Ausführung bitte in der Trade-Historie erfassen", 409);
      if (openTrades.some(t => t.quantity == null || t.quantity <= 0) || openTrades.reduce((sum, t) => sum + (t.quantity ?? 0), 0) !== parsed.quantity) {
        throw new PositionError("Verkaufte Stückzahl muss dem offenen Bestand entsprechen; Teilausführungen bitte getrennt erfassen", 409);
      }
      // Validate every entry before performing any write.
      const updates = openTrades.map(t => ({ trade: t, derived: tradeDerivedValues({ ...t, exitDate, exitPrice: parsed.exitPrice }) }));
      let previousQuantity = 0;
      const allocated = (amount: number | null | undefined, from: number, to: number) =>
        amount == null ? amount :
          (Math.round(amount * 100 * to / parsed.quantity) - Math.round(amount * 100 * from / parsed.quantity)) / 100;
      for (const { trade, derived } of updates) {
        const cumulativeQuantity = previousQuantity + trade.quantity!;
        await tx.trade.update({ where: { id: trade.id }, data: {
          exitDate, exitPrice: parsed.exitPrice,
          exitFees: allocated(parsed.exitFees, previousQuantity, cumulativeQuantity),
          taxWithheld: allocated(parsed.taxWithheld, previousQuantity, cumulativeQuantity),
          ...derived,
        } });
        previousQuantity = cumulativeQuantity;
      }
      await tx.position.update({ where: { id }, data: { status: "closed", currentPrice: parsed.exitPrice } });
      return openTrades.length;
    });
    return NextResponse.json({ success: true, closedTrades });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues }, { status: 400 });
    if (err instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    if (err instanceof PositionError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
