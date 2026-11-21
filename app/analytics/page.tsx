"use client";

import { useState } from "react";
import useSWR from "swr";
import dynamic from "next/dynamic";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPct, formatNumber } from "@/lib/utils";
import { runBacktest, type PerformanceMetrics } from "@/lib/analytics";

// Recharts (~200 KB) aus dem Seiten-Bundle halten — Charts laden nach der Hydration nach
const EntryBucketChart = dynamic(
  () => import("@/components/charts/EntryBucketChart").then((m) => m.EntryBucketChart),
  { ssr: false, loading: () => <div style={{ height: 200 }} /> }
);
const BacktestTradeChart = dynamic(
  () => import("@/components/charts/BacktestTradeChart").then((m) => m.BacktestTradeChart),
  { ssr: false, loading: () => <div style={{ height: 280 }} /> }
);

type Metrics = PerformanceMetrics;
interface CapitalData {
  currentCapital: number | null;
  startingCapital: number | null;
  availableCapital: number | null;
  investedCapital: number;
  allocationCapital: number | null;
  asOf: string | null;
  source: string | null;
  realizedPnlEur: number | null;
  returnPct: number | null;
  annualizedReturnPct: number | null;
}

interface EntryBucket {
  range: string;
  count: number;
  avgReturn: number;
  winRate: number;
}

interface AnalyticsData {
  metrics: Metrics;
  entryAnalysis: EntryBucket[];
}

export default function AnalyticsPage() {
  const { data, isLoading: loading, error: analyticsError } = useSWR<AnalyticsData>("/api/analytics");
  const { data: capitalData, error: capitalError } = useSWR<CapitalData>("/api/account-capital");

  // Backtesting state
  const [btDirection, setBtDirection] = useState<"long" | "short">("long");
  const [btThreshold, setBtThreshold] = useState("15");
  const [btTargetReturn, setBtTargetReturn] = useState("18");
  const [btStepPct, setBtStepPct] = useState("5");
  const [btLeverage, setBtLeverage] = useState("2");
  const [btMaxHold, setBtMaxHold] = useState("60");
  const [btStopLoss, setBtStopLoss] = useState("0");
  const [btKnockout, setBtKnockout] = useState("0");
  const [btResult, setBtResult] = useState<ReturnType<typeof runBacktest> | null>(null);
  const [btRunning, setBtRunning] = useState(false);
  const [btError, setBtError] = useState<string | null>(null);
  const [btHistory, setBtHistory] = useState<{ date: string; close: number }[]>([]);

  const runBt = async () => {
    setBtRunning(true);
    setBtError(null);
    try {
      const res = await fetch(`/api/vix/historical?period=1y`);
      if (!res.ok) throw new Error("Historische Kurse konnten nicht geladen werden.");
      const histData = await res.json();
      const spotHistory = histData.vix ?? [];
      setBtHistory(spotHistory);
      setBtResult(runBacktest(spotHistory, {
        direction: btDirection,
        entryThreshold: parseFloat(btThreshold),
        targetReturnPct: parseFloat(btTargetReturn),
        stepPct: parseFloat(btStepPct),
        leverageRatio: parseFloat(btLeverage),
        maxHoldDays: parseInt(btMaxHold, 10),
        stopLossPct: parseFloat(btStopLoss),
        knockoutBarrierPct: parseFloat(btKnockout),
      }));
    } catch {
      setBtResult(null);
      setBtError("Historische Kurse konnten nicht geladen werden. Bitte erneut versuchen.");
    } finally {
      setBtRunning(false);
    }
  };

  const m = data?.metrics;

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
  const fmtEur = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
  const totalKpi = { label: "Realisierter G/V (brutto)", value: m && m.tradesWithEurData > 0 ? fmtEur(m.totalPnlEur) : "—", color: (m?.totalPnlEur ?? 0) >= 0 ? "#22C55E" : "#FF4D4D" };

  const kpis = m ? [
    { label: "Win Rate", value: m.analyzedTrades ? formatPct(m.winRate * 100, 0) : "—", color: m.winRate >= 0.5 ? "#22C55E" : "#FF4D4D" },
    { label: "Ø Rendite", value: m.analyzedTrades ? formatPct(m.avgReturn) : "—", color: m.avgReturn >= 0 ? "#22C55E" : "#FF4D4D" },
    { label: "Ø Haltetage", value: m.closedTrades > m.invalidDateTrades ? `${m.avgHoldDays.toFixed(1)}d` : "—", color: "#8B8FA8" },
    { label: "Rendite / Streuung je Trade", value: m.analyzedTrades >= 2 ? formatNumber(m.sharpeRatio, 2) : "—", color: m.sharpeRatio >= 1 ? "#22C55E" : "#F59E0B" },
    { label: "Bester Trade", value: m.analyzedTrades ? formatPct(m.bestTrade) : "—", color: "#22C55E" },
    { label: "Schlechtester Trade", value: m.analyzedTrades ? formatPct(m.worstTrade) : "—", color: "#FF4D4D" },
    totalKpi,
    { label: "Alert-getriggert", value: `${m.alertTriggeredCount}/${m.analyzedTrades}`, color: "#B8E15A" },
  ] : [];

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
      <h1 className="text-2xl font-bold text-white">Analytics</h1>

      {analyticsError && <p className="text-sm text-[#F59E0B]">Trade-Kennzahlen konnten nicht geladen werden. Bitte erneut laden; angezeigte ältere Werte können veraltet sein.</p>}
      {capitalError && <p className="text-sm text-[#F59E0B]">Strategiekapital konnte nicht geladen werden.</p>}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#B8E15A] border-t-transparent" />
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map(({ label, value, color }) => (
              <Card key={label}>
                <div className="text-xs mb-1" style={{ color: "#8B8FA8" }}>{label}</div>
                <div className="text-2xl font-bold" style={{ color }}>{value}</div>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader><CardTitle className="text-sm font-semibold text-white">Strategiekapital</CardTitle></CardHeader>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div><div className="text-xs text-[#8B8FA8]">Startkapital</div><div className="text-xl text-white">{capitalData?.startingCapital != null ? fmtEur(capitalData.startingCapital) : "—"}</div></div>
              <div><div className="text-xs text-[#8B8FA8]">Kapital (Buchwert)</div><div className="text-xl text-white">{capitalData?.currentCapital != null ? fmtEur(capitalData.currentCapital) : "—"}</div></div>
              <div><div className="text-xs text-[#8B8FA8]">Davon verfügbar</div><div className="text-xl text-white">{capitalData?.availableCapital != null ? fmtEur(capitalData.availableCapital) : "—"}</div></div>
              <div><div className="text-xs text-[#8B8FA8]">Realisierte Rendite</div><div className="text-xl text-white">{capitalData?.returnPct != null ? formatPct(capitalData.returnPct) : "—"}</div></div>
            </div>
            <p className="mt-3 text-xs text-[#8B8FA8]">{capitalData?.asOf ? `Basis ab ${fmtDate(capitalData.asOf)}. ` : "Noch keine datierte Kapitalbasis. "}Bestätigte manuelle Ausführungen einschließlich Gebühren; offene Bestände zum Einstand. Historische Trades fließen nicht in diese Kapitalbasis ein.</p>
          </Card>
          {m && m.closedTrades > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm font-semibold text-white">Historische Trades</CardTitle></CardHeader>
              <p className="text-sm text-[#8B8FA8]">{m.closedTrades} geschlossen · {m.analyzedTrades} mit auswertbarer Rendite · {fmtDate(m.firstTradeDate)} – {fmtDate(m.lastTradeDate)}</p>
              <p className="mt-2 text-xs text-[#8B8FA8]">Realisierter G/V: {m.tradesWithEurData ? fmtEur(m.totalPnlEur) : "—"} aus {m.tradesWithEurData} Trades mit Kursen und Stückzahl, vor Gebühren. Einzelrenditen beschreiben das Zertifikat. Ohne historische Kapitalbasis und Zahlungsströme ist keine Depot- oder Jahresrendite ableitbar.</p>
              {m.invalidDateTrades > 0 && <p className="mt-2 text-xs text-[#F59E0B]">{m.invalidDateTrades} Trade(s) mit ungültiger Datumsfolge von Kennzahlen ausgeschlossen. Originaldaten bleiben in der Trade-Historie sichtbar.</p>}
              {m.missingReturnTrades > 0 && <p className="mt-2 text-xs text-[#F59E0B]">{m.missingReturnTrades} Trade(s) ohne berechenbare Rendite von Renditekennzahlen ausgeschlossen.</p>}
              {m.tradesWithEurData < m.closedTrades - m.invalidDateTrades && <p className="mt-2 text-xs text-[#F59E0B]">{m.closedTrades - m.invalidDateTrades - m.tradesWithEurData} Trade(s) ohne vollständige Euro-Daten.</p>}
            </Card>
          )}

          {/* Entry Level Analysis */}
          {data?.entryAnalysis && data.entryAnalysis.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-white">Einstiegslevel-Analyse</CardTitle>
              </CardHeader>
              <p className="text-xs mb-4" style={{ color: "#8B8FA8" }}>
                Durchschnittliche Rendite nach VIX-Einstiegslevel
              </p>
              <EntryBucketChart data={data.entryAnalysis} height={200} />
            </Card>
          )}

          {/* Backtesting + Position Sizing */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            {/* Backtesting */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-white">Historisches Spot-Modell (1 Jahr)</CardTitle>
              </CardHeader>
              <p className="mb-4 text-xs text-[#8B8FA8]">Vereinfachtes VIX-Spot-Modell mit konstantem Hebel: keine Signalstrategie, echten VX-Kontrakte, Zertifikate, Gebühren oder Intraday-Knock-outs.</p>
              <div className="space-y-3">
                {/* Direction Toggle */}
                <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: "#1E1E28" }}>
                  {(["short", "long"] as const).map((dir) => (
                    <button
                      key={dir}
                      onClick={() => {
                        setBtDirection(dir);
                        setBtThreshold(dir === "short" ? "25" : "15");
                      }}
                      className="flex-1 py-2 text-sm font-medium transition-colors"
                      style={{
                        background: btDirection === dir ? (dir === "short" ? "#FF4D4D22" : "#22C55E22") : "transparent",
                        color: btDirection === dir ? (dir === "short" ? "#FF4D4D" : "#22C55E") : "#8B8FA8",
                        borderRight: dir === "short" ? "1px solid #1E1E28" : undefined,
                      }}
                    >
                      {dir === "short" ? "↓ Short VIX" : "↑ Long VIX"}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label={btDirection === "short" ? "Einstiegsniveau (VIX ≥)" : "Einstiegsniveau (VIX ≤)"}
                    type="number"
                    step="0.5"
                    value={btThreshold}
                    onChange={(e) => setBtThreshold(e.target.value)}
                  />
                  <Input
                    label="Mindestrendite (%)"
                    type="number"
                    step="1"
                    value={btTargetReturn}
                    onChange={(e) => setBtTargetReturn(e.target.value)}
                  />
                  <Input
                    label="Trailing Stop Schritt (%)"
                    type="number"
                    step="1"
                    value={btStepPct}
                    onChange={(e) => setBtStepPct(e.target.value)}
                  />
                  <Input
                    label="Hebel"
                    type="number"
                    step="1"
                    value={btLeverage}
                    onChange={(e) => setBtLeverage(e.target.value)}
                  />
                  <Input
                    label="Max. Haltetage"
                    type="number"
                    value={btMaxHold}
                    onChange={(e) => setBtMaxHold(e.target.value)}
                  />
                  <Input
                    label="Stop-Loss (%, 0 = aus)"
                    type="number"
                    step="1"
                    value={btStopLoss}
                    onChange={(e) => setBtStopLoss(e.target.value)}
                  />
                  <Input
                    label={btDirection === "short" ? "KO-Barrier (% über Entry, 0 = aus)" : "KO-Barrier (% unter Entry, 0 = aus)"}
                    type="number"
                    step="1"
                    value={btKnockout}
                    onChange={(e) => setBtKnockout(e.target.value)}
                  />
                </div>
                <Button variant="primary" size="sm" onClick={runBt} loading={btRunning}>
                  Backtest starten
                </Button>

                {btError && <p className="text-xs text-[#F59E0B]">{btError}</p>}
                {btResult && (
                  <div className="rounded-xl p-4 space-y-3 mt-3" style={{ background: "#1A1A22", border: "1px solid #1E1E28" }}>
                    <div className="text-xs font-medium" style={{ color: "#B8E15A" }}>
                      {btResult.period}
                    </div>

                    {/* Trades count — prominent */}
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-white">{btResult.tradesSimulated}</span>
                      <span className="text-sm" style={{ color: "#8B8FA8" }}>Simulierte Trades</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span style={{ color: "#8B8FA8" }}>Win Rate: </span>
                        <span style={{ color: btResult.winRate >= 0.5 ? "#22C55E" : "#FF4D4D" }} className="font-medium">
                          {(btResult.winRate * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div>
                        <span style={{ color: "#8B8FA8" }}>Ø Rendite: </span>
                        <span style={{ color: btResult.avgReturn >= 0 ? "#22C55E" : "#FF4D4D" }} className="font-medium">
                          {btResult.avgReturn >= 0 ? "+" : ""}{btResult.avgReturn.toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <span style={{ color: "#8B8FA8" }}>Modellrendite (Vollanlage): </span>
                        <span style={{ color: btResult.totalReturn >= 0 ? "#22C55E" : "#FF4D4D" }} className="font-medium">
                          {btResult.totalReturn >= 0 ? "+" : ""}{btResult.totalReturn.toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <span style={{ color: "#8B8FA8" }}>Ø Haltetage: </span>
                        <span className="text-white font-medium">{btResult.avgHoldDays.toFixed(1)}d</span>
                      </div>
                      <div>
                        <span style={{ color: "#8B8FA8" }}>Max Drawdown: </span>
                        <span style={{ color: "#FF4D4D" }} className="font-medium">
                          -{btResult.maxDrawdown.toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <span style={{ color: "#8B8FA8" }}>Ø Einstieg VIX: </span>
                        <span className="text-white font-medium">{btResult.avgEntryVix.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Exit reason breakdown */}
                    <div className="pt-2" style={{ borderTop: "1px solid #1E1E28" }}>
                      <div className="text-xs mb-1.5" style={{ color: "#8B8FA8" }}>Ausstiegsgründe</div>
                      <div className="flex flex-wrap gap-3 text-sm">
                        <div className="flex items-center gap-1.5">
                          <div className="h-2 w-2 rounded-full" style={{ background: "#B8E15A" }} />
                          <span style={{ color: "#8B8FA8" }}>Trailing Stop: </span>
                          <span className="text-white font-medium">{btResult.trailingStopExits}</span>
                          {btResult.tradesSimulated > 0 && (
                            <span style={{ color: "#4A4A5A" }}>
                              ({((btResult.trailingStopExits / btResult.tradesSimulated) * 100).toFixed(0)}%)
                            </span>
                          )}
                        </div>
                        {btResult.stopLossExits > 0 && (
                          <div className="flex items-center gap-1.5">
                            <div className="h-2 w-2 rounded-full" style={{ background: "#EF4444" }} />
                            <span style={{ color: "#8B8FA8" }}>Stop-Loss: </span>
                            <span className="font-medium" style={{ color: "#EF4444" }}>{btResult.stopLossExits}</span>
                            <span style={{ color: "#4A4A5A" }}>
                              ({((btResult.stopLossExits / btResult.tradesSimulated) * 100).toFixed(0)}%)
                            </span>
                          </div>
                        )}
                        {btResult.knockoutExits > 0 && (
                          <div className="flex items-center gap-1.5">
                            <div className="h-2 w-2 rounded-full" style={{ background: "#FF6B00" }} />
                            <span style={{ color: "#8B8FA8" }}>Knockout: </span>
                            <span className="font-medium" style={{ color: "#FF6B00" }}>{btResult.knockoutExits}</span>
                            <span style={{ color: "#4A4A5A" }}>
                              ({((btResult.knockoutExits / btResult.tradesSimulated) * 100).toFixed(0)}%)
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <div className="h-2 w-2 rounded-full" style={{ background: "#8B8FA8" }} />
                          <span style={{ color: "#8B8FA8" }}>Max-Hold: </span>
                          <span className="text-white font-medium">{btResult.maxHoldExits}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Trade chart — shown below result when trades exist */}
                {btResult && btResult.trades.length > 0 && btHistory.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs mb-2" style={{ color: "#8B8FA8" }}>
                      Simulierte Trades — Einstieg &amp; Ausstieg
                    </p>
                    <BacktestTradeChart history={btHistory} trades={btResult.trades} />
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm font-semibold text-white">Bestätigte Kaufkaskade</CardTitle></CardHeader>
              <p className="text-xs text-[#8B8FA8]">Anteile inklusive Gebühren; weitere Käufe ergänzen die Differenz.</p>
              <div className="mt-4 space-y-2 text-white">{[30, 40, 50].map(pct => <div key={pct}>{pct} % kumuliert: {capitalData?.allocationCapital != null ? fmtEur(capitalData.allocationCapital * pct / 100) : "—"}</div>)}</div>
              <a href="/signals" className="inline-block mt-3 text-sm text-[#B8E15A]">Zu den Handelssignalen →</a>
            </Card>
          </div>

          {/* Behavioral Insights */}
          {m && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-white">Verhaltens-Analyse</CardTitle>
              </CardHeader>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl" style={{ background: "#1A1A22", border: "1px solid #1E1E28" }}>
                  <div className="text-xs mb-2" style={{ color: "#8B8FA8" }}>Alert-Nutzung</div>
                  <div className="text-xl font-bold" style={{ color: "#B8E15A" }}>
                    {m.analyzedTrades > 0
                      ? `${((m.alertTriggeredCount / m.analyzedTrades) * 100).toFixed(0)}%`
                      : "—"
                    }
                  </div>
                  <div className="text-xs mt-1" style={{ color: "#8B8FA8" }}>
                    der Trades durch Alert ausgelöst
                  </div>
                </div>
                <div className="p-4 rounded-xl" style={{ background: "#1A1A22", border: "1px solid #1E1E28" }}>
                  <div className="text-xs mb-2" style={{ color: "#8B8FA8" }}>Ø Gewinnauftrag</div>
                  <div className="text-xl font-bold" style={{ color: "#22C55E" }}>
                    {m.avgWin > 0 ? formatPct(m.avgWin) : "—"}
                  </div>
                  <div className="text-xs mt-1" style={{ color: "#8B8FA8" }}>
                    durchschnittlicher Gewinn
                  </div>
                </div>
                <div className="p-4 rounded-xl" style={{ background: "#1A1A22", border: "1px solid #1E1E28" }}>
                  <div className="text-xs mb-2" style={{ color: "#8B8FA8" }}>Risiko/Reward</div>
                  <div className="text-xl font-bold" style={{ color: "#F59E0B" }}>
                    {m.avgLoss < 0 && m.avgWin > 0
                      ? `1:${(m.avgWin / Math.abs(m.avgLoss)).toFixed(1)}`
                      : "—"
                    }
                  </div>
                  <div className="text-xs mt-1" style={{ color: "#8B8FA8" }}>
                    Win/Loss Verhältnis
                  </div>
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
