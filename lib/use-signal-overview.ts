"use client";

import useSWR from "swr";
import { ENTRY_TARGETS, entryLevels, futureDaysLeft, type State, type Signal } from "@/lib/signals/engine";

/** Read-only summary of the signal state for dashboard and navigation. Missing access or errors simply yield null. */
export interface SignalOverview {
  enabled: boolean;
  checkedAt: string | null;
  broker: string;
  opensAt: string;
  closesAt: string;
  /** Entry levels with their cumulative target share, highest level first. */
  levels: { level: number; target: number }[];
  pending: Signal[];
  futureDaysLeft: number | null;
}

export function useSignalOverview(): SignalOverview | null {
  const { data } = useSWR<State>("/api/signals", { refreshInterval: 30_000, shouldRetryOnError: false });
  if (!data?.config) return null;
  const config = data.round?.config ?? data.config;
  const levels = entryLevels(config).map((level, index) => ({ level, target: ENTRY_TARGETS[index] }));
  return {
    enabled: data.config.enabled,
    checkedAt: data.checkedAt,
    broker: data.config.broker,
    opensAt: data.config.opensAt,
    closesAt: data.config.closesAt,
    levels,
    pending: (data.signals ?? []).filter((s) => s.status === "pending"),
    futureDaysLeft: futureDaysLeft(config, new Date()),
  };
}

/** How many entry levels the current VIX has reached (0–3) and the next one still open. */
export function levelProgress(levels: SignalOverview["levels"], vix: number | null | undefined) {
  if (vix == null || !levels.length) return { reached: 0, next: levels[0] ?? null };
  const reached = levels.filter((l) => vix <= l.level).length;
  return { reached, next: levels[reached] ?? null };
}
