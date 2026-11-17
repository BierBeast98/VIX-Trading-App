import type { State } from './signals/engine';

export type CapitalBaseline = {
  value: number;
  startingCapital?: number;
  asOf?: string;
  source?: 'strategy-baseline';
};
export type CapitalSummary = {
  currentCapital: number | null; startingCapital: number | null; asOf: string | null;
  source: 'strategy-baseline' | 'legacy-snapshot' | null; realizedPnlEur: number | null;
  returnPct: number | null; annualizedReturnPct: number | null;
  availableCapital: number | null; investedCapital: number; allocationCapital: number | null;
};
const cents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
/** Cash movements plus remaining acquisition cost; no estimated market prices or legacy trades. */
export function capitalSummary(baseline: CapitalBaseline | null, state: State | null): CapitalSummary {
  const empty: CapitalSummary = { currentCapital: null, startingCapital: null, asOf: null,
    source: null, realizedPnlEur: null, returnPct: null, annualizedReturnPct: null,
    availableCapital: null, investedCapital: 0, allocationCapital: null };
  if (!baseline || !Number.isFinite(baseline.value)) return empty;
  if (baseline.source !== 'strategy-baseline' || !baseline.asOf || !Number.isFinite(Date.parse(baseline.asOf)) || !Number.isFinite(baseline.startingCapital)) {
    return { ...empty, source: 'legacy-snapshot' };
  }
  const startingCapital = baseline.startingCapital!;
  if (startingCapital < 0) return empty;
  const since = Date.parse(baseline.asOf);
  const fills = (state?.executions ?? []).filter(e => Date.parse(e.at) >= since);
  // An older open round cannot be attributed to a newly established strategy baseline.
  if (state?.round && Date.parse(state.round.startedAt) < since) return { ...empty, startingCapital, asOf: baseline.asOf, source: 'strategy-baseline' };
  if (fills.some(e => !Number.isFinite(e.price) || e.price <= 0 || !Number.isInteger(e.quantity) || e.quantity <= 0 || !Number.isFinite(e.fees) || e.fees < 0)) return empty;
  const cashChange = fills.reduce((sum, e) => sum + (e.side === 'sell' ? e.quantity * e.price - e.fees : -(e.quantity * e.price + e.fees)), 0);
  const investedCapital = (state?.round?.lots ?? []).reduce((sum, l) => sum + l.cost, 0);
  if (!Number.isFinite(investedCapital) || investedCapital < 0) return empty;
  const availableCapital = cents(startingCapital + cashChange);
  const currentCapital = cents(startingCapital + cashChange + investedCapital);
  const realizedPnlEur = cents(currentCapital - startingCapital);
  return { currentCapital, startingCapital, asOf: baseline.asOf, source: 'strategy-baseline',
    realizedPnlEur, returnPct: startingCapital > 0 ? realizedPnlEur / startingCapital * 100 : null,
    annualizedReturnPct: null, availableCapital, investedCapital: cents(investedCapital),
    allocationCapital: state?.round?.capital ?? state?.config?.capital ?? startingCapital };
}
