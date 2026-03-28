"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPct, formatNumber } from "@/lib/utils";
import { runBacktest, suggestPositionSize } from "@/lib/analytics";
import { BacktestTradeChart } from "@/components/charts/BacktestTradeChart";

interface Metrics {
  totalTrades: number;
  closedTrades: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  avgReturn: number;
  avgWin: number;
  avgLoss: number;
  avgHoldDays: number;
  sharpeRatio: number;
  bestTrade: number;
  worstTrade: number;
  totalReturn: number;
  alertTriggeredCount: number;
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
  riskBudget: number;
}

interface Settings {
  vixLowThreshold: number;
  targetReturnPct: number;
  trailingStopConfig?: { stepPct?: number };
}

export default function AnalyticsPage() {
  const { data, isLoading: loading } = useSWR<AnalyticsData>("/api/analytics");
  const { data: settings } = useSWR<Settings>("/api/settings");

  // Backtesting state
  const [btDirection, setBtDirection] = useState<"long" | "short">("short");
  const [btThreshold, setBtThreshold] = useState("25");
  const [btTargetReturn, setBtTargetReturn] = useState("18");
  const [btStepPct, setBtStepPct] = useState("5");
  const [btLeverage, setBtLeverage] = useState("10");
  const [btMaxHold, setBtMaxHold] = useState("60");
  const [btStopLoss, setBtStopLoss] = useState("0");
  const [btKnockout, setBtKnockout] = useState("0");
  const [btResult, setBtResult] = useState<ReturnType<typeof runBacktest> | null>(null);
  const [btRunning, setBtRunning] = useState(false);
  const [btHistory, setBtHistory] = useState<{ date: string; close: number }[]>([]);

  // Position sizing state
  const [psVix, setPsVix] = useState("15");
  const [psBudget, setPsBudget] = useState("");
  const [psResult, setPsResult] = useState<ReturnType<typeof suggestPositionSize> | null>(null);

  // Pre-fill backtest params from saved settings
  useEffect(() => {
    if (settings) {
      setBtTargetReturn(String(settings.targetReturnPct ?? 18));
      setBtStepPct(String(settings.trailingStopConfig?.stepPct ?? 5));
    }
  }, [settings]);

  const runBt = async () => {
    setBtRunning(true);
    const res = await fetch(`/api/vix/historical?period=1y`);
    if (res.ok) {
      const histData = await res.json();
      const spotHistory = histData.vix ?? [];
      const futuresHistory = histData.vix3m ?? [];
      setBtHistory(spotHistory);
      const result = runBacktest(spotHistory, {
        direction: btDirection,
        entryThreshold: parseFloat(btThreshold),
        targetReturnPct: parseFloat(btTargetReturn),
        stepPct: parseFloat(btStepPct),
        leverageRatio: parseFloat(btLeverage),
        maxHoldDays: parseInt(btMaxHold),
        stopLossPct: parseFloat(btStopLoss) || 0,
        knockoutBarrierPct: parseFloat(btKnockout) || 0,
      }, futuresHistory.length > 0 ? futuresHistory : undefined);
      setBtResult(result);
    }
    setBtRunning(false);
  };

  const calcPositionSize = () => {
    const budget = parseFloat(psBudget) || data?.riskBudget || 10000;
    const result = suggestPositionSize(budget, parseFloat(psVix), 18);
    setPsResult(result);
  };

  useEffect(() => {
    if (data) setPsBudget(String(data.riskBudget));
  }, [data]);

  const m = data?.metrics;

  const kpis = m ? [
    { label: "Win Rate", value: formatPct(m.winRate * 100, 0), color: m.winRate >= 0.5 ? "#22C55E" : "#FF4D4D" },
    { label: "Ø Rendite", value: formatPct(m.avgReturn), color: m.avgReturn >= 0 ? "#22C55E" : "#FF4D4D" },
    { label: "Ø Haltetage", value: `${m.avgHoldDays.toFixed(1)}d`, color: "#8B8FA8" },
    { label: "Sharpe Ratio", value: formatNumber(m.sharpeRatio, 2), color: m.sharpeRatio >= 1 ? "#22C55E" : "#F59E0B" },
    { label: "Bester Trade", value: formatPct(m.bestTrade), color: "#22C55E" },
    { label: "Schlechtester Trade", value: formatPct(m.worstTrade), color: "#FF4D4D" },
    { label: "Gesamtrendite", value: formatPct(m.totalReturn), color: m.totalReturn >= 0 ? "#22C55E" : "#FF4D4D" },
    { label: "Alert-getriggert", value: `${m.alertTriggeredCount}/${m.closedTrades}`, color: "#B8E15A" },
  ] : [];

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
      <h1 className="text-2xl font-bold text-white">Analytics</h1>

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

          {/* Entry Level Analysis */}
          {data?.entryAnalysis && data.entryAnalysis.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-white">Einstiegslevel-Analyse</CardTitle>
              </CardHeader>
              <p className="text-xs mb-4" style={{ color: "#8B8FA8" }}>
                Durchschnittliche Rendite nach VIX-Einstiegslevel
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.entryAnalysis} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E1E28" vertical={false} />
                  <XAxis dataKey="range" tick={{ fill: "#8B8FA8", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#8B8FA8", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
                  <Tooltip
                    contentStyle={{ background: "#1A1A22", border: "1px solid #2E2E3A", borderRadius: "12px" }}
                    labelStyle={{ color: "#8B8FA8" }}
                    formatter={(value: any) => [`${Number(value).toFixed(1)}%`, "Ø Rendite"]}
                  />
                  <Bar dataKey="avgReturn" radius={[4, 4, 0, 0]}>
                    {data.entryAnalysis.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.avgReturn >= 0 ? "#B8E15A" : "#FF4D4D"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Backtesting + Position Sizing */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            {/* Backtesting */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-white">Backtesting (1 Jahr)</CardTitle>
              </CardHeader>
              <p className="text-xs mb-4" style={{ color: "#8B8FA8" }}>
                {btDirection === "short"
                  ? `Einstieg wenn VIX ≥ Einstiegsniveau (Short). Ausstieg per Trailing Stop (ab Mindestrendite, Schritt = ${btStepPct}%) oder nach max. Haltetagen. Renditen hebeladjustiert.`
                  : `Einstieg wenn VIX ≤ Einstiegsniveau (Long). Ausstieg per Trailing Stop (ab Mindestrendite, Schritt = ${btStepPct}%) oder nach max. Haltetagen. Renditen hebeladjustiert.`}
              </p>
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
                        <span style={{ color: "#8B8FA8" }}>Gesamtrendite: </span>
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

            {/* Position Sizing */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-white">Positionsgrößen-Rechner</CardTitle>
              </CardHeader>
              <p className="text-xs mb-4" style={{ color: "#8B8FA8" }}>
                Empfohlene Positionsgröße basierend auf VIX-Level und Risikobudget
              </p>
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    label="Aktueller VIX"
                    type="number"
                    step="0.5"
                    value={psVix}
                    onChange={(e) => setPsVix(e.target.value)}
                  />
                  <Input
                    label="Risikobudget (€)"
                    type="number"
                    value={psBudget}
                    onChange={(e) => setPsBudget(e.target.value)}
                  />
                </div>
                <Button variant="primary" size="sm" onClick={calcPositionSize}>
                  Berechnen
                </Button>

                {psResult && (
                  <div className="rounded-xl p-4 mt-3" style={{ background: "#1A1A22", border: "1px solid #1E1E28" }}>
                    <div className="text-3xl font-bold mb-2" style={{ color: "#B8E15A" }}>
                      €{psResult.allocation.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                    <p className="text-sm" style={{ color: "#8B8FA8" }}>{psResult.reason}</p>
                  </div>
                )}

                {/* VIX allocation guide — Long-Spike-Strategie: mehr Budget bei niedrigem VIX */}
                <div className="mt-4 space-y-1.5">
                  {[
                    { range: "≤ 14", pct: "70%", color: "#22C55E" },
                    { range: "14–16", pct: "60%", color: "#B8E15A" },
                    { range: "16–20", pct: "40%", color: "#F59E0B" },
                    { range: "20–25", pct: "25%", color: "#F97316" },
                    { range: "25–30", pct: "15%", color: "#EF4444" },
                    { range: "> 30", pct: "5%", color: "#DC2626" },
                  ].map((row) => (
                    <div key={row.range} className="flex justify-between text-xs">
                      <span style={{ color: "#8B8FA8" }}>VIX {row.range}</span>
                      <span style={{ color: row.color }} className="font-medium">{row.pct}</span>
                    </div>
                  ))}
                </div>
              </div>
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
                    {m.closedTrades > 0
                      ? `${((m.alertTriggeredCount / m.closedTrades) * 100).toFixed(0)}%`
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
