import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

import { createTradeSchema, tradeDerivedValues, validateTradeClosingCosts } from "@/lib/trade-validation";

export async function GET() {
  try {
    const trades = await prisma.trade.findMany({
      orderBy: { entryDate: "desc" },
      include: { position: { select: { name: true, leverageRatio: true } } },
    });
    // Bewusst KEIN Cache-Control-Header: Trades sind der mutabelste Endpoint
    // (anlegen/schließen/editieren mit sofortigem SWR-mutate) — ein Edge-Cache
    // würde nach Mutationen veraltete Daten liefern.
    return NextResponse.json(trades);
  } catch (err) {
    console.error("[trades GET]", err);
    return NextResponse.json({ error: "Trades konnten nicht geladen werden" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createTradeSchema.parse(body);
    const entryDate = new Date(parsed.entryDate);
    const exitDate = parsed.exitDate ? new Date(parsed.exitDate) : null;
    validateTradeClosingCosts(exitDate, parsed);
    const derived = tradeDerivedValues({ ...parsed, entryDate, exitDate });
    const trade = await prisma.$transaction(async (tx) => {
      let positionId = parsed.positionId;
      if (positionId) {
        const position = await tx.position.findUnique({ where: { id: positionId }, include: { trades: true } });
        if (!position) throw new z.ZodError([{ code: "custom", path: ["positionId"], message: "Position existiert nicht" }]);
        if (position.notes.startsWith("signal:") || position.trades.some(t => t.notes.startsWith("signal:"))) {
          throw new z.ZodError([{ code: "custom", path: ["positionId"], message: "Signalposition bitte im Signalbereich abgleichen" }]);
        }
        if (position.certificateId !== parsed.certificateId || position.direction !== parsed.direction || position.trades.length) {
          throw new z.ZodError([{ code: "custom", path: ["positionId"], message: "Position muss zum Produkt passen und darf noch keinen Trade enthalten" }]);
        }
      } else if (!exitDate) {
        const position = await tx.position.create({ data: {
          certificateId: parsed.certificateId, direction: parsed.direction,
          entryVix: parsed.entryVix ?? 0, entryPrice: parsed.entryPrice ?? 0,
          barrierLevel: parsed.barrierLevel, currentBarrier: parsed.barrierLevel,
          leverageRatio: parsed.leverageRatio ?? 1, currentPrice: parsed.entryPrice ?? 0,
          status: "open",
        } });
        positionId = position.id;
      }
      const { positionId: _positionId, holdDays: _holdDays, ...fields } = parsed;
      void _positionId; void _holdDays;
      const created = await tx.trade.create({ data: {
        ...fields, entryDate, exitDate, entryVix: parsed.entryVix ?? 0,
        exitVix: exitDate ? parsed.exitVix : null,
        exitPrice: exitDate ? parsed.exitPrice : null,
        ...derived, ...(positionId ? { positionId } : {}),
      } });
      if (positionId) {
        await tx.position.update({ where: { id: positionId }, data: {
          status: exitDate ? "closed" : "open",
          entryVix: parsed.entryVix ?? 0, entryPrice: parsed.entryPrice ?? 0,
          barrierLevel: parsed.barrierLevel, leverageRatio: parsed.leverageRatio ?? 1,
          ...(exitDate && parsed.exitPrice != null ? { currentPrice: parsed.exitPrice } : {}),
        } });
      }
      return created;
    });

    return NextResponse.json(trade, { status: 201 });
  } catch (err) {
    if (err instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    console.error(err);
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
