import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTestEmail } from "@/lib/resend";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    const target = email || (await prisma.settings.findUnique({ where: { id: 1 } }))?.alertEmail;

    if (!target) {
      return NextResponse.json({ error: "No email configured" }, { status: 400 });
    }

    const ok = await sendTestEmail(target);
    return NextResponse.json({ success: ok });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
