import { NextRequest, NextResponse } from "next/server";
import { fetchCertificateData } from "@/lib/onetoba";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await fetchCertificateData(id);
    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
