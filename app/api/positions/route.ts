import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

import { createPositionSchema } from "@/lib/trade-validation";

export async function GET() {
  try {
    const positions = await prisma.position.findMany({
      where: { status: "open" },
      orderBy: { createdAt: "desc" },
      include: {
        trades: {
          where: { exitDate: null },
          orderBy: { entryDate: "asc" },
          select: { strikePrice: true, ratio: true, quantity: true, exitDate: true },
        },
      },
    });
    return NextResponse.json(positions, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[positions GET]", err);
    return NextResponse.json({ error: "Positionen konnten nicht geladen werden" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createPositionSchema.parse(body);
    const position = await prisma.position.create({ data: { ...parsed, currentPrice: parsed.currentPrice ?? parsed.entryPrice } });
    return NextResponse.json(position, { status: 201 });
  } catch (err) {
    if (err instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
