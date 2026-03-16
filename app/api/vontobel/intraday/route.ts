import { NextRequest, NextResponse } from "next/server";
import { getVontobelCertificateIntraday } from "@/lib/yahoo-finance";

export async function GET(req: NextRequest) {
  const isin = new URL(req.url).searchParams.get("isin");
  if (!isin) {
    return NextResponse.json({ error: "Missing isin parameter" }, { status: 400 });
  }

  try {
    const data = await getVontobelCertificateIntraday(isin);
    return NextResponse.json({ data });
  } catch (err) {
    console.error("Vontobel intraday error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
