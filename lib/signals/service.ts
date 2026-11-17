import { readState, changeState } from './store';
import { evaluate, marketOpen } from './engine';
import { loadQuote } from './market';
import { deliverSignals } from './notify';
export async function runSignalsCheck() {
  const before = await readState();
  if (!before.config.enabled) return { checked: false, message: 'Signalüberwachung pausiert' };
  if (!marketOpen(before.config, new Date())) {
    await changeState(async state => { state.checkedAt = new Date().toISOString(); state.health = 'Handelsfenster geschlossen oder Brokerzeiten fehlen'; return { state, result: undefined }; });
    return { checked: false, managed: true, message: 'Außerhalb des eingerichteten Broker-Handelsfensters' };
  }
  const quote = await loadQuote(before.round?.config ?? before.config);
  const result = await changeState(async (state, tx) => {
    // Reject drift through legacy/manual DB edits before calculating from stale inventory.
    if (state.round) {
      for (const lot of state.round.lots.filter(l => l.quantity > 0 && l.tradeId)) {
        const trade = await tx.trade.findUnique({ where: { id: lot.tradeId } });
        if (!trade || trade.exitDate || trade.quantity !== lot.quantity || trade.entryPrice !== lot.entryPrice) {
          state.health = 'Bestand weicht vom bestätigten Signalbestand ab; bitte abgleichen';
          state.config.enabled = false;
          return { state, result: { checked: false, managed: true, message: state.health } };
        }
      }
    }
    const next = evaluate(state, quote, new Date());
    return { state: next, result: { checked: true, managed: true, message: next.health } };
  });
  await deliverSignals();
  return result;
}
