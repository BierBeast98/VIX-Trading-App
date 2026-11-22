'use client';
import useSWR from 'swr';
import Link from 'next/link';
import type { CapitalSummary } from '@/lib/capital';
import { formatPct } from '@/lib/utils';
export function StrategyCapital({ showReturn = false }: { showReturn?: boolean }) {
  const { data, error } = useSWR<CapitalSummary>('/api/account-capital', { refreshInterval: 60000 });
  const euro = (n: number | null | undefined) => n == null ? '—' : n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
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
