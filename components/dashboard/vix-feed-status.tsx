"use client";

import { useEffect, useState } from "react";

export interface VixFeedQuote {
  timestamp?: number;
  price?: number;
  marketStatus?: string;
  source?: "yahoo" | "massive";
  feedMode?: "delayed" | "realtime" | "unknown";
  receivedAt?: number;
  delayMinutes?: number | null;
  feedError?: string;
}

const dateTime = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit",
  hour: "2-digit", minute: "2-digit",
});

export function VixFeedStatus({ quote }: { quote: VixFeedQuote | null | undefined }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const initial = setTimeout(() => setNow(Date.now()), 0);
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => { clearTimeout(initial); clearInterval(timer); };
  }, []);
  const sourceAt = quote?.timestamp;
  const validTime = typeof sourceAt === "number" && Number.isFinite(sourceAt) && sourceAt > 0;
  const age = validTime && now != null ? now - sourceAt : null;
  const future = age != null && age < 0;
  const maxAgeMinutes = quote?.source === "yahoo" && quote.feedMode === "delayed" ? 20 : 5;
  const stale = age != null && age > maxAgeMinutes * 60_000;
  const fresh = age != null && !future && !stale;
  const mode = quote?.feedMode;
  const closed = quote?.marketStatus?.toLowerCase() === "closed";
  const realtimeFresh = quote?.source === "massive" && mode === "realtime" && fresh && !closed && typeof quote.price === "number" && Number.isFinite(quote.price) && quote.price > 0;
  const source = quote?.source === "yahoo" ? "Yahoo Finance" : quote?.source === "massive" ? "Massive" : "unbekannt";
  const status = closed ? "Markt geschlossen"
    : future ? "Kurszeit unplausibel"
    : stale ? "Kurs veraltet"
    : realtimeFresh ? "Echtzeit"
    : mode === "delayed" ? "Verzögert"
    : "Aktualität unbekannt";
  return (
    <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-muted">
      <span>{source}</span>
      {validTime && <time dateTime={new Date(sourceAt).toISOString()} title="Kurszeit in Europe/Berlin">
        {dateTime.format(sourceAt)} Uhr
      </time>}
      <span className={realtimeFresh ? "text-accent" : closed ? "text-muted" : "text-amber-300"}>{status}</span>
      {quote?.feedError && <span title="Bevorzugter Datenfeed nicht verfügbar">· Ersatzquelle</span>}
    </div>
  );
}
