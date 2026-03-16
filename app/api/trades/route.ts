import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CreateTradeSchema = z.object({
  certificateId: z.string().min(1),
  direction: z.enum(["long", "short"]).default("short"),
  positionId: z.string().optional(),
  entryDate: z.string(),
  exitDate: z.string().optional().nullable(),
  entryVix: z.number().optional().nullable(),
  exitVix: z.number().optional().nullable(),
  barrierLevel: z.number(),
  strikePrice: z.number().optional().nullable(),
  leverageRatio: z.number().optional().nullable(),
  ratio: z.number().optional().nullable(),
  entryPrice: z.number().optional().nullable(),
  exitPrice: z.number().optional().nullable(),
  quantity: z.number().int().optional().nullable(),
  returnPct: z.number().optional().nullable(),
  holdDays: z.number().optional().nullable(),
  alertTriggered: z.boolean().default(false),
  notes: z.string().default(""),
});

export async function GET() {
  try {
    const trades = await prisma.trade.findMany({
      orderBy: { entryDate: "desc" },
      include: { position: { select: { name: true, leverageRatio: true } } },
    });
    return NextResponse.json(trades);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateTradeSchema.parse(body);

    // Auto-calculate returnPct from entry/exit prices if not manually set
    const autoReturnPct =
      parsed.entryPrice && parsed.exitPrice
        ? ((parsed.exitPrice - parsed.entryPrice) / parsed.entryPrice) * 100
        : parsed.returnPct ?? null;

    // If this is an open trade (no exitDate), auto-create a Position
    let positionId: string | undefined = parsed.positionId;
    if (!parsed.exitDate && !positionId) {
      const position = await prisma.position.create({
        data: {
          certificateId: parsed.certificateId,
          direction: parsed.direction,
          entryVix: parsed.entryVix ?? 0,
          entryPrice: parsed.entryPrice ?? 0,
          barrierLevel: parsed.barrierLevel,
          currentBarrier: parsed.barrierLevel,
          leverageRatio: parsed.leverageRatio ?? 1,
          currentPrice: parsed.entryPrice ?? 0,
          status: "open",
        },
      });
      positionId = position.id;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tradeData: any = {
      certificateId: parsed.certificateId,
      direction: parsed.direction,
      entryDate: new Date(parsed.entryDate),
      exitDate: parsed.exitDate ? new Date(parsed.exitDate) : null,
      entryVix: parsed.entryVix ?? null,
      exitVix: parsed.exitVix ?? null,
      barrierLevel: parsed.barrierLevel,
      strikePrice: parsed.strikePrice ?? null,
      leverageRatio: parsed.leverageRatio ?? null,
      ratio: parsed.ratio ?? null,
      entryPrice: parsed.entryPrice ?? null,
      exitPrice: parsed.exitPrice ?? null,
      quantity: parsed.quantity ?? null,
      returnPct: autoReturnPct,
      holdDays: parsed.exitDate
        ? Math.ceil(
            (new Date(parsed.exitDate).getTime() - new Date(parsed.entryDate).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : null,
      alertTriggered: parsed.alertTriggered,
      notes: parsed.notes,
    };
    if (positionId) tradeData.positionId = positionId;

    const trade = await prisma.trade.create({ data: tradeData });

    return NextResponse.json(trade, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
