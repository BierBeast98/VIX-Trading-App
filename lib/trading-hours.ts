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
  const parts = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);

  const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0");
  const totalMinutes = h * 60 + m;

  return totalMinutes >= 7 * 60 && totalMinutes <= 22 * 60 + 30;
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
