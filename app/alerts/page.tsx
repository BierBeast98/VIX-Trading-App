"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Bell, CheckCircle, Filter, Clock } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

interface AlertLog {
  id: string;
  alertType: string;
  message: string;
  vixLevel: number | null;
  sentAt: string;
  acknowledged: boolean;
}

type TypeFilter = "all" | "entry" | "stddev" | "event" | "spike" | "trailingStop";
type DaysFilter = "1" | "7" | "30" | "all";

const TYPE_LABELS: Record<string, string> = {
  all: "Alle",
  entry: "Entry",
  stddev: "Std-Dev",
  event: "Events",
  spike: "Spike",
  trailingStop: "Trailing Stop",
};

const TYPE_COLORS: Record<string, string> = {
  entry: "#B8E15A",
  stddev: "#F59E0B",
  event: "#8B5CF6",
  spike: "#FF4D4D",
  trailingStop: "#3B82F6",
};

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

export default function AlertsPage() {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [daysFilter, setDaysFilter] = useState<DaysFilter>("all");
  const { mutate: globalMutate } = useSWRConfig();

  // Build dynamic SWR key from filters
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

  const acknowledgeOne = async (id: string) => {
    await fetch("/api/alerts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    // Optimistic update
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

  const typeStats = alerts.reduce<Record<string, number>>((acc, a) => {
    acc[a.alertType] = (acc[a.alertType] || 0) + 1;
    return acc;
  }, {});
  const mostCommonType = Object.entries(typeStats).sort((a, b) => b[1] - a[1])[0];

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#B8E15A] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Alerts</h1>
          <p className="text-sm mt-0.5" style={{ color: "#8B8FA8" }}>
            Alert-Verlauf, Filterung und Bestätigung
          </p>
        </div>
        {unacknowledgedCount > 0 && (
          <Button variant="primary" size="sm" onClick={acknowledgeAll}>
            <CheckCircle size={14} />
            Alle bestätigen ({unacknowledgedCount})
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-xs">Unbestätigt</CardTitle>
          </CardHeader>
          <div className="text-2xl font-bold" style={{ color: unacknowledgedCount > 0 ? "#FF4D4D" : "#B8E15A" }}>
            {unacknowledgedCount}
          </div>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs">Gesamt (Filter)</CardTitle>
          </CardHeader>
          <div className="text-2xl font-bold text-white">{alerts.length}</div>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs">Häufigster Typ</CardTitle>
          </CardHeader>
          <div className="text-sm font-medium text-white">
            {mostCommonType ? (
              <span className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: TYPE_COLORS[mostCommonType[0]] ?? "#8B8FA8" }}
                />
                {TYPE_LABELS[mostCommonType[0]] ?? mostCommonType[0]} ({mostCommonType[1]})
              </span>
            ) : "—"}
          </div>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs">Letzter Alert</CardTitle>
          </CardHeader>
          <div className="text-sm text-white">
            {alerts[0] ? formatDateTime(alerts[0].sentAt) : "—"}
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} style={{ color: "#8B8FA8" }} />
          <span className="text-xs font-medium" style={{ color: "#8B8FA8" }}>Typ:</span>
          <div className="flex gap-1">
            {(Object.keys(TYPE_LABELS) as TypeFilter[]).map((t) => (
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
                {TYPE_LABELS[t]}
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
            {alerts.map((alert) => (
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
                  style={{ background: TYPE_COLORS[alert.alertType] ?? "#8B8FA8" }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      variant={URGENCY_VARIANTS.medium}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {TYPE_LABELS[alert.alertType] ?? alert.alertType}
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
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
