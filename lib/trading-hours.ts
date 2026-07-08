/**
 * Trading-Hours utility — VIX certificates are liquid Mon–Fri 07:00–22:30 CET.
 * Uses Intl.DateTimeFormat with "Europe/Berlin" for correct CET/CEST (DST) handling.
 * Works identically on server (Node.js) and client (browser).
 */

/**
 * Returns true if the current local time in Europe/Berlin is within 07:00–22:30.
 * Called on every SWR revalidation cycle to decide whether to auto-refresh.
 */
export function isWithinTradingHours(): boolean {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Berlin",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);

  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  if (weekday === "Sat" || weekday === "Sun") return false;

  const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  const totalMinutes = h * 60 + m;

  return totalMinutes >= 7 * 60 && totalMinutes <= 22 * 60 + 30;
}

/** Kalendertag in Europe/Berlin als "YYYY-MM-DD" — Handelstags-Grenze für Alert-Erinnerungen */
export function berlinDay(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * UTC-Instant für eine Berlin-Wanduhrzeit (z.B. "2026-07-29", "20:00").
 * Ermittelt den korrekten CET/CEST-Offset des Zieldatums via Intl —
 * `new Date("...T20:00:00")` würde die Server-Zeitzone verwenden.
 */
export function berlinDateTime(date: string, time: string): Date {
  const approx = new Date(`${date}T${time}:00Z`);
  const offsetPart = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Berlin",
    timeZoneName: "longOffset",
  })
    .formatToParts(approx)
    .find((p) => p.type === "timeZoneName")?.value; // z.B. "GMT+02:00"
  const offset = offsetPart?.replace("GMT", "") || "+01:00";
  return new Date(`${date}T${time}:00${offset}`);
}

/** 5-minute refresh interval in milliseconds */
export const TRADING_INTERVAL = 5 * 60_000; // 300 000 ms

/**
 * Returns the SWR refreshInterval:
 * - Within trading hours (07:00–22:30 CET): 300 000 ms (5 min)
 * - Outside trading hours: 0 (no automatic refresh)
 */
export function getRefreshInterval(): number {
  return isWithinTradingHours() ? TRADING_INTERVAL : 0;
}
