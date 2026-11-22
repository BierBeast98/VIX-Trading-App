"use client";

import dynamic from "next/dynamic";
import { StrategyCapital } from "@/components/dashboard/strategy-capital";
import { Card } from "@/components/ui/card";
import type { analyzeEntryLevels, PerformanceMetrics } from "@/lib/analytics";
import { formatNumber, formatPct } from "@/lib/utils";

const EntryBucketChart = dynamic(
  () => import("@/components/charts/EntryBucketChart").then((module) => module.EntryBucketChart),
  { ssr: false, loading: () => <div className="h-[200px]" /> },
);
const euros = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
export const formatEuros = (amount: number | null | undefined) => amount == null ? "—" : euros.format(amount);

export function TradePerformance({ metrics, entryAnalysis }: {
  metrics: PerformanceMetrics;
  entryAnalysis: ReturnType<typeof analyzeEntryLevels>;
}) {
  const { closedTrades, tradesWithEurData, tradesWithFees, tradesWithTax } = metrics;
  const totals = [
    { label: "Vor Gebühren", value: metrics.totalPnlEur, count: tradesWithEurData },
    { label: "Nach Gebühren", value: metrics.pnlBeforeTax, count: tradesWithFees },
    { label: "Nach Gebühren und Steuern", value: metrics.pnlAfterTax, count: tradesWithTax },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 id="auswertung-heading" className="text-xl font-semibold text-white">Auswertung</h2>
        <p className="mt-1 text-sm text-muted">Realisierter Gewinn und Verlust aus {closedTrades} abgeschlossenen Trades</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {totals.map(({ label, value, count }) => (
          <Card key={label}>
            <p className="text-xs text-muted">{label}</p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${count ? value < 0 ? "text-danger" : "text-success" : "text-white"}`}>
              {formatEuros(count ? value : null)}
            </p>
            <p className="mt-2 text-xs text-muted">{count} von {closedTrades} Trades</p>
          </Card>
        ))}
      </div>
      {closedTrades > tradesWithTax && <p className="text-sm text-muted">Die Summen enthalten jeweils die Trades mit vollständigen Angaben. Fehlende Gebühren oder Steuern lassen sich bei manuell erfassten Trades anhand der Brokerabrechnung ergänzen.</p>}
      {metrics.invalidDateTrades > 0 && <p className="text-sm text-warning">{metrics.invalidDateTrades} Trade(s) mit ungültiger Datumsfolge fehlen in der Auswertung.</p>}
      <StrategyCapital showReturn />

      {closedTrades > 0 && (
        <Card>
          <details>
            <summary className="cursor-pointer text-sm font-medium text-white">Weitere Kennzahlen</summary>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {[
                { label: "Gewinnquote", value: metrics.analyzedTrades ? formatPct(metrics.winRate * 100, 0) : "—" },
                { label: "Ø Kursrendite pro Trade", value: metrics.analyzedTrades ? formatPct(metrics.avgReturn) : "—" },
                { label: "Ø Haltetage", value: closedTrades > metrics.invalidDateTrades ? formatNumber(metrics.avgHoldDays, 1) : "—" },
                { label: "Rendite / Streuung", value: metrics.analyzedTrades >= 2 ? formatNumber(metrics.sharpeRatio, 2) : "—" },
                { label: "Beste Kursrendite", value: metrics.analyzedTrades ? formatPct(metrics.bestTrade) : "—" },
                { label: "Schlechteste Kursrendite", value: metrics.analyzedTrades ? formatPct(metrics.worstTrade) : "—" },
                { label: "Durch Signal ausgelöst", value: `${metrics.alertTriggeredCount} / ${metrics.analyzedTrades}` },
                { label: "Rendite auswertbar", value: `${metrics.analyzedTrades} / ${closedTrades}` },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-muted">{label}</p>
                  <p className="mt-1 text-lg font-medium tabular-nums text-white">{value}</p>
                </div>
              ))}
            </div>
            {entryAnalysis.length > 0 && (
              <div className="mt-6">
                <h3 className="mb-4 text-sm text-muted">Ø Kursrendite nach erfasstem Einstiegslevel</h3>
                <EntryBucketChart data={entryAnalysis} />
              </div>
            )}
          </details>
        </Card>
      )}
    </div>
  );
}
