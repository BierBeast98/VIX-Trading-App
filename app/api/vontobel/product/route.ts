import { NextRequest, NextResponse } from "next/server";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "de-DE,de;q=0.9",
};

function parseGerman(s: string | undefined): number | null {
  if (!s) return null;
  return parseFloat(s.replace(/\./g, "").replace(",", ".")) || null;
}

export async function GET(req: NextRequest) {
  const isin = req.nextUrl.searchParams.get("isin");
  if (!isin || !/^[A-Z0-9]{12}$/.test(isin)) {
    return NextResponse.json({ error: "Invalid ISIN" }, { status: 400 });
  }

  try {
    // Fetch product page + chart data in parallel
    const [pageResp, chartResp] = await Promise.all([
      fetch(
        `https://markets.vontobel.com/de-de/produkte/hebel/mini-futures/${isin}`,
        { headers: HEADERS, next: { revalidate: 0 } }
      ),
      fetch(
        `https://markets.vontobel.com/api/v1/charts/products/${isin}/detail/0/0?c=de-de`,
        {
          headers: { ...HEADERS, Accept: "application/json, text/plain, */*" },
          next: { revalidate: 0 },
        }
      ),
    ]);

    if (!pageResp.ok) {
      return NextResponse.json(
        { error: `Vontobel page returned ${pageResp.status}` },
        { status: 502 }
      );
    }

    const html = await pageResp.text();

    // Extract product attributes from HTML
    // The Vontobel page renders values in HTML tags after labels,
    // e.g. <span>Basispreis</span>...<span>7,7257 USD</span>
    const extract = (label: string): string | undefined => {
      // Try label followed by whitespace/tags then a number
      const patterns = [
        new RegExp(label + "[^\\d]*?([\\d]+[.,][\\d]+)", "i"),
        new RegExp(label + "[\\s\\S]*?([\\d]+,[\\d]+)", "i"),
      ];
      for (const re of patterns) {
        const m = html.match(re);
        if (m) return m[1];
      }
      return undefined;
    };

    const strikePrice = parseGerman(extract("Basispreis"));
    const barrierLevel = parseGerman(extract("Stop-Loss Barriere"));
    const leverage = parseGerman(extract("Hebel"));
    const ratio = parseGerman(extract("Bezugsverh.{0,10}ltnis")) ?? parseGerman(extract("Bezugsverh"));


    // Extract bid + underlying from chart API
    let bid: number | null = null;
    let underlying: number | null = null;
    if (chartResp.ok) {
      try {
        const chart = await chartResp.json();
        const series: any[] = chart?.payload?.series ?? [];
        const productSeries = series.find((s: any) => s.isProduct === true);
        const underlyingSeries = series.find((s: any) => s.isProduct === false);
        bid = productSeries?.points?.[0]?.bid ?? null;
        underlying = underlyingSeries?.points?.[0]?.close ?? null;
      } catch { /* ignore chart parse errors */ }
    }

    return NextResponse.json({
      isin,
      strikePrice,
      barrierLevel,
      leverage,
      ratio,
      bid,
      underlying,
    });
  } catch (err) {
    console.error("[vontobel/product]", err);
    return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
  }
}
