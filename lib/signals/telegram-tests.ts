import type { Signal } from './engine';

export const telegramTestLabels = {
  buy: 'Einstieg',
  add: 'Nachkauf',
  trailing: 'Trailing',
  partial: 'Teilverkauf',
  remaining: 'Restverkauf',
  loss: 'Verlustgrenze',
} as const;
export type TelegramTest = keyof typeof telegramTestLabels;
export function isTelegramTest(value: unknown): value is TelegramTest {
  return typeof value === 'string' && Object.hasOwn(telegramTestLabels, value);
}

const examples = {
  buy: { side: 'buy', reason: 'Einstieg · VIX von 16,08 auf 15,94 · erste Kaufstufe', targetPct: 30, budget: 450, quantity: 225, price: 2, vix: 15.94 },
  add: { side: 'buy', reason: 'Nachkauf · VIX von 15,08 auf 14,94 · zweite Kaufstufe', targetPct: 40, budget: 150, quantity: 75, price: 2, vix: 14.94 },
  trailing: { side: 'sell', reason: 'Trailing · Hoch +40 % · Schwelle +35 % · Rendite +35 % · gesamte offene Position', quantity: 200, price: 2.70 },
  partial: { side: 'sell', reason: 'Teilverkauf 50 % · Tag 15 · offene Position −12 % · Schwelle −10 %', quantity: 100, price: 1.76 },
  remaining: { side: 'sell', reason: 'Restverkauf · Tag 30 · Restposition −22 % · Schwelle −20 %', quantity: 100, price: 1.56 },
  loss: { side: 'sell', reason: 'Verlustgrenze −35 % erreicht · offene Position −36 % · gesamte offene Position', quantity: 200, price: 1.28 },
} satisfies Record<TelegramTest, Pick<Signal, 'side' | 'reason' | 'quantity' | 'price'> & Partial<Signal>>;

export function telegramTestSignal(scenario: TelegramTest, now: Date): Signal {
  const at = now.toISOString();
  return {
    id: '', roundId: scenario === 'buy' ? null : 'demo', isin: 'DEMO (fiktiv)', at, quoteAt: at,
    expiresAt: new Date(now.getTime() + 5 * 60000).toISOString(),
    status: 'pending', capital: 1500, stage: 1, targetPct: 0, budget: 0,
    allocations: [], vix: null, notification: {},
    ...(scenario === 'buy' || scenario === 'add' ? {
      vixSource: 'yahoo', vixFeedMode: 'delayed', vixAt: new Date(now.getTime() - 15 * 60000).toISOString(), vixAgeMinutes: 15,
    } : {}),
    ...examples[scenario],
  };
}
