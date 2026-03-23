"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { Save, Mail, Bell, TrendingUp, TestTube, Database, ExternalLink } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Settings {
  id: number;
  alertEmail: string;
  vixLowThreshold: number;
  stdDevMultiplier: number;
  rollingWindowDays: number;
  targetReturnPct: number;
  trailingStopConfig: {
    enabled: boolean;
    stepPct: number;
  };
  riskBudget: number;
  spikeThresholdPct: number;
  vontobelIsin: string;
}

export default function SettingsPage() {
  const { data: serverSettings, isLoading: swrLoading } = useSWR<Settings>("/api/settings");
  const [settings, setSettings] = useState<Settings | null>(null);
  const loading = swrLoading && settings === null;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState<"success" | "error" | null>(null);

  // Seed form state from SWR on first load
  useEffect(() => {
    if (serverSettings && settings === null) setSettings(serverSettings);
  }, [serverSettings, settings]);

  const update = (key: string, value: unknown) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  const updateTrailingStop = (key: string, value: unknown) => {
    if (!settings) return;
    setSettings({
      ...settings,
      trailingStopConfig: { ...settings.trailingStopConfig, [key]: value },
    });
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  };

  const testEmail = async () => {
    setTestingEmail(true);
    setEmailTestResult(null);
    const res = await fetch("/api/alerts/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: settings?.alertEmail }),
    });
    const data = await res.json();
    setEmailTestResult(data.success ? "success" : "error");
    setTestingEmail(false);
  };

  if (loading || !settings) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#B8E15A] border-t-transparent" />
      </div>
    );
  }

  // Prevent React "Received NaN for value" warning when user clears a numeric field
  const n = (v: number | undefined | null): number | string =>
    v == null || (typeof v === "number" && isNaN(v)) ? "" : v;

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Einstellungen</h1>
          <p className="text-sm mt-0.5" style={{ color: "#8B8FA8" }}>
            Alert-Schwellen, Risikoparameter und E-Mail-Konfiguration
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>
          <Save size={14} />
          {saved ? "Gespeichert ✓" : "Speichern"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Email Config */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail size={16} style={{ color: "#B8E15A" }} />
              <CardTitle className="text-sm font-semibold text-white">E-Mail Konfiguration</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-4">
            <Input
              label="Alert E-Mail Adresse"
              type="email"
              value={settings.alertEmail}
              onChange={(e) => update("alertEmail", e.target.value)}
              placeholder="deine@email.de"
            />
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={testEmail}
                loading={testingEmail}
              >
                <TestTube size={14} />
                Test-E-Mail senden
              </Button>
              {emailTestResult === "success" && (
                <Badge variant="success">E-Mail gesendet ✓</Badge>
              )}
              {emailTestResult === "error" && (
                <Badge variant="danger">Fehler beim Senden</Badge>
              )}
            </div>
            <div className="rounded-xl p-3 text-xs space-y-1" style={{ background: "#1A1A22", border: "1px solid #1E1E28" }}>
              <p style={{ color: "#8B8FA8" }}>
                <strong className="text-white">Resend API Key</strong> muss in der Umgebungsvariable
                <code className="mx-1 px-1 rounded" style={{ background: "#0C0C0F" }}>RESEND_API_KEY</code>
                gesetzt sein.
              </p>
              <p style={{ color: "#8B8FA8" }}>
                Absender-Domain muss in Resend verifiziert sein.
              </p>
            </div>
          </div>
        </Card>

        {/* VIX Alert Thresholds */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell size={16} style={{ color: "#B8E15A" }} />
              <CardTitle className="text-sm font-semibold text-white">VIX Alert-Schwellen</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-4">
            <Input
              label="Einstiegs-Alert (VIX ≤)"
              type="number"
              step="0.5"
              value={n(settings.vixLowThreshold)}
              onChange={(e) => update("vixLowThreshold", parseFloat(e.target.value))}
              hint="Alert wenn VIX in Low-Fear-Einstiegszone fällt"
            />
            <Input
              label="Std-Dev Multiplikator"
              type="number"
              step="0.1"
              value={n(settings.stdDevMultiplier)}
              onChange={(e) => update("stdDevMultiplier", parseFloat(e.target.value))}
              hint="Alert wenn VIX X Std-Abweichungen vom Mittelwert abweicht"
            />
            <Input
              label="Rolling Window (Tage)"
              type="number"
              value={n(settings.rollingWindowDays)}
              onChange={(e) => update("rollingWindowDays", parseInt(e.target.value))}
              hint="Zeitraum für Mittelwert/Std-Dev Berechnung"
            />
            <Input
              label="VIX-Spike Schwelle (%)"
              type="number"
              step="1"
              value={n(settings.spikeThresholdPct)}
              onChange={(e) => update("spikeThresholdPct", parseFloat(e.target.value))}
              hint="Alert bei Tagesänderung ≥ X% wenn offene Positionen bestehen"
            />
          </div>
        </Card>

        {/* Trade Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp size={16} style={{ color: "#B8E15A" }} />
              <CardTitle className="text-sm font-semibold text-white">Trade Management</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-4">
            <Input
              label="Zielrendite (%)"
              type="number"
              step="1"
              value={n(settings.targetReturnPct)}
              onChange={(e) => update("targetReturnPct", parseFloat(e.target.value))}
              hint="Mindestrendite für Trailing Stop Aktivierung"
            />

            <div className="pt-2 border-t" style={{ borderColor: "#1E1E28" }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium" style={{ color: "#8B8FA8" }}>Trailing Stop</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    className="relative w-10 h-5 rounded-full transition-colors cursor-pointer"
                    style={{ background: settings.trailingStopConfig.enabled ? "#B8E15A" : "#1E1E28" }}
                    onClick={() => updateTrailingStop("enabled", !settings.trailingStopConfig.enabled)}
                  >
                    <div
                      className="absolute top-0.5 h-4 w-4 rounded-full transition-transform"
                      style={{
                        background: "#FFFFFF",
                        transform: settings.trailingStopConfig.enabled ? "translateX(22px)" : "translateX(2px)",
                      }}
                    />
                  </div>
                  <span className="text-sm" style={{ color: "#8B8FA8" }}>
                    {settings.trailingStopConfig.enabled ? "Aktiv" : "Inaktiv"}
                  </span>
                </label>
              </div>

              <Input
                label="Zusatzrendite / Stufe (%)"
                type="number"
                step="1"
                value={n(settings.trailingStopConfig.stepPct)}
                onChange={(e) => updateTrailingStop("stepPct", parseFloat(e.target.value))}
                hint="Floor steigt in diesen Schritten mit der Rendite mit"
              />

              {/* Preview */}
              {settings.trailingStopConfig.enabled && (() => {
                const target = settings.targetReturnPct;
                const step = settings.trailingStopConfig.stepPct;
                const steps = step > 0
                  ? Array.from({ length: 5 }, (_, i) => target + step * (i + 1))
                  : [];
                return (
                  <div className="mt-3 p-3 rounded-xl text-xs" style={{ background: "#1A1A22", border: "1px solid #1E1E28" }}>
                    <div className="font-medium text-white mb-2">Floor-Stufen:</div>
                    {steps.map((pnl) => {
                      const floor = target + (Math.floor((pnl - target) / step) - 1) * step;
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
            </div>
          </div>
        </Card>

        {/* Datenquellen */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database size={16} style={{ color: "#B8E15A" }} />
              <CardTitle className="text-sm font-semibold text-white">Datenquellen</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-4">
            <Input
              label="Vontobel Zertifikat ISIN"
              type="text"
              value={settings.vontobelIsin}
              onChange={(e) => update("vontobelIsin", e.target.value.toUpperCase())}
              placeholder="DE000VJ4MNF2"
              hint="ISIN eines VIX Mini Future von Vontobel — liefert echte VIX Future Intraday-Daten"
            />
            {settings.vontobelIsin && (
              <div className="flex items-center gap-3">
                <a
                  href={`https://markets.vontobel.com/de-de/produkte/hebel/mini-futures/${settings.vontobelIsin}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                  style={{ background: "#1E1E28", color: "#B8E15A" }}
                >
                  <ExternalLink size={12} />
                  Auf Vontobel öffnen
                </a>
              </div>
            )}
            <div className="rounded-xl p-3 text-xs space-y-1" style={{ background: "#1A1A22", border: "1px solid #1E1E28" }}>
              <p style={{ color: "#8B8FA8" }}>
                Die VIX Future Intraday-Daten (08:00–22:00 CET) werden über die
                Chart-API dieses Zertifikats geladen. Falls das Zertifikat ausläuft
                oder ausgeknockt wird, hier eine neue ISIN eines
                aktiven VIX Mini Future eintragen.
              </p>
              <p className="pt-1" style={{ color: "#8B8FA8" }}>
                Suche auf{" "}
                <a
                  href="https://markets.vontobel.com/de-de/produkte/hebel/mini-futures?underlyingGroup=52"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#B8E15A" }}
                >
                  Vontobel VIX Mini Futures
                </a>
                {" "}nach einem passenden Ersatz.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Save Button (bottom) */}
      <div className="flex justify-end">
        <Button variant="primary" size="lg" onClick={handleSave} loading={saving}>
          <Save size={16} />
          {saved ? "Gespeichert ✓" : "Alle Einstellungen speichern"}
        </Button>
      </div>
    </div>
  );
}
