import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { initialState, type State, type Fill, confirm, fillSignalId } from './engine';
export const STATE_ID = 'manual_strategy_v1';
export async function readState(): Promise<State> {
  const row = await prisma.vixCache.findUnique({ where: { id: STATE_ID } });
  return row ? row.data as unknown as State : initialState();
}
/** One PostgreSQL row lock serializes cron ticks, configuration and confirmations across processes. */
export async function changeState<T>(fn: (s: State, tx: Prisma.TransactionClient) => Promise<{ state: State; result: T }>): Promise<T> {
  return prisma.$transaction(async tx => {
    await tx.vixCache.upsert({ where: { id: STATE_ID }, create: { id: STATE_ID, data: initialState() as unknown as Prisma.InputJsonValue }, update: {} });
    await tx.$queryRaw`SELECT id FROM "VixCache" WHERE id = ${STATE_ID} FOR UPDATE`;
    const row = await tx.vixCache.findUniqueOrThrow({ where: { id: STATE_ID } });
    const { state, result } = await fn(row.data as unknown as State, tx);
    await tx.vixCache.update({ where: { id: STATE_ID }, data: { data: state as unknown as Prisma.InputJsonValue } });
    return result;
  }, { timeout: 20000 });
}
/** Allocate the cumulative amount rounded to cents so the final row retains any residual. */
function cashThrough(total: number, sold: number, quantity: number): number {
  return sold === quantity ? total : Math.round(total * sold / quantity * 100) / 100;
}

export async function recordFill(fill: Fill) {
  return changeState(async (before, tx) => {
    const signalId = fillSignalId(fill);
    const state = confirm(before, fill, new Date());
    const execution = state.executions.find(e => e.signalId === signalId);
    if (!execution || before.executions.some(e => e.signalId === signalId)) return { state, result: state };
    const signal = state.signals.find(s => s.id === signalId)!;
    if (execution.side === 'buy') {
      const r = state.round!; const lot = r.lots[r.lots.length - 1];
      const position = await tx.position.create({ data: {
        certificateId: signal.isin, name: `Signalrunde ${r.id.slice(0, 8)}`, direction: 'long',
        entryVix: signal.vix ?? 0, entryPrice: lot.entryPrice, currentPrice: lot.entryPrice,
        barrierLevel: r.config.barrier, currentBarrier: r.config.barrier,
        leverageRatio: r.config.leverage, notes: `signal:${signal.id}; Ausführung manuell bestätigt`,
      } });
      const trade = await tx.trade.create({ data: {
        positionId: position.id, certificateId: signal.isin, direction: 'long',
        entryDate: new Date(execution.at), entryVix: signal.vix ?? 0, entryPrice: lot.entryPrice,
        quantity: lot.quantity, entryFees: execution.fees, barrierLevel: r.config.barrier, leverageRatio: r.config.leverage,
        alertTriggered: true, notes: `signal:${signal.id}; Gebühren ${execution.fees} EUR; ${execution.note}`,
      } });
      lot.positionId = position.id; lot.tradeId = trade.id;
    } else {
      let cumulativeSold = 0;
      for (const old of before.round!.lots) {
        const remaining = state.round?.lots.find(l => l.id === old.id)?.quantity ?? 0;
        const sold = old.quantity - remaining;
        if (!sold) continue;
        if (!old.tradeId || !old.positionId) throw new Error('Zur Tranche fehlt die zugehörige Buchung. Bitte den Bestand abgleichen.');
        const trade = await tx.trade.findUnique({
          where: { id: old.tradeId }, select: { quantity: true, exitDate: true, entryFees: true },
        });
        if (!trade || trade.exitDate || trade.quantity !== old.quantity) throw new Error('Bestand weicht von der bestätigten Signalrunde ab');
        const entryFees = trade.entryFees ?? Math.round(old.fees * old.quantity / old.originalQuantity * 100) / 100;
        const soldEntryFees = cashThrough(entryFees, sold, old.quantity);
        const previousSold = cumulativeSold;
        cumulativeSold += sold;
        const allocated = (amount: number) => Math.round((cashThrough(amount, cumulativeSold, execution.quantity)
          - cashThrough(amount, previousSold, execution.quantity)) * 100) / 100;
        const close = {
          entryFees: soldEntryFees, exitFees: allocated(execution.fees),
          taxWithheld: execution.taxWithheld == null ? null : allocated(execution.taxWithheld),
          exitDate: new Date(execution.at), exitPrice: execution.price, exitVix: signal.vix,
          returnPct: (execution.price / old.entryPrice - 1) * 100,
          holdDays: Math.max(0, Math.round((Date.parse(execution.at) - Date.parse(old.enteredAt)) / 86400000)),
        };
        if (remaining === 0) {
          await tx.trade.update({ where: { id: old.tradeId }, data: close });
          await tx.position.update({ where: { id: old.positionId }, data: { status: 'closed', currentPrice: execution.price } });
        } else {
          await tx.trade.update({ where: { id: old.tradeId }, data: { quantity: remaining, entryFees: Math.round((entryFees - soldEntryFees) * 100) / 100 } });
          // Closed tranche gets its own closed Position so the legacy trade editor cannot close the open remainder.
          const position = await tx.position.create({ data: {
            certificateId: signal.isin, name: 'Bestätigter Teilverkauf', direction: 'long',
            entryVix: 0, entryPrice: old.entryPrice, currentPrice: execution.price,
            barrierLevel: before.round!.config.barrier, currentBarrier: before.round!.config.barrier,
            leverageRatio: before.round!.config.leverage, status: 'closed', notes: `signal:${signal.id}`,
          } });
          await tx.trade.create({ data: {
            ...close, positionId: position.id, certificateId: signal.isin, direction: 'long',
            entryDate: new Date(old.enteredAt), entryVix: 0, entryPrice: old.entryPrice, quantity: sold,
            barrierLevel: before.round!.config.barrier, alertTriggered: true,
            notes: `signal:${signal.id}; Teilverkauf; ${execution.note}`,
          } });
        }
      }
    }
    return { state, result: state };
  });
}
