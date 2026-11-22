'use client';
import useSWR from 'swr';
import Link from 'next/link';
import type { CapitalSummary } from '@/lib/capital';
import { formatPct } from '@/lib/utils';

const euro = (n: number | null | undefined, digits = 2) => n == null ? '—' : n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: digits, maximumFractionDigits: digits });

export function StrategyCapital({ showReturn = false, variant = 'full' }: { showReturn?: boolean; variant?: 'full' | 'compact' }) {
  const { data, error } = useSWR<CapitalSummary>('/api/account-capital', { refreshInterval: 60000 });

  if (variant === 'compact') {
    const total = (data?.investedCapital ?? 0) + (data?.availableCapital ?? 0);
    const boundShare = total > 0 ? Math.min(100, Math.max(0, (data?.investedCapital ?? 0) / total * 100)) : 0;
    return <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold text-white">Strategiekapital</h2><Link href="/signals" className="text-xs font-medium text-accent">Details →</Link></div>
      <p className="font-mono text-2xl font-semibold text-white">
        {euro(data?.currentCapital, 0)}
        {data?.returnPct != null && <span className={`ml-2 text-sm ${data.returnPct >= 0 ? 'text-success' : 'text-danger'}`}>{formatPct(data.returnPct, 1)}</span>}
      </p>
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={`${boundShare.toFixed(0)} % des Kapitals gebunden`}>
        <div className="rounded-full bg-[#5B8DEF]" style={{ width: `${boundShare}%` }} />
        <div className="flex-1 rounded-full bg-[#2A2A35]" />
      </div>
      <dl className="grid grid-cols-2 gap-3 text-xs text-muted">
        <div><dt><span aria-hidden="true" className="text-[#5B8DEF]">■</span> Gebunden</dt><dd className="mt-0.5 font-mono text-[15px] text-white">{euro(data?.investedCapital, 0)}</dd></div>
        <div><dt><span aria-hidden="true" className="text-[#4A4A58]">■</span> Verfügbar</dt><dd className="mt-0.5 font-mono text-[15px] text-white">{euro(data?.availableCapital, 0)}</dd></div>
      </dl>
      <p className="text-xs text-muted">{error ? 'Kapitaldaten konnten nicht geladen werden.' : `Start ${euro(data?.startingCapital, 0)} · inkl. Gebühren & erfasster Steuern`}</p>
      {!!data?.salesWithoutTax && <p className="text-xs text-warning">Für {data.salesWithoutTax} Verkaufsausführung(en) fehlt der Steuerabzug.</p>}
    </section>;
  }

  return <section className="rounded-2xl border border-[#1E1E28] bg-[#141418] p-4">
    <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold text-white">Dein Strategiekapital</h2><Link href="/signals" className="text-xs text-[#B8E15A]">Zu den Signalen →</Link></div>
    <div className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-4">
      {([['Startkapital', data?.startingCapital], ['Kapital (Buchwert)', data?.currentCapital], ['Verfügbar', data?.availableCapital], ['Gebunden zum Einstand', data?.investedCapital]] as const).map(([label, amount]) => <div key={label}><p className="text-xs text-[#8B8FA8]">{label}</p><p className="mt-1 text-lg font-semibold text-white">{euro(amount)}</p></div>)}
    </div>
    {showReturn && data?.returnPct != null && <p className="mt-3 text-sm text-white">Realisierte Rendite seit Kapitalbasis · {formatPct(data.returnPct)}</p>}
    <p className="mt-3 text-xs text-[#8B8FA8]">{error ? 'Kapitaldaten konnten nicht geladen werden.' : 'Bestätigte Ausführungen inklusive Gebühren und erfasster Steuern. Offene Positionen zum Einstand.'}</p>
    {!!data?.salesWithoutTax && <p className="mt-2 text-xs text-warning">Für {data.salesWithoutTax} Verkaufsausführung(en) fehlt der Steuerabzug.</p> }
  </section>;
}
