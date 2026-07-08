"use client";

import { useEffect, useState, type ReactNode } from "react";
import useSWR, { useSWRConfig } from "swr";
import {
  Bell,
  CheckCircle,
  Filter,
  Clock,
  Save,
  TrendingDown,
  Sigma,
  Zap,
  Target,
  TrendingUp,
  CalendarClock,
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { formatDateTime } from "@/lib/utils";
import { ALERT_TYPE_META, type AlertType } from "@/lib/alert-types";
import type { AlertConfig } from "@/lib/alert-config";

interface AlertLog {
  id: string;
  alertType: string;
  message: string;
  vixLevel: number | null;
  urgency: string;
  sentAt: string;
  acknowledged: boolean;
}

interface AlertSettings {
  alertEmail: string;
  vixLowThreshold: number;
  stdDevMultiplier: number;
  rollingWindowDays: number;
  targetReturnPct: number;
  spikeThresholdPct: number;
  trailingStopConfig: { enabled: boolean; stepPct: number };
  alertConfig: AlertConfig;
}

interface TypeSummary {
  lastAt: string | null;
  lastMessage: string | null;
  active: boolean;
}

type TypeFilter = "all" | AlertType;
type DaysFilter = "1" | "7" | "30" | "all";

const FILTER_TYPES: TypeFilter[] = ["all", "entry", "stddev", "spike", "vxSpike", "profitTarget", "trailingStop", "event"];

const URGENCY_VARIANTS: Record<string, "danger" | "warning" | "default"> = {
  high: "danger",
  medium: "warning",
  low: "default",
};

const DAYS_LABELS: Record<DaysFilter, string> = {
  "1": "Heute",
  "7": "7 Tage",
  "30": "30 Tage",
  all: "Alle",
};

// Prevent React "Received NaN for value" warning when user clears a numeric field
const n = (v: number | undefined | null): number | string =>
  v == null || (typeof v === "number" && isNaN(v)) ? "" : v;

function AlertConfigCard({
  icon,
  title,
  color,
  description,
  enabled,
  onToggle,
  summary,
  children,
}: {
  icon: ReactNode;
  title: string;
  color: string;
  description: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  summary?: TypeSummary;
  children?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 min-w-0">
          <span style={{ color }}>{icon}</span>
          <CardTitle className="text-sm font-semibold text-white truncate">{title}</CardTitle>
          {summary?.active && (
            <span
              className="h-2 w-2 rounded-full flex-shrink-0 animate-pulse"
              style={{ background: color }}
              title="Bedingung aktuell aktiv"
            />
          )}
        </div>
        <Toggle checked={enabled} onChange={onToggle} />
      </CardHeader>
      <p className="text-xs mb-3 -mt-2" style={{ color: "#8B8FA8" }}>{description}</p>
      {enabled && children && <div className="space-y-3">{children}</div>}
      <p className="text-[11px] mt-3 pt-3 border-t" style={{ color: "#4A4A5A", borderColor: "#1E1E28" }}>
        Zuletzt ausgelöst: {summary?.lastAt ? formatDateTime(summary.lastAt) : "—"}
      </p>
    </Card>
  );
}

export default function AlertsPage() {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [daysFilter, setDaysFilter] = useState<DaysFilter>("all");
  const { mutate: globalMutate } = useSWRConfig();

  // Konfiguration (gleiche Save-UX wie Settings-Seite: lokaler State, seeded aus SWR)
  const { data: serverSettings } = useSWR<AlertSettings>("/api/settings");
  const { data: summaryData } = useSWR<{ types: Record<string, TypeSummary> }>("/api/alerts/summary");
  const [settings, setSettings] = useState<AlertSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (serverSettings && settings === null) setSettings(serverSettings);
  }, [serverSettings, settings]);

  const update = (key: keyof AlertSettings, value: unknown) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
    setSaved(false);
  };

  const updateConfig = <T extends keyof AlertConfig>(type: T, patch: Partial<AlertConfig[T]>) => {
    if (!settings) return;
    setSettings({
      ...settings,
      alertConfig: {
        ...settings.alertConfig,
        [type]: { ...settings.alertConfig[type], ...patch },
      },
    });
    setSaved(false);
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setSaveError(null);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      const data = await res.json().catch(() => null);
      const fields = data?.issues ? Object.keys(data.issues).join(", ") : null;
      setSaveError(fields ? `Ungültige Werte: ${fields}` : "Speichern fehlgeschlagen");
    }
    setSaving(false);
  };

  // Verlauf
  const alertParams = new URLSearchParams();
  if (typeFilter !== "all") alertParams.set("type", typeFilter);
  if (daysFilter !== "all") alertParams.set("days", daysFilter);
  alertParams.set("limit", "200");

  const { data: alertsData, isLoading: loading, mutate: mutateAlerts } = useSWR<{
    alerts: AlertLog[];
    unacknowledgedCount: number;
  }>(`/api/alerts?${alertParams}`);

  const alerts = alertsData?.alerts ?? [];
  const unacknowledgedCount = alertsData?.unacknowledgedCount ?? 0;
  const summary = summaryData?.types ?? {};

  const acknowledgeOne = async (id: string) => {
    await fetch("/api/alerts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    mutateAlerts(
      (prev) => prev ? {
        ...prev,
        alerts: prev.alerts.map((a) => a.id === id ? { ...a, acknowledged: true } : a),
        unacknowledgedCount: Math.max(0, prev.unacknowledgedCount - 1),
      } : prev,
      { revalidate: false }
    );
    globalMutate("/api/alerts?limit=0"); // Update sidebar/tab-bar badge
  };

  const acknowledgeAll = async () => {
    await fetch("/api/alerts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    mutateAlerts(
      (prev) => prev ? {
        ...prev,
        alerts: prev.alerts.map((a) => ({ ...a, acknowledged: true })),
        unacknowledgedCount: 0,
      } : prev,
      { revalidate: false }
    );
    globalMutate("/api/alerts?limit=0"); // Update sidebar/tab-bar badge
  };

  if (loading && !settings) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#B8E15A] border-t-transparent" />
      </div>
    );
  }

  const cfg = settings?.alertConfig;

  // Spot- und Future-Spike teilen sich eine Karte → Summary zusammenführen
  const spikeSummary: TypeSummary = {
    lastAt:
      [summary.spike?.lastAt, summary.vxSpike?.lastAt]
        .filter((d): d is string => d != null)
        .sort()
        .pop() ?? null,
    lastMessage: null,
    active: Boolean(summary.spike?.active || summary.vxSpike?.active),
  };

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Alerts</h1>
          <p className="text-sm mt-0.5" style={{ color: "#8B8FA8" }}>
            Alert-Regeln konfigurieren und Verlauf prüfen
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {saveError && <Badge variant="danger">{saveError}</Badge>}
          {unacknowledgedCount > 0 && (
            <Button variant="secondary" size="sm" onClick={acknowledgeAll}>
              <CheckCircle size={14} />
              Alle bestätigen ({unacknowledgedCount})
            </Button>
          )}
          {settings && (
            <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>
              <Save size={14} />
              {saved ? "Gespeichert ✓" : "Speichern"}
            </Button>
          )}
        </div>
      </div>

      {/* Config Cards */}
      {settings && cfg && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          <AlertConfigCard
            icon={<TrendingDown size={16} />}
            title="Einstiegs-Alert"
            color={ALERT_TYPE_META.entry.color}
            description="Feuert, wenn der VIX unter die Schwelle fällt (Low-Fear-Einstiegszone)."
            enabled={cfg.entry.enabled}
            onToggle={(v) => updateConfig("entry", { enabled: v })}
            summary={summary.entry}
          >
            <Input
              label="VIX-Schwelle (≤)"
              type="number"
              step="0.5"
              value={n(settings.vixLowThreshold)}
              onChange={(e) => update("vixLowThreshold", parseFloat(e.target.value))}
            />
          </AlertConfigCard>

          <AlertConfigCard
            icon={<Target size={16} />}
            title="Gewinnziel"
            color={ALERT_TYPE_META.profitTarget.color}
            description="Feuert, wenn eine offene Position das Gewinnziel erreicht — pro Position."
            enabled={cfg.profitTarget.enabled}
            onToggle={(v) => updateConfig("profitTarget", { enabled: v })}
            summary={summary.profitTarget}
          >
            <Input
              label="Gewinnziel (%)"
              type="number"
              step="1"
              value={n(cfg.profitTarget.thresholdPct)}
              onChange={(e) => updateConfig("profitTarget", { thresholdPct: parseFloat(e.target.value) })}
              hint="Unabhängig vom Trailing Stop"
            />
          </AlertConfigCard>

          <AlertConfigCard
            icon={<TrendingUp size={16} />}
            title="Trailing Stop"
            color={ALERT_TYPE_META.trailingStop.color}
            description="Aktiviert ab Zielrendite einen mitlaufenden Stop-Loss-Floor; warnt beim Unterschreiten."
            enabled={settings.trailingStopConfig.enabled}
            onToggle={(v) => update("trailingStopConfig", { ...settings.trailingStopConfig, enabled: v })}
            summary={summary.trailingStop}
          >
            <Input
              label="Zielrendite (%)"
              type="number"
              step="1"
              value={n(settings.targetReturnPct)}
              onChange={(e) => update("targetReturnPct", parseFloat(e.target.value))}
              hint="Ab hier wird der Floor aktiviert"
            />
            <Input
              label="Zusatzrendite / Stufe (%)"
              type="number"
              step="1"
              value={n(settings.trailingStopConfig.stepPct)}
              onChange={(e) => update("trailingStopConfig", { ...settings.trailingStopConfig, stepPct: parseFloat(e.target.value) })}
              hint="Floor steigt in diesen Schritten mit"
            />
            {settings.trailingStopConfig.stepPct > 0 && (() => {
              const target = settings.targetReturnPct;
              const step = settings.trailingStopConfig.stepPct;
              const rows = Array.from({ length: 4 }, (_, i) => target + step * i);
              return (
                <div className="p-3 rounded-xl text-xs" style={{ background: "#1A1A22", border: "1px solid #1E1E28" }}>
                  <div className="font-medium text-white mb-2">Floor-Stufen:</div>
                  {rows.map((pnl) => {
                    const floor = target + Math.floor((pnl - target) / step) * step;
                    return (
                      <div key={pnl} className="flex justify-between py-0.5">
                        <span style={{ color: "#8B8FA8" }}>Bei +{pnl}% Rendite:</span>
                        <span style={{ color: "#B8E15A" }}>Floor {floor.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </AlertConfigCard>

          <AlertConfigCard
            icon={<Zap size={16} />}
            title="VIX-Spike"
            color={ALERT_TYPE_META.spike.color}
            description="Feuert bei starker Tagesbewegung — Spot (Yahoo) und Future (Vontobel) getrennt schaltbar."
            enabled={cfg.spike.enabled || cfg.vxSpike.enabled}
            onToggle={(v) => {
              // beide Quellen gemeinsam schalten, Feinsteuerung über die Einzel-Toggles darunter
              setSettings((prev) => prev ? {
                ...prev,
                alertConfig: {
                  ...prev.alertConfig,
                  spike: { enabled: v },
                  vxSpike: { enabled: v },
                },
              } : prev);
              setSaved(false);
            }}
            summary={spikeSummary}
          >
            <Input
              label="Schwelle Tagesänderung (%)"
              type="number"
              step="0.5"
              value={n(settings.spikeThresholdPct)}
              onChange={(e) => update("spikeThresholdPct", parseFloat(e.target.value))}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "#8B8FA8" }}>VIX Spot</span>
              <Toggle checked={cfg.spike.enabled} onChange={(v) => updateConfig("spike", { enabled: v })} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "#8B8FA8" }}>VIX Future (Vontobel)</span>
              <Toggle checked={cfg.vxSpike.enabled} onChange={(v) => updateConfig("vxSpike", { enabled: v })} />
            </div>
          </AlertConfigCard>

          <AlertConfigCard
            icon={<Sigma size={16} />}
            title="Statistischer Ausreißer"
            color={ALERT_TYPE_META.stddev.color}
            description="Feuert, wenn der VIX signifikant vom rollierenden Mittelwert abweicht (Z-Score)."
            enabled={cfg.stddev.enabled}
            onToggle={(v) => updateConfig("stddev", { enabled: v })}
            summary={summary.stddev}
          >
            <Input
              label="Std-Dev Multiplikator"
              type="number"
              step="0.1"
              value={n(settings.stdDevMultiplier)}
              onChange={(e) => update("stdDevMultiplier", parseFloat(e.target.value))}
            />
            <Input
              label="Rolling Window (Tage)"
              type="number"
              value={n(settings.rollingWindowDays)}
              onChange={(e) => update("rollingWindowDays", parseInt(e.target.value, 10))}
            />
          </AlertConfigCard>

          <AlertConfigCard
            icon={<CalendarClock size={16} />}
            title="Wirtschaftsevents"
            color={ALERT_TYPE_META.event.color}
            description="2-Stunden-Vorwarnung vor marktrelevanten Terminen (FOMC, CPI, NFP, …)."
            enabled={cfg.event.enabled}
            onToggle={(v) => updateConfig("event", { enabled: v })}
            summary={summary.event}
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} style={{ color: "#8B8FA8" }} />
          <span className="text-xs font-medium" style={{ color: "#8B8FA8" }}>Typ:</span>
          <div className="flex gap-1 flex-wrap">
            {FILTER_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
                style={
                  typeFilter === t
                    ? { background: "#B8E15A", color: "#000" }
                    : { background: "#1E1E28", color: "#8B8FA8" }
                }
              >
                {t === "all" ? "Alle" : ALERT_TYPE_META[t].label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Clock size={14} style={{ color: "#8B8FA8" }} />
          <span className="text-xs font-medium" style={{ color: "#8B8FA8" }}>Zeitraum:</span>
          <div className="flex gap-1">
            {(Object.keys(DAYS_LABELS) as DaysFilter[]).map((d) => (
              <button
                key={d}
                onClick={() => setDaysFilter(d)}
                className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
                style={
                  daysFilter === d
                    ? { background: "#B8E15A", color: "#000" }
                    : { background: "#1E1E28", color: "#8B8FA8" }
                }
              >
                {DAYS_LABELS[d]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Alert List */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell size={16} style={{ color: "#B8E15A" }} />
            <CardTitle className="text-sm font-semibold text-white">Alert-Verlauf</CardTitle>
          </div>
        </CardHeader>
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Bell size={32} style={{ color: "#2E2E3A" }} />
            <p className="text-sm" style={{ color: "#8B8FA8" }}>
              Keine Alerts für diesen Filter
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert) => {
              const meta = ALERT_TYPE_META[alert.alertType as AlertType];
              return (
                <div
                  key={alert.id}
                  className="flex items-start gap-3 p-3 rounded-xl transition-colors"
                  style={{
                    background: alert.acknowledged ? "#0C0C0F" : "#1A1A22",
                    border: `1px solid ${alert.acknowledged ? "#1E1E28" : "#2E2E3A"}`,
                    opacity: alert.acknowledged ? 0.7 : 1,
                  }}
                >
                  <div
                    className="mt-1.5 h-2.5 w-2.5 rounded-full flex-shrink-0"
                    style={{ background: meta?.color ?? "#8B8FA8" }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant={URGENCY_VARIANTS[alert.urgency] ?? "default"}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {meta?.label ?? alert.alertType}
                      </Badge>
                      {alert.vixLevel != null && (
                        <span className="text-xs" style={{ color: "#4A4A5A" }}>
                          VIX: {alert.vixLevel.toFixed(2)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-white leading-snug">{alert.message}</p>
                    <p className="text-xs mt-1" style={{ color: "#4A4A5A" }}>
                      {formatDateTime(alert.sentAt)}
                    </p>
                  </div>
                  {!alert.acknowledged && (
                    <button
                      onClick={() => acknowledgeOne(alert.id)}
                      className="flex-shrink-0 px-2 py-1 rounded-lg text-xs font-medium transition-colors"
                      style={{ background: "#1E1E28", color: "#B8E15A" }}
                    >
                      <CheckCircle size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
