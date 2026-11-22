"use client";

import Link from "next/link";
import { ChevronRight, ShieldCheck } from "lucide-react";
import type { Signal } from "@/lib/signals/engine";
import { levelProgress, type SignalOverview } from "@/lib/use-signal-overview";

const euro = (n: number, digits = 0) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: digits, maximumFractionDigits: digits });
const clock = (s: string) => new Date(s).toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
const level = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 2 });

function headline(signal: Signal) {
  if (signal.side === "buy") return `${signal.stage ? `KAUFEN · Stufe ${signal.stage}` : "KAUFEN"}`;
  return "VERKAUFEN";
}

function delivery(signal: Signal) {
  return (["telegram", "email"] as const).map((c) => {
    const n = signal.notification[c];
    const name = c === "email" ? "E-Mail" : "Telegram";
    return n?.sentAt ? `${name} ✓ ${clock(n.sentAt)}` : n?.error ? `${name} Fehler` : `${name} ausstehend`;
  }).join(" · ");
}

/** Desktop card: the newest open trade signal, or the entry-level status when nothing is open. */
export function SignalSummaryCard({ overview, vix }: { overview: SignalOverview | null; vix: number | null }) {
  const signal = overview?.pending[0];
  if (!overview) {
    return (
      <article className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-white">Handelssignale</h2><Link href="/signals" className="text-xs font-medium text-accent">Öffnen →</Link></div>
        <p className="text-sm leading-relaxed text-muted">VIX-Niveaus, Handelssignale und erfasste Ausführungen findest du im Signalbereich.</p>
      </article>
    );
  }
  if (!signal) {
    const { reached, next } = levelProgress(overview.levels, vix);
    return (
      <article className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-white">Handelssignale</h2><Link href="/signals" className="text-xs font-medium text-accent">Öffnen →</Link></div>
        <div className="flex items-center gap-2 text-sm text-muted"><ShieldCheck size={16} aria-hidden="true" />Kein offenes Handelssignal</div>
        <LevelBar overview={overview} vix={vix} />
        <p className="text-xs text-muted">
          {reached === 0 ? "Noch keine Kaufstufe erreicht" : `Kaufstufe ${reached} von ${overview.levels.length} erreicht`}
          {next && ` · nächste bei ${level(next.level)} → ${next.target} %`}
        </p>
      </article>
    );
  }
  const buy = signal.side === "buy";
  return (
    <article className={`flex flex-col gap-3.5 rounded-2xl border bg-surface p-5 ${buy ? "border-accent/40" : "border-danger/40"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${buy ? "bg-accent text-black" : "bg-danger text-white"}`}>{headline(signal)}</span>
        {buy && <span className="text-xs text-muted">gültig bis {clock(signal.expiresAt)}</span>}
      </div>
      <h2 className="text-[17px] font-semibold leading-snug text-white">{signal.reason}</h2>
      <dl className="grid grid-cols-3 gap-3 text-xs text-muted">
        <div><dt>{buy ? "Einsatz bis" : "Stück"}</dt><dd className="mt-0.5 font-mono text-base text-white">{buy ? euro(signal.budget) : signal.quantity.toLocaleString("de-DE")}</dd></div>
        <div><dt>{buy ? "Briefkurs" : "Geldkurs"}</dt><dd className="mt-0.5 font-mono text-base text-white">{euro(signal.price, 2)}</dd></div>
        <div><dt>{buy ? "Stück" : "Signalwert"}</dt><dd className="mt-0.5 font-mono text-base text-white">{buy ? signal.quantity.toLocaleString("de-DE") : euro(signal.quantity * signal.price)}</dd></div>
      </dl>
      <Link href={`/signals#${signal.id}`} className={`flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold ${buy ? "bg-accent text-black" : "bg-danger text-white"}`}>
        Ausführung erfassen
      </Link>
      <p className="text-xs text-muted">{delivery(signal)}{overview.pending.length > 1 && ` · ${overview.pending.length - 1} weitere offen`}</p>
    </article>
  );
}

/** Three-step progress bar of the entry cascade. */
export function LevelBar({ overview, vix }: { overview: SignalOverview; vix: number | null }) {
  const { reached } = levelProgress(overview.levels, vix);
  return (
    <div className="grid grid-cols-3 gap-1" role="img" aria-label={`Kaufstufe ${reached} von ${overview.levels.length} erreicht`}>
      {overview.levels.map((l, i) => (
        <div key={l.level} className="flex flex-col gap-1">
          <span className={`h-1.5 rounded-full ${i < reached ? "bg-accent" : "bg-[#2E2E3A]"}`} />
          <span className={`font-mono text-[11px] ${i < reached ? "text-accent" : "text-muted"}`}>≤ {level(l.level)} · {l.target} %</span>
        </div>
      ))}
    </div>
  );
}

/** Mobile: a tappable banner for the newest open signal. */
export function SignalBanner({ overview }: { overview: SignalOverview | null }) {
  const signal = overview?.pending[0];
  if (!signal) return null;
  const buy = signal.side === "buy";
  return (
    <Link href={`/signals#${signal.id}`} className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 ${buy ? "bg-accent text-black" : "bg-danger text-white"}`}>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-bold">{buy ? "KAUFSIGNAL" : "VERKAUFSSIGNAL"}{buy && signal.stage ? ` · STUFE ${signal.stage}` : ""}</div>
        <div className="mt-0.5 truncate text-[15px] font-semibold">
          {buy ? `Bis ${euro(signal.budget)} · gültig bis ${clock(signal.expiresAt)}` : `${signal.quantity.toLocaleString("de-DE")} Stück · ${euro(signal.price, 2)}`}
        </div>
      </div>
      <ChevronRight size={20} aria-hidden="true" />
    </Link>
  );
}
