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
const clock = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });

type Tone = "live" | "warn" | "muted";

function useFeedStatus(quote: VixFeedQuote | null | undefined) {
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
  const tone: Tone = realtimeFresh ? "live" : closed ? "muted" : "warn";
  return { sourceAt: validTime ? sourceAt : null, source, status, tone };
}

const toneClass: Record<Tone, { text: string; bg: string; dot: string }> = {
  live: { text: "text-accent", bg: "bg-accent/10", dot: "bg-accent" },
  warn: { text: "text-amber-300", bg: "bg-amber-300/10", dot: "bg-amber-300" },
  muted: { text: "text-muted", bg: "bg-white/5", dot: "bg-muted" },
};

/**
 * Freshness of the VIX quote. `line` is the full text row, `pill` a compact badge
 * (status · Kurszeit) for headers and hero cards.
 */
export function VixFeedStatus({ quote, variant = "line", className = "" }: { quote: VixFeedQuote | null | undefined; variant?: "line" | "pill"; className?: string }) {
  const { sourceAt, source, status, tone } = useFeedStatus(quote);
  if (variant === "pill") {
    const t = toneClass[tone];
    return (
      <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${t.bg} ${t.text} ${className}`}
        title={`${source}${quote?.feedError ? " · Ersatzquelle" : ""}`}>
        <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
        {status}
        {sourceAt != null && <time dateTime={new Date(sourceAt).toISOString()} className="font-normal opacity-80">· {clock.format(sourceAt)}</time>}
      </span>
    );
  }
  return (
    <div className={`mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-muted ${className}`}>
      <span>{source}</span>
      {sourceAt != null && <time dateTime={new Date(sourceAt).toISOString()} title="Kurszeit in Europe/Berlin">
        {dateTime.format(sourceAt)} Uhr
      </time>}
      <span className={toneClass[tone].text}>{status}</span>
      {quote?.feedError && <span title="Bevorzugter Datenfeed nicht verfügbar">· Ersatzquelle</span>}
    </div>
  );
}
