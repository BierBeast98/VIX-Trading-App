import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Persistiert das aktuell verfügbare Konto-Kapital im generischen VixCache-KV-Store
// (id="account_capital"). Kein eigenes Schema-Feld nötig → keine Migration.
const CACHE_ID = "account_capital";

const Schema = z.object({ currentCapital: z.number().nonnegative() });

export async function GET() {
  try {
    const row = await prisma.vixCache.findUnique({ where: { id: CACHE_ID } });
    const value = (row?.data as { value?: number } | null)?.value ?? null;
    return NextResponse.json({ currentCapital: value });
  } catch (err) {
    console.error("[account-capital GET]", err);
    return NextResponse.json({ currentCapital: null });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { currentCapital } = Schema.parse(await req.json());
    await prisma.vixCache.upsert({
      where: { id: CACHE_ID },
      update: { data: { value: currentCapital } },
      create: { id: CACHE_ID, data: { value: currentCapital } },
    });
    return NextResponse.json({ currentCapital });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    console.error("[account-capital PUT]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
