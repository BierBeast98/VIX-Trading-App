import { DEFAULT_VIX_LEVELS, entryVixUsable, marketOpen, notificationLevels, type Quote, type State } from './engine';
export type LevelEvent = {
  id: string; at: string; levels: number[]; value: number; sourceAt: string;
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
  if (reached.length) levels.events.unshift({ id: crypto.randomUUID(), at: now.toISOString(), levels: reached,
    value: quote.vix!, sourceAt: quote.vixAt!, source: quote.vixSource ?? 'unbekannt',
    delayed: quote.vixFeedMode === 'delayed', notification: {} });
}
export function levelText(event: LevelEvent): string {
  return ['VIX-EINSTIEGSNIVEAU ERREICHT',
    `Niveau(s): ${event.levels.map(n => n.toLocaleString('de-DE')).join(' / ')} erreicht oder unterschritten.`,
    `Beobachteter VIX: ${event.value.toLocaleString('de-DE')}`,
    `Kurszeit: ${new Date(event.sourceAt).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })} (Berlin)`,
    `Quelle: ${event.source === 'yahoo' ? 'Yahoo Finance' : event.source}${event.delayed ? ' · verzögert (bis zu 20 Minuten bei Erkennung)' : ''}`,
    'Reine Niveau-Meldung, unabhängig vom Zertifikat. Kaufbedingungen sind damit nicht bestätigt.',
    'Zertifikat und aktuellen Kurs vor einem manuellen Kauf prüfen. Es wurde keine Order ausgeführt.',
    'https://vix-trading.de/signals'].join('\n');
}
