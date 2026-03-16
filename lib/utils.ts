import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number, decimals = 2): string {
  return n.toFixed(decimals);
}

export function formatPct(n: number, decimals = 2): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(decimals)}%`;
}

export function formatCurrency(n: number, currency = "USD"): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(n);
}

export function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(d: Date | string): string {
  return new Date(d).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function calcZScore(values: number[], current: number): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const std = Math.sqrt(variance);
  if (std === 0) return 0;
  return (current - mean) / std;
}

export function calcRollingMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function calcSharpeRatio(returns: number[], riskFreeRate = 0): number {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  const std = Math.sqrt(variance);
  if (std === 0) return 0;
  return (mean - riskFreeRate) / std;
}

export function calcStepFloor(
  targetReturn: number,
  stepPct: number,
  currentPnl: number
): number | null {
  if (stepPct <= 0) return null;
  const stepsAbove = Math.floor((currentPnl - targetReturn) / stepPct);
  if (stepsAbove < 1) return null;
  return targetReturn + (stepsAbove - 1) * stepPct;
}
