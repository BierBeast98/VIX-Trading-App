import { z } from "zod";

// Per-Typ-Konfiguration der Alerts, gespeichert als Json-Spalte Settings.alertConfig.
// Bestehende Schwellen (vixLowThreshold, spikeThresholdPct, ...) bleiben eigene Spalten;
// hier liegen nur die Ein/Aus-Flags + Werte, für die es keine Spalte gibt.
// Ein leeres {} bedeutet: alles aktiviert, profitTargetPct 15 (Defaults greifen).

// type statt interface: implizite Index-Signatur → direkt als Prisma-Json speicherbar
export type AlertConfig = {
  entry: { enabled: boolean };
  stddev: { enabled: boolean };
  spike: { enabled: boolean }; // VIX Spot
  vxSpike: { enabled: boolean }; // VIX Future
  profitTarget: { enabled: boolean; thresholdPct: number };
  event: { enabled: boolean };
  // trailingStop wird weiterhin über Settings.trailingStopConfig gesteuert (keine Duplizierung)
};

export const DEFAULT_ALERT_CONFIG: AlertConfig = {
  entry: { enabled: true },
  stddev: { enabled: true },
  spike: { enabled: true },
  vxSpike: { enabled: true },
  profitTarget: { enabled: true, thresholdPct: 15 },
  event: { enabled: true },
};

export const alertConfigSchema = z.object({
  entry: z.object({ enabled: z.boolean() }).partial().optional(),
  stddev: z.object({ enabled: z.boolean() }).partial().optional(),
  spike: z.object({ enabled: z.boolean() }).partial().optional(),
  vxSpike: z.object({ enabled: z.boolean() }).partial().optional(),
  profitTarget: z
    .object({ enabled: z.boolean(), thresholdPct: z.number().min(1).max(200) })
    .partial()
    .optional(),
  event: z.object({ enabled: z.boolean() }).partial().optional(),
});

/** Merged beliebige (auch leere/teilweise) gespeicherte Config über die Defaults. */
export function normalizeAlertConfig(raw: unknown): AlertConfig {
  const parsed = alertConfigSchema.safeParse(raw ?? {});
  const partial = parsed.success ? parsed.data : {};
  return {
    entry: { ...DEFAULT_ALERT_CONFIG.entry, ...partial.entry },
    stddev: { ...DEFAULT_ALERT_CONFIG.stddev, ...partial.stddev },
    spike: { ...DEFAULT_ALERT_CONFIG.spike, ...partial.spike },
    vxSpike: { ...DEFAULT_ALERT_CONFIG.vxSpike, ...partial.vxSpike },
    profitTarget: { ...DEFAULT_ALERT_CONFIG.profitTarget, ...partial.profitTarget },
    event: { ...DEFAULT_ALERT_CONFIG.event, ...partial.event },
  };
}
