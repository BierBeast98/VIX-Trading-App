import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CreatePositionSchema = z.object({
  certificateId: z.string().min(1),
  name: z.string().default(""),
  entryVix: z.number(),
  entryPrice: z.number(),
  barrierLevel: z.number(),
  currentBarrier: z.number(),
  leverageRatio: z.number(),
  currentPrice: z.number().default(0),
  notes: z.string().default(""),
});

export async function GET() {
  try {
    const allPositions = await prisma.position.findMany({ orderBy: { createdAt: "desc" } });
    console.log("[positions GET] all positions:", JSON.stringify(allPositions.map(p => ({ id: p.id, status: p.status, cert: p.certificateId }))));
    const positions = await prisma.position.findMany({
      where: { status: "open" },
      orderBy: { createdAt: "desc" },
      include: {
        trades: {
          orderBy: { entryDate: "asc" },
          take: 1,
          select: { strikePrice: true, ratio: true, quantity: true },
        },
      },
    });
    return NextResponse.json(positions);
  } catch (err) {
    console.error("[positions GET]", err);
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreatePositionSchema.parse(body);
    const position = await prisma.position.create({ data: parsed });
    return NextResponse.json(position, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
