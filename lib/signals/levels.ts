import { DEFAULT_VIX_LEVELS, ENTRY_TARGETS, entryLevels, entryVixUsable, marketOpen, notificationLevels, type Quote, type State } from './engine';
export type LevelEvent = {
  id: string; at: string; levels: number[]; value: number; sourceAt: string;
  telegramMessage?: string;
  entryHint?: { previous: number; target: number; budget: number };
  source: string; delayed: boolean;
  notification: Partial<Record<'telegram' | 'email', { sentAt?: string; error?: string; leaseAt?: string }>>;
};
export type LevelState = { sourceAt: string | null; below: number[]; events: LevelEvent[] };
export const LEVELS = DEFAULT_VIX_LEVELS;
/** Level observations are independent of product eligibility and never create orders or fills. */
export function evaluateLevels(state: State, quote: Quote, now: Date): void {
  if (!state.config.enabled || !marketOpen(state.config, now) || !entryVixUsable(state.config, quote, now)) return;
  const levels = state.levels ??= { sourceAt: null, below: [], events: [] };
  if (levels.sourceAt && Date.parse(quote.vixAt!) <= Date.parse(levels.sourceAt)) return;
  const below = notificationLevels(state.config).filter(level => quote.vix! <= level);
  const reached = below.filter(level => !levels.below.includes(level));
  levels.sourceAt = quote.vixAt;
  levels.below = below;
  const thresholds = entryLevels(state.config);
  const elapsed = Date.parse(quote.vixAt!) - Date.parse(state.previousVixAt ?? '');
  const crossed = !state.round && !state.config.isin && state.armed && elapsed > 0 && elapsed <= 600000
    && state.previousVix != null && state.previousVix >= thresholds[0] && quote.vix! < thresholds[0];
  const target = ENTRY_TARGETS[quote.vix! < thresholds[2] ? 2 : quote.vix! < thresholds[1] ? 1 : 0];
  const entryHint = crossed ? { previous: state.previousVix!, target, budget: state.config.capital * target / 100 } : undefined;
  if (reached.length || entryHint) levels.events.unshift({ id: crypto.randomUUID(), at: now.toISOString(), levels: reached, ...(entryHint && { entryHint }),
    value: quote.vix!, sourceAt: quote.vixAt!, source: quote.vixSource ?? 'unbekannt',
    delayed: quote.vixFeedMode === 'delayed', notification: {} });
}
export function levelText(event: LevelEvent): string {
  const number = (value: number) => value.toLocaleString('de-DE');
  const hint = event.entryHint;
  if (hint) return ['EINSTIEGSHINWEIS', `VIX von ${number(hint.previous)} auf ${number(event.value)}`,
    `Zielquote: ${hint.target} % · Einsatz bis ${hint.budget.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} inkl. Gebühren`,
    event.levels.length && `VIX-Niveau ${event.levels.map(number).join(' / ')} erreicht`,
  ].filter(Boolean).join('\n');
  return ['VIX-EINSTIEGSNIVEAU ERREICHT',
    `Niveau(s): ${event.levels.map(n => n.toLocaleString('de-DE')).join(' / ')} erreicht oder unterschritten.`,
    `Beobachteter VIX: ${event.value.toLocaleString('de-DE')}`,
  ].join('\n');
}
