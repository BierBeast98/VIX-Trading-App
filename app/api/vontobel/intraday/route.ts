import { NextRequest, NextResponse } from "next/server";
import { getVontobelCertificateIntraday } from "@/lib/yahoo-finance";
import { memGet, memSet } from "@/lib/server-cache";

const CC = { "Cache-Control": "s-maxage=60, stale-while-revalidate=120" };

export async function GET(req: NextRequest) {
  const isin = new URL(req.url).searchParams.get("isin");
  if (!isin) {
    return NextResponse.json({ error: "Missing isin parameter" }, { status: 400 });
  }

  const key = `cert_intraday_${isin}`;
  const hit = memGet<unknown[]>(key);
  if (hit) return NextResponse.json({ data: hit }, { headers: CC });

  try {
    const data = await getVontobelCertificateIntraday(isin);
    memSet(key, data, 60_000);
    return NextResponse.json({ data }, { headers: CC });
  } catch (err) {
    console.error("Vontobel intraday error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
