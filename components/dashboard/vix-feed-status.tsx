"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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

const dateTime = (time: number) => new Date(time).toLocaleString("de-DE", {
  timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
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
  const status = [mode === "delayed" ? "Verzögerter Kurs" : realtimeFresh ? "Echtzeitkurs" : "Aktualität unbekannt", closed ? "Markt geschlossen" : null, future ? "Kurszeit liegt in der Zukunft" : stale ? `Kurs älter als ${maxAgeMinutes} Minuten` : null].filter(Boolean).join(" · ");
  const ageText = age != null && !future ? ` · ${Math.floor(age / 60_000)} Min. alt` : "";
  return (
    <div className="mt-3 text-xs leading-relaxed" style={{ color: "#8B8FA8" }}>
      <div>Quelle: {source} · <span style={{ color: realtimeFresh ? "#B8E15A" : "#F59E0B" }}>{status}</span></div>
      <div>VIX-Kurszeit: {validTime ? `${dateTime(sourceAt)} Uhr (Berlin)${ageText}` : "unbekannt"}</div>
      {mode === "delayed" && quote?.delayMinutes != null && <div>Verzögerung: {quote.delayMinutes} Min.</div>}
      {mode === "delayed" && <div>Yahoo-Kurse sind typischerweise etwa 15 Minuten verzögert; die Signalprüfung ist alle 5 Minuten vorgesehen. <Link href="/signals" className="underline text-[#B8E15A]">Datenregeln im Signalbereich</Link></div>}
      {quote?.feedError && <div style={{ color: "#F59E0B" }}>Bevorzugter Datenfeed nicht verfügbar.</div>}
    </div>
  );
}
