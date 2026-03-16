import * as cheerio from "cheerio";

export interface CertificateData {
  certificateId: string;
  name: string;
  isin: string;
  barrierLevel: number;
  leverageRatio: number;
  currentPrice: number;
  underlyingPrice: number;
  strikePrice: number;
  currency: string;
  lastUpdated: string;
  source: "scraped" | "manual";
  error?: string;
}

/**
 * Attempts to scrape certificate data from OnVista/OneToba.
 * Falls back gracefully — returns error field if scraping fails.
 */
export async function fetchCertificateData(
  certificateId: string
): Promise<Partial<CertificateData> & { error?: string }> {
  const urls = [
    `https://www.onvista.de/derivate/${certificateId}`,
    `https://www.onetoba.de/derivate/${certificateId}`,
    `https://www.finanzen.net/zertifikat/${certificateId}`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) continue;

      const html = await res.text();
      const $ = cheerio.load(html);

      // Try to extract from onvista.de structure
      const data = extractOnvista($, certificateId);
      if (data) return { ...data, source: "scraped", lastUpdated: new Date().toISOString() };
    } catch {
      continue;
    }
  }

  return {
    certificateId,
    source: "manual",
    error: "Konnte Daten nicht automatisch abrufen. Bitte manuell eingeben.",
  };
}

function extractOnvista(
  $: ReturnType<typeof cheerio.load>,
  certificateId: string
): Partial<CertificateData> | null {
  try {
    // Onvista structure (may change — update selectors as needed)
    const name =
      $("h1.headline__headline").first().text().trim() ||
      $('meta[property="og:title"]').attr("content") ||
      "";

    const isin =
      $('[data-label="ISIN"]').next().text().trim() ||
      $(".isin").first().text().replace("ISIN:", "").trim() ||
      "";

    // Price extraction
    const priceText =
      $('[data-label="Kurs"]').next().text().trim() ||
      $(".price-value").first().text().trim() ||
      "";
    const currentPrice = parseFloat(priceText.replace(",", ".").replace(/[^\d.]/g, "")) || 0;

    // Barrier extraction
    const barrierText =
      $('[data-label="Knock-Out-Barriere"]').next().text().trim() ||
      $('[data-label="Barriere"]').next().text().trim() ||
      $('[data-label="Barrier"]').next().text().trim() ||
      "";
    const barrierLevel = parseFloat(barrierText.replace(",", ".").replace(/[^\d.]/g, "")) || 0;

    // Leverage extraction
    const leverageText =
      $('[data-label="Hebel"]').next().text().trim() ||
      $('[data-label="Leverage"]').next().text().trim() ||
      "";
    const leverageRatio = parseFloat(leverageText.replace(",", ".").replace(/[^\d.]/g, "")) || 0;

    if (!name && !isin && barrierLevel === 0) return null;

    return {
      certificateId,
      name,
      isin,
      barrierLevel,
      leverageRatio,
      currentPrice,
      underlyingPrice: 0,
      strikePrice: 0,
      currency: "EUR",
    };
  } catch {
    return null;
  }
}
