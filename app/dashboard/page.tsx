"use client";

import { useMemo, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { TrendingUp, TrendingDown, RefreshCw, Activity, Bell as BellIcon } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VixHistoryChart } from "@/components/charts/VixHistoryChart";
import { VixIntradayChart } from "@/components/charts/VixIntradayChart";
import { CertificateIntradayChart } from "@/components/charts/CertificateIntradayChart";
import { formatNumber, formatPct, formatDateTime } from "@/lib/utils";
import { getRefreshInterval } from "@/lib/trading-hours";

interface VixData {
  spot: {
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
    strikePrice: number | null;
    ratio: number | null;
    quantity: number | null;
  }>;
}

interface Trade {
  id: string;
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

interface AlertLog {
  id: string;
  alertType: string;
  message: string;
  vixLevel: number | null;
  sentAt: string;
  acknowledged: boolean;
}

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
  const { data: vixData } = useSWR<VixData>("/api/vix/spot", { refreshInterval: getRefreshInterval() });
  const { data: history } = useSWR<HistoricalData>(
    period !== "1d" ? `/api/vix/historical?period=${period}` : null
  );
  const { data: intraday } = useSWR<IntradayData>(
    "/api/vix/historical?type=intraday",
    { refreshInterval: getRefreshInterval() }
  );
  const { data: positions = [] } = useSWR<Position[]>("/api/positions", { refreshInterval: getRefreshInterval() });
  const { data: trades = [] } = useSWR<Trade[]>("/api/trades", { refreshInterval: getRefreshInterval() });
  const openTrades = useMemo(() => trades.filter((t) => !t.exitDate), [trades]);
  const { data: alertsData } = useSWR<{ alerts: AlertLog[] }>("/api/alerts?limit=10");
  const alerts = alertsData?.alerts ?? [];
  const { data: settings } = useSWR<{ vixLowThreshold: number }>("/api/settings");

  // Batch: Vontobel prices + intraday for all positions in a single request
  const positionIds = positions.map((p) => p.certificateId);
  const allBatchIsins = useMemo(() => {
    const tradeIsins = openTrades.map((t) => t.certificateId).filter((id) => /^[A-Z0-9]{12}$/.test(id));
    return [...new Set([...positionIds, ...tradeIsins])];
  }, [positionIds, openTrades]);
  const { data: batchData } = useSWR<{
    prices: Record<string, VontobelPrice>;
    intraday: Record<string, IntradayPoint[]>;
  }>(
    allBatchIsins.length > 0 ? ["vontobel-batch", ...allBatchIsins] : null,
    async () => {
      const isins = allBatchIsins.join(",");
      try {
        const res = await fetch(`/api/vontobel/batch?isins=${isins}`);
        if (res.ok) return res.json();
      } catch { /* noop */ }
      return { prices: {}, intraday: {} };
    },
    { refreshInterval: getRefreshInterval() }
  );
  const positionPrices = batchData?.prices ?? {};
  const certIntraday = batchData?.intraday ?? {};

  const loading = !vixData && !intraday;

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
      const trade = pos.trades[0];
      const pnlPct = bid != null && pos.entryPrice > 0
        ? (bid - pos.entryPrice) / pos.entryPrice * 100 : null;
      const pnlEur = bid != null && pos.entryPrice > 0 && trade?.quantity
        ? (bid - pos.entryPrice) * trade.quantity : null;
      result[pos.id] = { bid, underlying: vPrice?.underlying ?? null, pnlPct, pnlEur, trade };
    }
    return result;
  }, [positions, positionPrices]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await globalMutate(
      (key: unknown) => {
        if (typeof key === "string") {
          return key.startsWith("/api/vix/") ||
            key.startsWith("/api/positions") ||
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
    setRefreshing(false);
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

  // Vontobel VIX Future — take underlying from any position
  const vontobelUnderlying = Object.values(positionPrices).find((p) => p.underlying != null)?.underlying ?? null;

  const getVixZone = (price: number) => {
    if (price <= 14) return { label: "Sehr Niedrig", variant: "success" as const };
    if (price <= 18) return { label: "Niedrig", variant: "accent" as const };
    if (price <= 25) return { label: "Normal", variant: "default" as const };
    if (price <= 35) return { label: "Erhöht", variant: "warning" as const };
    return { label: "Extrem Hoch", variant: "danger" as const };
  };

  const zone = vix ? getVixZone(vix.price) : null;

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

  const futurePrice = vFuture ? vFuture.price : futures ? futures.price : null;
  const futureChangePct = vFuture
    ? (vFuture.previousClose ? ((vFuture.price - vFuture.previousClose) / vFuture.previousClose) * 100 : 0)
    : (futures?.changePct ?? 0);

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">

      {/* ============ MOBILE LAYOUT (< lg) ============ */}
      <div className="lg:hidden space-y-3">
        {/* Mobile Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Dashboard</h1>
          <button
            onClick={() => handleRefresh()}
            className="p-2 rounded-xl"
            style={{ background: "#1A1A22" }}
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} style={{ color: "#8B8FA8" }} />
          </button>
        </div>

        {/* Hero VIX SPOT Card */}
        <div
          className="rounded-2xl p-4 relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #141418 0%, #1a2418 100%)",
            border: "1px solid #1E1E28",
          }}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "#8B8FA8" }}>VIX SPOT</span>
                {zone && <Badge variant={zone.variant}>{zone.label}</Badge>}
              </div>
              <div className="text-4xl font-bold text-white">
                {vix ? formatNumber(vix.price) : "—"}
              </div>
              {vix && (
                <div
                  className="flex items-center gap-1 text-sm font-medium mt-1"
                  style={{ color: vix.change >= 0 ? "#22C55E" : "#FF4D4D" }}
                >
                  {vix.change >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {formatPct(vix.changePct)} heute
                </div>
              )}
              {spread !== null && spread !== undefined && (
                <div className="text-xs mt-2" style={{ color: "#8B8FA8" }}>
                  Spread zum Future: <span style={{ color: spread >= 0 ? "#22C55E" : "#FF4D4D" }}>
                    {spread >= 0 ? "+" : ""}{formatNumber(spread)}
                  </span>
                </div>
              )}
            </div>
            {/* Mini sparkline area on right side */}
            <div className="w-[110px] h-[50px] mt-2 opacity-70">
              {intraday?.vix && intraday.vix.length > 0 && (
                <VixIntradayChart data={intraday.vix} height={50} minimal />
              )}
            </div>
          </div>
        </div>

        {/* Period Buttons + Chart */}
        <div className="flex items-center gap-1.5">
          {(["1d", "1w", "1m", "3m"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => handlePeriodChange(p)}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={
                period === p
                  ? { background: "#B8E15A", color: "#000" }
                  : { background: "#1E1E28", color: "#8B8FA8" }
              }
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
          <div className="flex-1" />
          {(["1y", "5y", "10y"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => handlePeriodChange(p)}
              className="px-2.5 py-1.5 rounded-full text-[10px] font-medium transition-all"
              style={
                period === p
                  ? { background: "#B8E15A", color: "#000" }
                  : { background: "#1E1E28", color: "#8B8FA8" }
              }
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {/* Intraday / History Chart */}
        <div className="rounded-2xl p-3" style={{ background: "#141418", border: "1px solid #1E1E28" }}>
          {period === "1d" ? (
            <VixIntradayChart
              data={intraday?.vix ?? []}
              futuresData={intraday?.vix3m ?? []}
              height={200}
            />
          ) : (
            <VixHistoryChart
              data={history?.vix ?? []}
              futuresData={history?.vix3m ?? []}
              threshold={settings?.vixLowThreshold ?? 15}
              height={200}
              period={period}
            />
          )}
        </div>

        {/* VIX Future + Z-Score + Tages-Range compact cards */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* VIX Future */}
          <div className="rounded-2xl p-3" style={{ background: "#141418", border: "1px solid #1E1E28" }}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "#8B8FA8" }}>VIX Future</span>
              {vFuture && <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: "rgba(184,225,90,0.15)", color: "#B8E15A" }}>Vontobel</span>}
            </div>
            <div className="text-2xl font-bold text-white">
              {futurePrice ? formatNumber(futurePrice) : "—"}
            </div>
            {(vFuture || futures) && (
              <div
                className="flex items-center gap-1 text-xs font-medium mt-1"
                style={{ color: futureChangePct >= 0 ? "#22C55E" : "#FF4D4D" }}
              >
                {futureChangePct >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {formatPct(futureChangePct)}
              </div>
            )}
            {spread !== null && spread !== undefined && (
              <div className="text-[10px] mt-1" style={{ color: "#8B8FA8" }}>
                Spread: <span style={{ color: spread >= 0 ? "#22C55E" : "#FF4D4D" }}>
                  {spread >= 0 ? "+" : ""}{formatNumber(spread)}
                </span>
              </div>
            )}
          </div>

          {/* Z-Score */}
          <div className="rounded-2xl p-3" style={{ background: "#141418", border: "1px solid #1E1E28" }}>
            <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "#8B8FA8" }}>Z-Score ({rollingWindowDays}T)</span>
            <div
              className="text-2xl font-bold mt-1.5"
              style={{
                color: Math.abs(zScore) >= 2 ? "#FF4D4D"
                  : Math.abs(zScore) >= 1.5 ? "#F59E0B" : "#B8E15A",
              }}
            >
              {zScore >= 0 ? "+" : ""}{formatNumber(zScore, 2)}σ
            </div>
            <div className="text-[10px] mt-1" style={{ color: "#8B8FA8" }}>
              Ø {formatNumber(rollingMean, 2)}
            </div>
          </div>
        </div>

        {/* Tages-Range (full width) */}
        {vix && (
          <div className="rounded-2xl p-3" style={{ background: "#141418", border: "1px solid #1E1E28" }}>
            <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "#8B8FA8" }}>Tages-Range</span>
            <div className="flex items-center justify-between mt-2 mb-1.5">
              <span className="text-xs font-medium" style={{ color: "#22C55E" }}>H: {formatNumber(vix.high)}</span>
              <span className="text-xs" style={{ color: "#8B8FA8" }}>Vorher: {formatNumber(vix.previousClose)}</span>
              <span className="text-xs font-medium" style={{ color: "#FF4D4D" }}>T: {formatNumber(vix.low)}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#1E1E28" }}>
              <div
                className="h-full rounded-full"
                style={{
                  background: "#B8E15A",
                  width: vix.high !== vix.low
                    ? `${((vix.price - vix.low) / (vix.high - vix.low)) * 100}%`
                    : "50%",
                }}
              />
            </div>
          </div>
        )}

        {/* Certificate Chart (if positions) */}
        {positions.map((pos) => {
          const chartData = certIntraday[pos.certificateId];
          if (!chartData || chartData.length === 0) return null;
          return (
            <div key={`cert-m-${pos.id}`} className="rounded-2xl p-3" style={{ background: "#141418", border: "1px solid #1E1E28" }}>
              <p className="text-xs font-medium mb-2" style={{ color: "#8B8FA8" }}>
                Zertifikat — {pos.certificateId}
              </p>
              <CertificateIntradayChart
                data={chartData}
                entryPrice={pos.entryPrice}
                direction={pos.direction}
                name={pos.name || pos.certificateId}
                height={160}
              />
            </div>
          );
        })}

        {/* Mobile Position Card — uses trade data for accuracy */}
        {openTrades.length > 0 && (
          <div className="space-y-2.5">
            {openTrades.map((trade) => {
              const investment = trade.entryPrice && trade.quantity ? trade.entryPrice * trade.quantity : null;
              const abstand = trade.entryVix && trade.barrierLevel
                ? ((trade.entryVix - trade.barrierLevel) / trade.entryVix * 100) : null;
              const liveBid = positionPrices[trade.certificateId]?.bid ?? null;
              const pnlPct = liveBid && trade.entryPrice
                ? ((liveBid - trade.entryPrice) / trade.entryPrice) * 100 : null;
              const pnlEur = liveBid && trade.entryPrice && trade.quantity
                ? (liveBid - trade.entryPrice) * trade.quantity : null;
              return (
                <div
                  key={`dash-hero-${trade.id}`}
                  className="rounded-2xl p-4 relative overflow-hidden"
                  style={{
                    background: trade.direction === "long"
                      ? "linear-gradient(135deg, #141418 0%, #141a24 100%)"
                      : "linear-gradient(135deg, #141418 0%, #1e1418 100%)",
                    border: "1px solid #1E1E28",
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "#8B8FA8" }}>Offene Position</span>
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                          style={{
                            background: trade.direction === "long" ? "rgba(59,130,246,0.15)" : "rgba(255,77,77,0.15)",
                            color: trade.direction === "long" ? "#3B82F6" : "#FF4D4D",
                          }}
                        >
                          {trade.direction === "long" ? "LONG" : "SHORT"}
                        </span>
                      </div>
                      <div className="text-lg font-bold text-white font-mono">{trade.certificateId}</div>
                    </div>
                    <div className="text-right">
                      {pnlPct != null ? (
                        <>
                          <div className="text-2xl font-bold" style={{ color: pnlPct >= 0 ? "#22C55E" : "#FF4D4D" }}>
                            {pnlPct >= 0 ? "+" : ""}{formatNumber(pnlPct, 1)}%
                          </div>
                          {pnlEur != null && (
                            <div className="text-sm font-medium" style={{ color: pnlPct >= 0 ? "#22C55E" : "#FF4D4D" }}>
                              {pnlEur >= 0 ? "+" : ""}{pnlEur.toFixed(0)} €
                            </div>
                          )}
                          <span className="text-[10px]" style={{ color: "#8B8FA8" }}>Unrealisiert</span>
                        </>
                      ) : (
                        <>
                          <div className="text-2xl font-bold text-white">
                            {investment ? `${investment.toFixed(0)} €` : "—"}
                          </div>
                          <span className="text-[10px]" style={{ color: "#8B8FA8" }}>Investiert</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <span className="text-[10px] block" style={{ color: "#8B8FA8" }}>Einstieg</span>
                      <span className="text-sm font-medium text-white">
                        {trade.entryPrice != null ? `${formatNumber(trade.entryPrice, 2)} €` : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] block" style={{ color: "#8B8FA8" }}>Aktuell</span>
                      <span className="text-sm font-medium" style={{ color: liveBid != null ? "#fff" : "#8B8FA8" }}>
                        {liveBid != null ? `${formatNumber(liveBid, 2)} €` : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] block" style={{ color: "#8B8FA8" }}>Hebel</span>
                      <span className="text-sm font-medium" style={{ color: "#B8E15A" }}>
                        {trade.leverageRatio != null ? `×${formatNumber(trade.leverageRatio, 2)}` : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] block" style={{ color: "#8B8FA8" }}>Barrier</span>
                      <span className="text-sm font-medium text-white">{formatNumber(trade.barrierLevel, 1)}</span>
                      {abstand != null && (
                        <span className="text-[10px] ml-0.5" style={{ color: abstand < 15 ? "#FF4D4D" : abstand < 30 ? "#F59E0B" : "#22C55E" }}>
                          {abstand.toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-2.5" style={{ borderTop: "1px solid #1E1E28" }}>
                    <span className="text-[10px]" style={{ color: "#8B8FA8" }}>
                      {new Date(trade.entryDate).toLocaleDateString("de-DE")} · {trade.quantity} Stück · VIX {formatNumber(trade.entryVix)}
                    </span>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: "#B8E15A" }}>
                      <BellIcon size={14} className="text-black" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ============ DESKTOP LAYOUT (lg+) ============ */}
      <div className="hidden lg:block space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <p className="text-sm mt-0.5" style={{ color: "#8B8FA8" }}>
              {vixData?.timestamp
                ? `Zuletzt aktualisiert: ${formatDateTime(new Date(vixData.timestamp))}`
                : "Lade..."}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleRefresh()}
            loading={refreshing}
          >
            <RefreshCw size={14} />
            Aktualisieren
          </Button>
        </div>

        {/* VIX Metrics Row */}
        <div className="grid grid-cols-4 gap-4">
          {/* VIX Spot */}
          <Card>
            <CardHeader>
              <CardTitle>VIX Spot</CardTitle>
              {zone && <Badge variant={zone.variant}>{zone.label}</Badge>}
            </CardHeader>
            <div className="text-4xl font-bold text-white mb-2">
              {vix ? formatNumber(vix.price) : "—"}
            </div>
            {vix && (
              <div className="space-y-1">
                <div
                  className="flex items-center gap-1.5 text-sm font-medium"
                  style={{ color: vix.change >= 0 ? "#22C55E" : "#FF4D4D" }}
                >
                  {vix.change >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {formatPct(vix.changePct)} heute
                </div>
                <div className="text-xs" style={{ color: "#8B8FA8" }}>
                  Open: <span className="text-white">{formatNumber(vix.open)}</span>
                  <span className="mx-1.5" style={{ color: "#2E2E3A" }}>|</span>
                  Vorher: <span className="text-white">{formatNumber(vix.previousClose)}</span>
                </div>
                {vix.fiftyTwoWeekHigh > 0 && (
                  <div className="flex items-center gap-2 text-xs pt-0.5">
                    <span style={{ color: "#8B8FA8" }}>52W</span>
                    <span style={{ color: "#22C55E" }}>H: {formatNumber(vix.fiftyTwoWeekHigh)}</span>
                    <span style={{ color: "#FF4D4D" }}>T: {formatNumber(vix.fiftyTwoWeekLow)}</span>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* VIX Future */}
          <Card>
            <CardHeader>
              <CardTitle>VIX Future</CardTitle>
              {vFuture && <Badge variant="accent">Vontobel</Badge>}
            </CardHeader>
            <div className="text-3xl font-bold text-white mb-2">
              {futurePrice ? formatNumber(futurePrice) : "—"}
            </div>
            {(vFuture || futures) && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-sm font-medium"
                  style={{ color: futureChangePct >= 0 ? "#22C55E" : "#FF4D4D" }}>
                  {futureChangePct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {formatPct(futureChangePct)} heute
                </div>
                {spread !== null && spread !== undefined && vix && (
                  <div className="text-sm" style={{ color: "#8B8FA8" }}>
                    Spread:{" "}
                    <span style={{ color: spread >= 0 ? "#22C55E" : "#FF4D4D" }}>
                      {spread >= 0 ? "+" : ""}{formatNumber(spread)}
                    </span>
                  </div>
                )}
                {vFuture && (
                  <div className="text-xs" style={{ color: "#8B8FA8" }}>
                    H: <span className="text-white">{formatNumber(vFuture.high)}</span>
                    <span className="mx-1.5" style={{ color: "#2E2E3A" }}>|</span>
                    T: <span className="text-white">{formatNumber(vFuture.low)}</span>
                    <span className="mx-1.5" style={{ color: "#2E2E3A" }}>|</span>
                    Vorher: <span className="text-white">{formatNumber(vFuture.previousClose)}</span>
                  </div>
                )}
                {!vFuture && futures && (
                  <div className="text-xs" style={{ color: "#8B8FA8" }}>Fallback: Yahoo VIX 3M</div>
                )}
              </div>
            )}
          </Card>

          {/* Z-Score */}
          <Card>
            <CardHeader>
              <CardTitle>Z-Score ({rollingWindowDays}T)</CardTitle>
            </CardHeader>
            <div
              className="text-3xl font-bold mb-2"
              style={{
                color: Math.abs(zScore) >= 2 ? "#FF4D4D"
                  : Math.abs(zScore) >= 1.5 ? "#F59E0B" : "#B8E15A",
              }}
            >
              {zScore >= 0 ? "+" : ""}{formatNumber(zScore, 2)}σ
            </div>
            <div className="text-sm" style={{ color: "#8B8FA8" }}>
              Ø {formatNumber(rollingMean, 2)}
            </div>
          </Card>

          {/* Tages-Range */}
          <Card>
            <CardHeader>
              <CardTitle>Tages-Range</CardTitle>
            </CardHeader>
            {vix ? (
              <>
                <div className="flex justify-between text-sm mb-2">
                  <span style={{ color: "#22C55E" }}>H: {formatNumber(vix.high)}</span>
                  <span style={{ color: "#FF4D4D" }}>T: {formatNumber(vix.low)}</span>
                </div>
                <div className="text-sm" style={{ color: "#8B8FA8" }}>
                  Vorher: {formatNumber(vix.previousClose)}
                </div>
                <div className="mt-2">
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#1E1E28" }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        background: "#B8E15A",
                        width: vix.high !== vix.low
                          ? `${((vix.price - vix.low) / (vix.high - vix.low)) * 100}%`
                          : "50%",
                      }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="text-2xl font-bold" style={{ color: "#8B8FA8" }}>—</div>
            )}
          </Card>
        </div>

        {/* Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-white">
              {period === "1d" ? "VIX Intraday (5 Min)" : "VIX Verlauf"}
            </CardTitle>
            <div className="flex flex-wrap gap-1">
              {(["1d", "1w", "1m", "3m", "1y", "5y", "10y"] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => handlePeriodChange(p)}
                  className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
                  style={
                    period === p
                      ? { background: "#B8E15A", color: "#000" }
                      : { background: "#1E1E28", color: "#8B8FA8" }
                  }
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          </CardHeader>
          {period === "1d" ? (
            <VixIntradayChart data={intraday?.vix ?? []} futuresData={intraday?.vix3m ?? []} height={280} />
          ) : (
            <VixHistoryChart data={history?.vix ?? []} futuresData={history?.vix3m ?? []} threshold={settings?.vixLowThreshold ?? 15} height={280} period={period} />
          )}
        </Card>

        {/* Certificate Intraday Charts */}
        {positions.map((pos) => {
          const chartData = certIntraday[pos.certificateId];
          if (!chartData || chartData.length === 0) return null;
          return (
            <Card key={`cert-d-${pos.id}`}>
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-white">
                  Zertifikat Intraday — {pos.certificateId}
                </CardTitle>
              </CardHeader>
              <CertificateIntradayChart data={chartData} entryPrice={pos.entryPrice} direction={pos.direction} name={pos.name || pos.certificateId} height={220} />
            </Card>
          );
        })}

        {/* Positions & Alerts Row */}
        <div className="grid grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-white">Offene Positionen</CardTitle>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#1E1E28", color: "#8B8FA8" }}>
                {positions.length}
              </span>
            </CardHeader>
            {positions.length === 0 ? (
              <p className="text-sm py-4 text-center" style={{ color: "#8B8FA8" }}>Keine offenen Positionen</p>
            ) : (
              <div className="space-y-3">
                {positions.map((pos) => {
                  const barrierDist = vix ? Math.abs(vix.price - pos.currentBarrier) / pos.currentBarrier * 100 : null;
                  const { bid, underlying, pnlPct, pnlEur } = positionPnls[pos.id] ?? { bid: null, underlying: null, pnlPct: null, pnlEur: null };
                  return (
                    <div key={pos.id} className="p-3 rounded-xl" style={{ background: "#1A1A22", border: "1px solid #1E1E28" }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-white">{pos.certificateId}</span>
                            <span className="px-1 py-0.5 rounded text-[10px] font-semibold leading-none"
                              style={{
                                background: pos.direction === "long" ? "rgba(59, 130, 246, 0.15)" : "rgba(255, 77, 77, 0.15)",
                                color: pos.direction === "long" ? "#3B82F6" : "#FF4D4D",
                              }}>
                              {pos.direction === "long" ? "LONG" : "SHORT"}
                            </span>
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: "#8B8FA8" }}>
                            Barrier: {formatNumber(pos.currentBarrier)} | Hebel: {formatNumber(pos.leverageRatio, 1)}x
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm" style={{ color: "#8B8FA8" }}>VIX-Einstieg: {formatNumber(pos.entryVix)}</div>
                          {barrierDist !== null && <div className="text-xs" style={{ color: "#8B8FA8" }}>Dist: {formatNumber(barrierDist, 1)}%</div>}
                        </div>
                      </div>
                      {bid != null && (
                        <div className="flex items-center justify-between mt-2 pt-2 text-xs" style={{ borderTop: "1px solid #1E1E28" }}>
                          <div style={{ color: "#8B8FA8" }}>
                            Ein: <span className="text-white">{formatNumber(pos.entryPrice, 2)} €</span>
                            {" · "}Bid: <span className="text-white">{formatNumber(bid, 2)} €</span>
                            {underlying != null && <span style={{ color: "#4A4A5A" }}> · VIX-F {formatNumber(underlying, 2)}</span>}
                          </div>
                          <div className="font-medium" style={{ color: (pnlPct ?? 0) >= 0 ? "#22C55E" : "#FF4D4D" }}>
                            {pnlPct != null ? `${pnlPct >= 0 ? "+" : ""}${formatNumber(pnlPct, 1)}%` : ""}
                            {pnlEur != null && <span className="ml-1.5 font-normal" style={{ color: "#8B8FA8" }}>({pnlEur >= 0 ? "+" : ""}{formatNumber(pnlEur, 0)} €)</span>}
                          </div>
                        </div>
                      )}
                      {pos.trailingStopFloor != null && (
                        <div className="flex items-center justify-between mt-1.5 pt-1.5 text-xs" style={{ borderTop: "1px solid #1E1E28" }}>
                          <div className="flex items-center gap-1.5" style={{ color: "#8B8FA8" }}>
                            <span>Trailing Stop</span>
                            <span className="px-1.5 py-0.5 rounded font-medium"
                              style={{
                                background: pnlPct != null && pnlPct < pos.trailingStopFloor ? "rgba(255, 77, 77, 0.15)" : "rgba(34, 197, 94, 0.15)",
                                color: pnlPct != null && pnlPct < pos.trailingStopFloor ? "#FF4D4D" : "#22C55E",
                              }}>
                              Floor: {formatNumber(pos.trailingStopFloor, 1)}%
                            </span>
                          </div>
                          {pos.peakPnlPct != null && <span style={{ color: "#4A4A5A" }}>Peak: {formatNumber(pos.peakPnlPct, 1)}%</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold text-white">Letzte Alerts</CardTitle>
                {alerts.filter((a) => !a.acknowledged).length > 0 && (
                  <Badge variant="danger">{alerts.filter((a) => !a.acknowledged).length} neu</Badge>
                )}
              </div>
              <a href="/alerts" className="text-xs font-medium transition-colors" style={{ color: "#B8E15A" }}>Alle anzeigen →</a>
            </CardHeader>
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 gap-2">
                <Activity size={24} style={{ color: "#8B8FA8" }} />
                <p className="text-sm" style={{ color: "#8B8FA8" }}>Keine Alerts</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[240px] overflow-y-auto">
                {alerts.slice(0, 8).map((alert) => {
                  const typeColors: Record<string, string> = { entry: "#B8E15A", stddev: "#F59E0B", spike: "#FF4D4D", trailingStop: "#3B82F6", event: "#8B5CF6" };
                  return (
                    <div key={alert.id} className="flex gap-3 p-2.5 rounded-lg" style={{ background: "#1A1A22" }}>
                      <div className="mt-0.5 h-2 w-2 rounded-full flex-shrink-0" style={{ background: typeColors[alert.alertType] ?? "#8B8FA8" }} />
                      <div className="min-w-0">
                        <p className="text-xs text-white leading-snug line-clamp-2">{alert.message}</p>
                        <p className="text-xs mt-0.5" style={{ color: "#4A4A5A" }}>{formatDateTime(alert.sentAt)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
