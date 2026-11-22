"use client";

import { useMemo, useState } from "react";
import { VixFeedStatus, type VixFeedQuote } from "@/components/dashboard/vix-feed-status";
import { StrategyCapital } from "@/components/dashboard/strategy-capital";
import useSWR, { useSWRConfig } from "swr";
import dynamic from "next/dynamic";
import { RefreshCw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SignalSummaryCard, SignalBanner, LevelBar } from "@/components/dashboard/signal-card";
import { useSignalOverview, levelProgress } from "@/lib/use-signal-overview";
import { formatNumber, formatPct, formatDateTime } from "@/lib/utils";
import { getRefreshInterval } from "@/lib/trading-hours";

// Recharts (~200 KB) aus dem Seiten-Bundle halten — Charts laden nach der Hydration nach.
// Platzhalter mit fixer Höhe verhindern Layout-Shift beim Nachladen.
const VixHistoryChart = dynamic(
  () => import("@/components/charts/VixHistoryChart").then((m) => m.VixHistoryChart),
  { ssr: false, loading: () => <div style={{ height: 280 }} /> }
);
const VixIntradayChart = dynamic(
  () => import("@/components/charts/VixIntradayChart").then((m) => m.VixIntradayChart),
  { ssr: false, loading: () => <div style={{ height: 200 }} /> }
);
const CertificateIntradayChart = dynamic(
  () => import("@/components/charts/CertificateIntradayChart").then((m) => m.CertificateIntradayChart),
  { ssr: false, loading: () => <div style={{ height: 220 }} /> }
);

interface VixData {
  spot: VixFeedQuote & {
    price: number;
    change: number;
    changePct: number;
    high: number;
    low: number;
    open: number;
    previousClose: number;
    fiftyTwoWeekHigh: number;
    fiftyTwoWeekLow: number;
  } | null;
  futures: {
    price: number;
    change: number;
    changePct: number;
    open: number;
    previousClose: number;
    high: number;
    low: number;
    fiftyTwoWeekHigh: number;
    fiftyTwoWeekLow: number;
  } | null;
  vontobelFuture: {
    price: number;
    previousClose: number;
    high: number;
    low: number;
    name: string;
    timestamp: string;
  } | null;
  futureChangePct?: number | null;
  futureSource?: "vontobel" | "yahoo-vix3m" | null;
  spread: number | null;
  zScore: string;
  rollingMean: string;
  rollingWindowDays: number;
  timestamp: number;
  eurUsd: number;
}

interface HistoricalData {
  vix: { date: string; close: number }[];
  vix3m: { date: string; close: number }[];
  sp500: { date: string; close: number }[];
}

interface IntradayPoint {
  date: string;
  close: number;
}

interface IntradayData {
  vix: IntradayPoint[];
  vix3m: IntradayPoint[];
}

interface Position {
  id: string;
  certificateId: string;
  direction: "long" | "short";
  name: string;
  entryVix: number;
  entryPrice: number;
  barrierLevel: number;
  currentBarrier: number;
  leverageRatio: number;
  currentPrice: number;
  trailingStopFloor: number | null;
  peakPnlPct: number | null;
  trades: Array<{
    exitDate: string | null;
    strikePrice: number | null;
    ratio: number | null;
    quantity: number | null;
  }>;
}

interface Trade {
  id: string;
  positionId: string | null;
  notes: string;
  certificateId: string;
  direction: "long" | "short";
  entryDate: string;
  exitDate: string | null;
  entryVix: number;
  barrierLevel: number;
  strikePrice: number | null;
  leverageRatio: number | null;
  ratio: number | null;
  entryPrice: number | null;
  exitPrice: number | null;
  quantity: number | null;
  returnPct: number | null;
}

const EMPTY_POSITIONS: Position[] = [];
const EMPTY_TRADES: Trade[] = [];

type Period = "1d" | "1w" | "1m" | "3m" | "1y" | "5y" | "10y";

const PERIOD_LABELS: Record<Period, string> = {
  "1d": "1T",
  "1w": "1W",
  "1m": "1M",
  "3m": "3M",
  "1y": "1J",
  "5y": "5J",
  "10y": "10J",
};


interface VontobelPrice {
  bid: number | null;
  underlying: number | null;
  timestamp: number | null;
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>("1d");
  const [refreshing, setRefreshing] = useState(false);
  const { mutate: globalMutate } = useSWRConfig();

  // SWR data hooks — cached across navigations, auto-revalidate
  const { data: vixData, error: vixError, isLoading: vixLoading } = useSWR<VixData>("/api/vix/spot", { refreshInterval: getRefreshInterval() });
  const { data: history, error: historyError } = useSWR<HistoricalData>(
    period !== "1d" ? `/api/vix/historical?period=${period}&view=chart` : null, { keepPreviousData: false }
  );
  const { data: intraday, error: intradayError } = useSWR<IntradayData>(
    "/api/vix/historical?type=intraday",
    { refreshInterval: getRefreshInterval() }
  );
  const { data: positionsData, error: positionsError, isLoading: positionsLoading } = useSWR<Position[]>("/api/positions", { refreshInterval: getRefreshInterval() });
  const { data: tradesData, error: tradesError, isLoading: tradesLoading } = useSWR<Trade[]>("/api/trades", { refreshInterval: getRefreshInterval() });
  const positions = positionsData ?? EMPTY_POSITIONS;
  const trades = tradesData ?? EMPTY_TRADES;
  const openTrades = useMemo(() => trades.filter((t) => !t.exitDate), [trades]);

  const { data: settings, error: settingsError } = useSWR<{ vixLowThreshold: number }>("/api/settings");
  const signalOverview = useSignalOverview();

  // Batch: Vontobel prices + intraday for all positions in a single request
  const allBatchIsins = useMemo(() => {
    const positionIds = positions.map((p) => p.certificateId);
    const tradeIsins = openTrades.map((t) => t.certificateId).filter((id) => /^[A-Z0-9]{12}$/.test(id));
    return [...new Set([...positionIds, ...tradeIsins])].sort();
  }, [positions, openTrades]);
  const { data: batchData, error: batchError } = useSWR<{
    prices: Record<string, VontobelPrice>;
    intraday: Record<string, IntradayPoint[]>;
  }>(
    allBatchIsins.length > 0 ? `/api/vontobel/batch?isins=${allBatchIsins.join(",")}` : null,
    { refreshInterval: getRefreshInterval() }
  );
  const positionPrices = useMemo(() => batchData?.prices ?? {}, [batchData?.prices]);
  const certIntraday = batchData?.intraday ?? {};

  const loading = (!vixData && vixLoading) || (!positionsData && positionsLoading) || (!tradesData && tradesLoading);
  const unavailable = (!vixData && vixError) || (!positionsData && positionsError) || (!tradesData && tradesError);
  const warnings = [
    vixError && vixData && "VIX-Daten",
    positionsError && positionsData && "Positionen",
    tradesError && tradesData && "Trades",
    (period === "1d" ? intradayError : historyError) && "Chartdaten",
    batchError && "Zertifikatskurse",
    settingsError && "Einstellungen",
  ].filter(Boolean);

  // Precomputed P&L for all positions — avoids recalculating inside map() on every render
  // Must be declared before any early return to satisfy React's Rules of Hooks
  const positionPnls = useMemo(() => {
    const result: Record<string, {
      bid: number | null;
      underlying: number | null;
      pnlPct: number | null;
      pnlEur: number | null;
      trade: Position["trades"][0] | undefined;
    }> = {};
    for (const pos of positions) {
      const vPrice = positionPrices[pos.certificateId];
      const bid = vPrice?.bid ?? null;
      const trade = pos.trades.find(t => !t.exitDate);
      const pnlPct = bid != null && pos.entryPrice > 0
        ? (bid - pos.entryPrice) / pos.entryPrice * 100 : null;
      const quantity = pos.trades.filter(t => !t.exitDate).reduce((sum, t) => sum + (t.quantity ?? 0), 0);
      const pnlEur = bid != null && pos.entryPrice > 0 && quantity > 0
        ? (bid - pos.entryPrice) * quantity : null;
      result[pos.id] = { bid, underlying: vPrice?.underlying ?? null, pnlPct, pnlEur, trade };
    }
    return result;
  }, [positions, positionPrices]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await globalMutate(
      (key: unknown) => {
        if (typeof key === "string") {
          return key.startsWith("/api/vix/") ||
            key.startsWith("/api/positions") ||
            key.startsWith("/api/trades") ||
            key.startsWith("/api/vontobel/batch") ||
            key.startsWith("/api/alerts") ||
            key.startsWith("/api/settings");
        }
        if (Array.isArray(key)) {
          return key[0] === "vontobel-batch";
        }
        return false;
      },
      undefined,
      { revalidate: true }
    );
    } finally { setRefreshing(false); }
  };

  // Closing is a real broker execution: collect actual price/date in the editor.
  const handleCloseTrade = (trade: Trade) => {
    window.location.assign(trade.notes?.startsWith("signal:") ? "/signals" : `/trades?edit=${encodeURIComponent(trade.id)}`);
  };
  const handleClosePosition = (pos: Position) => {
    const trade = openTrades.find(t => t.positionId === pos.id);
    if (trade) handleCloseTrade(trade);
    else window.location.assign("/trades");
  };

  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
  };

  const vix = vixData?.spot;
  const futures = vixData?.futures;
  const vFuture = vixData?.vontobelFuture;
  const zScore = parseFloat(vixData?.zScore ?? "0");
  const rollingMean = parseFloat(vixData?.rollingMean ?? "0");
  const rollingWindowDays = vixData?.rollingWindowDays ?? 30;
  const spread = vixData?.spread;

  const getVixZone = (price: number) => {
    if (price <= 14) return { label: "Sehr Niedrig", variant: "success" as const };
    if (price <= 18) return { label: "Niedrig", variant: "accent" as const };
    if (price <= 25) return { label: "Normal", variant: "default" as const };
    if (price <= 35) return { label: "Erhöht", variant: "warning" as const };
    return { label: "Extrem Hoch", variant: "danger" as const };
  };

  const zone = vix ? getVixZone(vix.price) : null;

  if (unavailable) {
    return <div role="alert" className="p-6 text-red-400">Dashboard-Daten konnten nicht geladen werden. Bitte prüfe deine Verbindung und lade die Seite erneut.</div>;
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#B8E15A] border-t-transparent mx-auto mb-3" />
          <p style={{ color: "#8B8FA8" }}>Lade VIX Daten...</p>
        </div>
      </div>
    );
  }

  // Server liefert Preis + Änderung aus derselben Quelle (vontobel | yahoo-vix3m) —
  // identisch mit dem iOS-Widget; lokale Neuberechnung nur als Fallback für alte Cache-Payloads
  const futurePrice = vFuture ? vFuture.price : futures ? futures.price : null;
  const futureChangePct =
    vixData?.futureChangePct ??
    (vFuture
      ? (vFuture.previousClose ? ((vFuture.price - vFuture.previousClose) / vFuture.previousClose) * 100 : 0)
      : (futures?.changePct ?? 0));

  const levels = signalOverview?.levels ?? [];
  const progress = levelProgress(levels, vix?.price);
  const vxPremium = vFuture && vix && vix.price > 0 ? (vFuture.price / vix.price - 1) * 100 : null;
  const daysLeft = signalOverview?.futureDaysLeft != null ? Math.floor(signalOverview.futureDaysLeft) : null;
  const rangePct = vix && vix.high !== vix.low ? clamp(((vix.price - vix.low) / (vix.high - vix.low)) * 100) : 50;
  const zColor = Math.abs(zScore) >= 2 ? "text-danger" : Math.abs(zScore) >= 1.5 ? "text-warning" : "text-accent";
  const today = new Date().toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", weekday: "short", day: "numeric", month: "short" });
  const fetchedAt = vixData?.timestamp ? formatDateTime(new Date(vixData.timestamp)) : null;

  const chart = (height: number) => period === "1d" ? (
    <VixIntradayChart data={intraday?.vix ?? []} futuresData={intraday?.vix3m ?? []} height={height} levels={levels} />
  ) : (
    <VixHistoryChart data={history?.vix ?? []} futuresData={history?.vix3m ?? []} threshold={settings?.vixLowThreshold ?? 15} height={height} period={period} levels={levels} />
  );

  const periodButtons = (list: Period[], small = false) => list.map((p) => (
    <button
      key={p}
      onClick={() => handlePeriodChange(p)}
      aria-pressed={period === p}
      className={`rounded-lg font-medium transition-colors ${small ? "px-2.5 py-1.5 text-[11px]" : "px-3 py-1.5 text-xs"} ${period === p ? "bg-accent font-semibold text-black" : "text-muted hover:text-white"}`}
    >
      {PERIOD_LABELS[p]}
    </button>
  ));

  const refreshButton = (label?: string) => (
    <button
      onClick={() => handleRefresh()}
      aria-label={label ? undefined : "Dashboard aktualisieren"}
      disabled={refreshing}
      className="flex h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3 text-sm font-medium text-white disabled:opacity-60"
    >
      <RefreshCw size={16} aria-hidden="true" className={`text-muted ${refreshing ? "animate-spin" : ""}`} />
      {label}
    </button>
  );

  const certCharts = (height: number) => positions.map((pos) => {
    const chartData = certIntraday[pos.certificateId];
    if (!chartData || chartData.length === 0) return null;
    return (
      <section key={`cert-${height}-${pos.id}`} className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="mb-2 text-sm font-semibold text-white">Zertifikat Intraday <span className="font-mono text-xs font-normal text-muted">· {pos.certificateId}</span></h2>
        <CertificateIntradayChart data={chartData} entryPrice={pos.entryPrice} direction={pos.direction} name={pos.name || pos.certificateId} height={height} />
      </section>
    );
  });

  return (
    <div className="p-4 lg:p-0">
      {warnings.length > 0 && <p role="alert" className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200 lg:mx-8 lg:mt-6">Aktualisierung fehlgeschlagen: {warnings.join(", ")}. Vorhandene Daten können veraltet sein.</p>}

      {/* ============ MOBILE LAYOUT (< lg) — Entwurf D ============ */}
      <div className="flex flex-col gap-3.5 lg:hidden">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-[13px] text-muted">{today}</p>
            <h1 className="mt-0.5 text-[26px] font-bold leading-tight text-white">Dashboard</h1>
          </div>
          {refreshButton()}
        </header>

        <section className="rounded-3xl border border-border bg-surface p-[18px]">
          <div className="flex items-center gap-2 whitespace-nowrap text-[13px] text-muted">VIX Spot {zone && <Badge variant={zone.variant}>{zone.label}</Badge>}</div>
          <div className="mt-2 flex items-baseline gap-2.5">
            <span className="font-mono text-[54px] font-semibold leading-none tracking-tight text-white">{vix ? formatNumber(vix.price) : "—"}</span>
            {vix && <span className={`font-mono text-[15px] ${vix.change >= 0 ? "text-success" : "text-danger"}`}>{formatPct(vix.changePct)}</span>}
          </div>
          <VixFeedStatus quote={vixData?.spot} variant="pill" className="mt-2.5" />
          <div className="mt-2 h-[70px]">
            {intraday?.vix && intraday.vix.length > 0 && <VixIntradayChart data={intraday.vix} height={70} minimal />}
          </div>
          {signalOverview && levels.length > 0 && (
            <div className="mt-3">
              <LevelBar overview={signalOverview} vix={vix?.price ?? null} />
              <p className="mt-1.5 text-xs text-muted">
                {progress.reached === 0 ? "Noch keine Kaufstufe erreicht" : `Kaufstufe ${progress.reached} von ${levels.length} erreicht`}
                {progress.next && ` · nächste bei ${progress.next.level}`}
              </p>
            </div>
          )}
        </section>

        <SignalBanner overview={signalOverview} />

        <div className="grid grid-cols-2 gap-2.5">
          <section className="rounded-[18px] border border-border bg-surface p-3.5">
            <h2 className="text-xs text-muted">{vFuture ? "VIX Future" : "VIX3M · Proxy"}</h2>
            <p className="mt-1 font-mono text-[22px] font-semibold text-white">{futurePrice ? formatNumber(futurePrice) : "—"}</p>
            <p className="text-xs text-muted">
              {spread != null ? <>Spread <span className={spread >= 0 ? "text-success" : "text-danger"}>{spread >= 0 ? "+" : ""}{formatNumber(spread)}</span></> : (vFuture || futures) ? formatPct(futureChangePct) : "—"}
            </p>
          </section>
          <section className="rounded-[18px] border border-border bg-surface p-3.5">
            <h2 className="text-xs text-muted">Z-Score {rollingWindowDays}T</h2>
            <p className={`mt-1 font-mono text-[22px] font-semibold ${zColor}`}>{zScore >= 0 ? "+" : ""}{formatNumber(zScore, 2)}σ</p>
            <p className="text-xs text-muted">Ø {formatNumber(rollingMean, 2)}</p>
          </section>
        </div>

        {vix && (
          <section className="rounded-[18px] border border-border bg-surface p-3.5">
            <div className="flex items-center justify-between text-xs text-muted">
              <h2>Tages-Range</h2>
              <span className="font-mono"><span className="text-white">{formatNumber(vix.low)}</span> – <span className="text-white">{formatNumber(vix.high)}</span> · VT {formatNumber(vix.previousClose)}</span>
            </div>
            <div className="relative mt-2.5 h-1.5 rounded-full bg-border">
              <span className="absolute -top-1 h-3.5 w-1 -translate-x-1/2 rounded-sm bg-accent" style={{ left: `${rangePct}%` }} />
            </div>
          </section>
        )}

        {openTrades.map((trade) => {
          const liveBid = positionPrices[trade.certificateId]?.bid ?? null;
          const pnlPct = liveBid != null && trade.entryPrice != null && trade.entryPrice > 0 ? ((liveBid - trade.entryPrice) / trade.entryPrice) * 100 : null;
          const pnlEur = liveBid != null && trade.entryPrice != null && trade.entryPrice > 0 && trade.quantity ? (liveBid - trade.entryPrice) * trade.quantity : null;
          const investment = trade.entryPrice && trade.quantity ? trade.entryPrice * trade.quantity : null;
          const pos = positions.find((p) => p.id === trade.positionId);
          return (
            <section key={`m-trade-${trade.id}`} className="flex flex-col gap-3 rounded-[18px] border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <DirectionPill direction={trade.direction} />
                  <p className="mt-1.5 truncate font-mono text-xs text-muted">{trade.certificateId}{trade.leverageRatio != null && ` · ${formatNumber(trade.leverageRatio, 1)}×`}</p>
                </div>
                <div className="text-right">
                  {pnlPct != null ? (
                    <>
                      <p className={`font-mono text-xl font-semibold ${pnlPct >= 0 ? "text-success" : "text-danger"}`}>{pnlPct >= 0 ? "+" : ""}{formatNumber(pnlPct, 1)} %</p>
                      {pnlEur != null && <p className="text-xs text-muted">{pnlEur >= 0 ? "+" : ""}{pnlEur.toFixed(0)} € unrealisiert</p>}
                    </>
                  ) : (
                    <>
                      <p className="font-mono text-xl font-semibold text-white">{investment ? `${investment.toFixed(0)} €` : "—"}</p>
                      <p className="text-xs text-muted">investiert</p>
                    </>
                  )}
                </div>
              </div>
              {pos && <TrailingBar pnlPct={pnlPct} floor={pos.trailingStopFloor} peak={pos.peakPnlPct} />}
              <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                <span className="text-xs text-muted">
                  Ein {trade.entryPrice != null ? `${formatNumber(trade.entryPrice, 2)} €` : "—"} · Bid {liveBid != null ? `${formatNumber(liveBid, 2)} €` : "—"} · Barrier {formatNumber(trade.barrierLevel, 1)}
                </span>
                <button onClick={() => handleCloseTrade(trade)} className="min-h-9 shrink-0 rounded-full bg-border px-3 text-xs font-medium text-white">Ausführung erfassen</button>
              </div>
            </section>
          );
        })}

        <section className="rounded-[18px] border border-border bg-surface p-3">
          <div className="mb-2 flex items-center gap-1">
            <h2 className="mr-auto pl-1 text-sm font-semibold text-white">{period === "1d" ? "Intraday" : "Verlauf"}</h2>
            {periodButtons(["1d", "1w", "1m", "3m", "1y", "5y", "10y"], true)}
          </div>
          {chart(200)}
        </section>

        {certCharts(160)}

        <StrategyCapital variant="compact" />
      </div>

      {/* ============ DESKTOP LAYOUT (lg+) — Evolution 2 ============ */}
      <div className="hidden flex-col gap-5 px-8 py-7 lg:flex">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight text-white">Dashboard</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-muted">
              <VixFeedStatus quote={vixData?.spot} variant="pill" />
              <span>{vixData?.spot?.source === "massive" ? "Massive" : "Yahoo Finance"}{fetchedAt && ` · abgerufen ${fetchedAt}`}</span>
            </div>
          </div>
          {refreshButton("Aktualisieren")}
        </header>

        <section className="grid grid-cols-3 gap-5">
          <div className="col-span-2 flex min-w-0 flex-col gap-4 rounded-[20px] border border-border bg-surface p-6">
            <div className="flex flex-wrap items-end justify-between gap-5">
              <div>
                <div className="flex items-center gap-2.5 text-[13px] text-muted">VIX Spot {zone && <Badge variant={zone.variant}>{zone.label}</Badge>}</div>
                <div className="mt-2 flex items-baseline gap-3.5">
                  <span className="font-mono text-6xl font-semibold leading-none tracking-tighter text-white">{vix ? formatNumber(vix.price) : "—"}</span>
                  {vix && <span className={`font-mono text-base ${vix.change >= 0 ? "text-success" : "text-danger"}`}>{vix.change >= 0 ? "▲" : "▼"} {vix.change >= 0 ? "+" : ""}{formatNumber(vix.change)} · {formatPct(vix.changePct)}</span>}
                </div>
              </div>
              <div role="group" aria-label="Zeitraum" className="flex rounded-xl border border-border bg-background p-1">
                {periodButtons(["1d", "1w", "1m", "3m", "1y", "5y", "10y"])}
              </div>
            </div>
            {chart(260)}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted">
              <span><span aria-hidden="true" className="text-accent">━</span> VIX</span>
              <span><span aria-hidden="true" className="text-warning">━</span> VIX3M</span>
              {levels.length > 0 && <span><span aria-hidden="true" className="text-accent">┅</span> Kaufstufen {levels.map((l) => l.level.toLocaleString("de-DE")).join(" / ")}</span>}
              {vix && (
                <span className="ml-auto font-mono">
                  O {formatNumber(vix.open)} · H {formatNumber(vix.high)} · T {formatNumber(vix.low)} · VT {formatNumber(vix.previousClose)}
                  {vix.fiftyTwoWeekHigh > 0 && ` · 52W ${formatNumber(vix.fiftyTwoWeekLow)}–${formatNumber(vix.fiftyTwoWeekHigh)}`}
                </span>
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            <section className="flex flex-col gap-2.5 rounded-[20px] border border-border bg-surface p-5">
              <div className="flex items-center justify-between text-[13px] text-muted">
                <h2>{vFuture ? "VIX Future" : "VIX3M · Index-Proxy"}</h2>
                {vFuture ? <Badge variant="accent">Vontobel</Badge> : futures ? <Badge variant="muted">VIX3M</Badge> : null}
              </div>
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-[32px] font-semibold text-white">{futurePrice ? formatNumber(futurePrice) : "—"}</span>
                {(vFuture || futures) && <span className={`font-mono text-sm ${futureChangePct >= 0 ? "text-success" : "text-danger"}`}>{formatPct(futureChangePct)}</span>}
              </div>
              <dl className="flex flex-col gap-1.5 border-t border-border pt-2.5 text-[13px]">
                {spread != null && <Row label="Spread zum Spot"><span className={spread >= 0 ? "text-success" : "text-danger"}>{spread >= 0 ? "+" : ""}{formatNumber(spread)}</span></Row>}
                {vxPremium != null && <Row label="Aufschlag (max. 15 %)">{vxPremium >= 0 ? "+" : ""}{formatNumber(vxPremium, 1)} %</Row>}
                {daysLeft != null && <Row label="VX-Restlaufzeit">{daysLeft} Tage <span className={daysLeft >= 30 ? "text-success" : "text-warning"}>{daysLeft >= 30 ? "✓" : "< 30"}</span></Row>}
                {vFuture && <Row label="Hoch / Tief">{formatNumber(vFuture.high)} / {formatNumber(vFuture.low)}</Row>}
                {!vFuture && futures && <p className="text-xs text-muted">Fallback: Yahoo VIX 3M</p>}
              </dl>
            </section>

            <section className="flex flex-col gap-3 rounded-[20px] border border-border bg-surface p-5">
              <h2 className="text-[13px] text-muted">Z-Score · {rollingWindowDays}T</h2>
              <div className="flex items-baseline justify-between">
                <span className={`font-mono text-[32px] font-semibold ${zColor}`}>{zScore >= 0 ? "+" : ""}{formatNumber(zScore, 2)}σ</span>
                <span className="text-[13px] text-muted">Ø {formatNumber(rollingMean, 2)}</span>
              </div>
              <div className="relative h-1.5 rounded-full bg-border" role="img" aria-label={`Z-Score ${formatNumber(zScore, 2)} auf einer Skala von minus 3 bis plus 3`}>
                <span className="absolute -top-[5px] h-4 w-1 -translate-x-1/2 rounded-sm bg-white" style={{ left: `${clamp(((zScore + 3) / 6) * 100)}%` }} />
              </div>
              <div className="flex justify-between font-mono text-[11px] text-muted"><span>−3σ</span><span>0</span><span>+3σ</span></div>
            </section>
          </div>
        </section>

        <section className="grid grid-cols-3 items-start gap-5">
          <SignalSummaryCard overview={signalOverview} vix={vix?.price ?? null} />

          <div className="flex min-w-0 flex-col gap-5">
            {positions.length === 0 ? (
              <article className="rounded-2xl border border-border bg-surface p-5">
                <h2 className="text-sm font-semibold text-white">Offene Position</h2>
                <p className="mt-3 text-sm text-muted">Keine offenen Positionen</p>
              </article>
            ) : positions.map((pos) => {
              const { bid, underlying, pnlPct, pnlEur } = positionPnls[pos.id] ?? { bid: null, underlying: null, pnlPct: null, pnlEur: null };
              const barrierDist = vix ? Math.abs(vix.price - pos.currentBarrier) / pos.currentBarrier * 100 : null;
              return (
                <article key={pos.id} className="flex flex-col gap-3.5 rounded-2xl border border-border bg-surface p-5">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-white">Offene Position</h2>
                    <div className="flex items-center gap-1.5">
                      <DirectionPill direction={pos.direction} />
                      <button onClick={() => handleClosePosition(pos)} title="Tatsächliche Ausführung erfassen" aria-label="Position schließen" className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-white/5 hover:text-white">
                        <X size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{pos.name || "Mini Future"}</p>
                      <p className="truncate font-mono text-[11px] text-muted">{pos.certificateId} · {formatNumber(pos.leverageRatio, 1)}×</p>
                    </div>
                    {pnlPct != null && (
                      <div className="text-right">
                        <p className={`font-mono text-[22px] font-semibold ${pnlPct >= 0 ? "text-success" : "text-danger"}`}>{pnlPct >= 0 ? "+" : ""}{formatNumber(pnlPct, 1)} %</p>
                        {pnlEur != null && <p className="text-xs text-muted">{pnlEur >= 0 ? "+" : ""}{formatNumber(pnlEur, 0)} €</p>}
                      </div>
                    )}
                  </div>
                  <TrailingBar pnlPct={pnlPct} floor={pos.trailingStopFloor} peak={pos.peakPnlPct} />
                  {barrierDist != null && (
                    <div>
                      <div className="mb-1.5 flex justify-between text-xs text-muted"><span>Abstand Barrier {formatNumber(pos.currentBarrier)}</span><span className="text-white">{formatNumber(barrierDist, 0)} %</span></div>
                      <div className="h-1.5 rounded-full bg-border"><div className="h-1.5 rounded-full bg-muted" style={{ width: `${clamp(barrierDist)}%` }} /></div>
                    </div>
                  )}
                  <p className="text-xs text-muted">
                    Ein {formatNumber(pos.entryPrice, 2)} €{bid != null && ` · Bid ${formatNumber(bid, 2)} €`} · VIX-Einstieg {formatNumber(pos.entryVix)}{underlying != null && ` · VIX-F ${formatNumber(underlying, 2)}`}
                  </p>
                </article>
              );
            })}
          </div>

          <StrategyCapital variant="compact" />
        </section>

        {positions.some((p) => (certIntraday[p.certificateId]?.length ?? 0) > 0) && (
          <div className="grid grid-cols-2 gap-5">{certCharts(220)}</div>
        )}
      </div>
    </div>
  );
}

function clamp(n: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, n));
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="whitespace-nowrap text-right font-mono text-white">{children}</dd>
    </div>
  );
}

function DirectionPill({ direction }: { direction: "long" | "short" }) {
  return direction === "long"
    ? <span className="rounded-md bg-[#5B8DEF]/15 px-2 py-0.5 text-[11px] font-semibold text-[#7AA7FF]">LONG</span>
    : <span className="rounded-md bg-danger/15 px-2 py-0.5 text-[11px] font-semibold text-[#FF8A8A]">SHORT</span>;
}

/** Return vs. trailing-stop floor and peak, on a scale from 0 to a bit above the peak. */
function TrailingBar({ pnlPct, floor, peak }: { pnlPct: number | null; floor: number | null; peak: number | null }) {
  if (floor == null) return null;
  const top = Math.max(peak ?? 0, pnlPct ?? 0, floor, 1) * 1.25;
  const fill = pnlPct != null ? clamp((pnlPct / top) * 100) : 0;
  const mark = clamp((floor / top) * 100);
  const below = pnlPct != null && pnlPct < floor;
  return (
    <div>
      <div className="mb-1.5 flex justify-between gap-2 text-xs text-muted">
        <span>Trailing · Floor {formatNumber(floor, 1)} %{peak != null && ` · Peak ${formatNumber(peak, 1)} %`}</span>
        {pnlPct != null && <span className={below ? "text-danger" : "text-white"}>{below ? "unter Floor" : `${formatNumber(pnlPct - floor, 1)} Pkt Puffer`}</span>}
      </div>
      <div className="relative h-1.5 rounded-full bg-border">
        <div className={`h-1.5 rounded-full ${below ? "bg-danger" : "bg-success"}`} style={{ width: `${fill}%` }} />
        <span aria-hidden="true" className="absolute -top-1 h-3.5 w-0.5 bg-danger" style={{ left: `${mark}%` }} />
      </div>
    </div>
  );
}
