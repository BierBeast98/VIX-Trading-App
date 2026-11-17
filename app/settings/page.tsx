"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Save, Mail, Bell, TestTube, Database, ExternalLink, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Settings {
  id: number;
  alertEmail: string;
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
    if (serverSettings && settings === null) {
      setSettings({
        id: serverSettings.id,
        alertEmail: serverSettings.alertEmail,
        vontobelIsin: serverSettings.vontobelIsin,
      });
    }
  }, [serverSettings, settings]);

  const update = (key: string, value: unknown) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        alertEmail: settings.alertEmail,
        vontobelIsin: settings.vontobelIsin,
      }),
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

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Einstellungen</h1>
          <p className="text-sm mt-0.5" style={{ color: "#8B8FA8" }}>
            E-Mail-Konfiguration und Datenquellen
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
              label="E-Mail-Adresse für Benachrichtigungen"
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

        {/* Handelssignale */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell size={16} style={{ color: "#B8E15A" }} />
              <CardTitle className="text-sm font-semibold text-white">Handelssignale</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-3">
            <p className="text-sm" style={{ color: "#8B8FA8" }}>
              Konfiguration und Verlauf der manuellen Handelssignale findest du im Signalbereich.
            </p>
            <Link
              href="/signals"
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              style={{ background: "#1E1E28", color: "#B8E15A" }}
            >
              Zu den Handelssignalen
              <ArrowRight size={12} />
            </Link>
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
    </div>
  );
}
