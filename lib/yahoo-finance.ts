/* eslint-disable @typescript-eslint/no-explicit-any */
// yahoo-finance2 v3: must instantiate with new YahooFinance()
import YahooFinance from "yahoo-finance2";
const yahooFinance = new (YahooFinance as any)();

export interface VixQuote {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  timestamp: number;
}

export interface HistoricalPoint {
  date: string;
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
}

async function fetchQuote(symbol: string): Promise<VixQuote | null> {
  try {
    const result = await (yahooFinance as any).quote(symbol) as any;
    return {
      symbol,
      price: result.regularMarketPrice ?? 0,
      change: result.regularMarketChange ?? 0,
      changePct: result.regularMarketChangePercent ?? 0,
      high: result.regularMarketDayHigh ?? 0,
      low: result.regularMarketDayLow ?? 0,
      open: result.regularMarketOpen ?? 0,
      previousClose: result.regularMarketPreviousClose ?? 0,
      fiftyTwoWeekHigh: result.fiftyTwoWeekHigh ?? 0,
      fiftyTwoWeekLow: result.fiftyTwoWeekLow ?? 0,
      timestamp: result.regularMarketTime
        ? new Date(result.regularMarketTime).getTime()
        : Date.now(),
    };
  } catch (err) {
    console.error(`Error fetching quote for ${symbol}:`, err);
    return null;
  }
}

export async function getEurUsd(): Promise<number> {
  const quote = await fetchQuote("EURUSD=X");
  return quote?.price ?? 1.09;
}

export async function getVixSpot(): Promise<VixQuote | null> {
  return fetchQuote("^VIX");
}

/** VIX 3-Month index (^VIX3M) as futures proxy — best freely available via Yahoo Finance */
export async function getVixFutures(): Promise<VixQuote | null> {
  return fetchQuote("^VIX3M");
}

export async function getVixHistory(days = 90): Promise<HistoricalPoint[]> {
  try {
    const period1 = new Date();
    period1.setDate(period1.getDate() - days);

    const results = await (yahooFinance as any).historical("^VIX", {
      period1: period1.toISOString().split("T")[0],
      period2: new Date().toISOString().split("T")[0],
      interval: "1d",
    }) as any[];

    return results.map((r: any) => ({
      date: new Date(r.date).toISOString().split("T")[0],
      close: r.close ?? 0,
      open: r.open ?? 0,
      high: r.high ?? 0,
      low: r.low ?? 0,
      volume: r.volume ?? 0,
    }));
  } catch (err) {
    console.error("Error fetching VIX history:", err);
    return [];
  }
}

/** VIX 3-Month index (^VIX3M) — best freely-available proxy for VIX futures term structure */
export async function getVix3MHistory(days = 90): Promise<HistoricalPoint[]> {
  try {
    const period1 = new Date();
    period1.setDate(period1.getDate() - days);

    const results = await (yahooFinance as any).historical("^VIX3M", {
      period1: period1.toISOString().split("T")[0],
      period2: new Date().toISOString().split("T")[0],
      interval: "1d",
    }) as any[];

    return results.map((r: any) => ({
      date: new Date(r.date).toISOString().split("T")[0],
      close: r.close ?? 0,
      open: r.open ?? 0,
      high: r.high ?? 0,
      low: r.low ?? 0,
      volume: r.volume ?? 0,
    }));
  } catch (err) {
    console.error("Error fetching VIX3M history:", err);
    return [];
  }
}

export async function getSP500History(days = 90): Promise<HistoricalPoint[]> {
  try {
    const period1 = new Date();
    period1.setDate(period1.getDate() - days);

    const results = await (yahooFinance as any).historical("^GSPC", {
      period1: period1.toISOString().split("T")[0],
      period2: new Date().toISOString().split("T")[0],
      interval: "1d",
    }) as any[];

    return results.map((r: any) => ({
      date: new Date(r.date).toISOString().split("T")[0],
      close: r.close ?? 0,
      open: r.open ?? 0,
      high: r.high ?? 0,
      low: r.low ?? 0,
      volume: r.volume ?? 0,
    }));
  } catch (err) {
    console.error("Error fetching S&P 500 history:", err);
    return [];
  }
}

/** VIX 3-Month intraday (^VIX3M) at 5-min intervals — fallback for front-month futures */
export async function getVix3MIntraday(): Promise<HistoricalPoint[]> {
  try {
    const result = await (yahooFinance as any).chart("^VIX3M", {
      period1: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      interval: "5m",
    }) as any;

    const quotes: any[] = result?.quotes ?? [];

    return quotes
      .filter((q: any) => q.close !== null && q.close !== undefined)
      .map((q: any) => ({
        date: new Date(q.date).toISOString(),
        close: q.close ?? 0,
        open: q.open ?? 0,
        high: q.high ?? 0,
        low: q.low ?? 0,
        volume: q.volume ?? 0,
      }));
  } catch (err) {
    console.error("Error fetching VIX3M intraday:", err);
    return [];
  }
}

const DEFAULT_VONTOBEL_ISIN = "DE000VJ4MNF2";

export interface VontobelQuote {
  price: number;
  previousClose: number;
  high: number;
  low: number;
  name: string;
  timestamp: string;
}

/** Fetch current VIX Future price from Vontobel product page embedded data */
export async function getVontobelFuturesQuote(isin?: string): Promise<VontobelQuote | null> {
  const id = isin || DEFAULT_VONTOBEL_ISIN;
  try {
    const res = await fetch(
      `https://markets.vontobel.com/de-de/produkte/hebel/mini-futures/${id}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          Accept: "text/html",
        },
        signal: AbortSignal.timeout(10_000),
      }
    );
    if (!res.ok) return null;

    const html = await res.text();
    const match = html.match(/<script[^>]*>(\{"props":\{"pageProps":.*?})<\/script>/s);
    if (!match) return null;

    const data = JSON.parse(match[1]);
    const ad = data?.props?.pageProps?.additionalData;
    const underlying = ad?.underlyings?.[0];
    if (!underlying?.price) return null;

    const p = underlying.price;
    return {
      price: p.latest ?? 0,
      previousClose: p.performanceReference ?? p.previousClose ?? 0,
      high: p.dailyHigh ?? 0,
      low: p.dailyLow ?? 0,
      name: underlying.name ?? "VIX Future",
      timestamp: p.latestTimestamp ?? new Date().toISOString(),
    };
  } catch (err) {
    console.error("Error fetching Vontobel quote:", err);
    return null;
  }
}

interface VontobelPoint {
  timestamp: number;
  close?: number;
  bid?: number;
}

interface VontobelSeries {
  priceIdentifier: string;
  isProduct: boolean;
  points: VontobelPoint[];
}

/** Fetch real VIX futures intraday data from Vontobel chart API (08:00–22:00 CET) */
export async function getVixFuturesIntraday(isin?: string): Promise<HistoricalPoint[]> {
  const vontobelIsin = isin || DEFAULT_VONTOBEL_ISIN;
  try {
    const url = `https://markets.vontobel.com/api/v1/charts/products/${vontobelIsin}/detail/0/0?c=de-de`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) throw new Error(`Vontobel API ${res.status}`);

    const data = await res.json();
    const series: VontobelSeries[] = data?.payload?.series ?? [];

    // Series with isProduct=false is the underlying VIX Future
    const futureSeries = series.find((s) => !s.isProduct);
    if (!futureSeries) return getVix3MIntraday();

    return futureSeries.points
      .filter((p) => p.close != null)
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((p) => ({
        date: new Date(p.timestamp).toISOString(),
        close: p.close ?? 0,
        open: p.close ?? 0,
        high: p.close ?? 0,
        low: p.close ?? 0,
        volume: 0,
      }));
  } catch (err) {
    console.error("Error fetching VIX futures from Vontobel, falling back to VIX3M:", err);
    return getVix3MIntraday();
  }
}

/** Fetch Vontobel certificate (product) intraday bid prices */
export async function getVontobelCertificateIntraday(isin?: string): Promise<HistoricalPoint[]> {
  const vontobelIsin = isin || DEFAULT_VONTOBEL_ISIN;
  try {
    const url = `https://markets.vontobel.com/api/v1/charts/products/${vontobelIsin}/detail/0/0?c=de-de`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) throw new Error(`Vontobel API ${res.status}`);

    const data = await res.json();
    const series: VontobelSeries[] = data?.payload?.series ?? [];

    // Series with isProduct=true is the certificate bid price
    const productSeries = series.find((s) => s.isProduct);
    if (!productSeries) return [];

    return productSeries.points
      .filter((p) => p.bid != null)
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((p) => ({
        date: new Date(p.timestamp).toISOString(),
        close: p.bid ?? 0,
        open: p.bid ?? 0,
        high: p.bid ?? 0,
        low: p.bid ?? 0,
        volume: 0,
      }));
  } catch (err) {
    console.error("Error fetching Vontobel certificate intraday:", err);
    return [];
  }
}

/** E-mini S&P 500 front-month futures (ES=F) — real-time quote */
export async function getSpFutures(): Promise<VixQuote | null> {
  return fetchQuote("ES=F");
}

/** Fetch current bid price for a Vontobel certificate by ISIN */
export async function getVontobelCertificatePrice(
  isin: string
): Promise<number | null> {
  try {
    const resp = await fetch(
      `https://markets.vontobel.com/api/v1/charts/products/${isin}/detail/0/0?c=de-de`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Referer: "https://markets.vontobel.com/",
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "de-DE,de;q=0.9",
        },
        signal: AbortSignal.timeout(8_000),
      }
    );
    if (!resp.ok) return null;
    const json = await resp.json();
    const series: any[] = json?.payload?.series ?? [];
    const productSeries = series.find((s: any) => s.isProduct === true);
    return productSeries?.points?.[0]?.bid ?? null;
  } catch {
    return null;
  }
}

export async function getVixIntraday(): Promise<HistoricalPoint[]> {
  try {
    const result = await (yahooFinance as any).chart("^VIX", {
      period1: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      interval: "5m",
    }) as any;

    const quotes: any[] = result?.quotes ?? [];

    return quotes
      .filter((q: any) => q.close !== null && q.close !== undefined)
      .map((q: any) => ({
        date: new Date(q.date).toISOString(),
        close: q.close ?? 0,
        open: q.open ?? 0,
        high: q.high ?? 0,
        low: q.low ?? 0,
        volume: q.volume ?? 0,
      }));
  } catch (err) {
    console.error("Error fetching VIX intraday:", err);
    return [];
  }
}
