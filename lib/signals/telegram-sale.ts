import type { Prisma } from '@prisma/client';
import type { State } from './engine';
import { changeState, persistFill } from './store';
import { telegramCall } from './telegram';

const help = 'Beispiel: Verkauf 50 Stück zu 2,40 €. Für einen Verkauf zählt der Kurs je Stück.';
const decimal = '(\\d+(?:[.,]\\d{1,8})?)';
const units = '(\\d+)\\s*(?:Stück|Stk\\.?)';
const price = '(?:zu|à|@|Kurs)\\s*' + decimal + '\\s*(?:€|EUR)?';
const quantityFirst = new RegExp('^(?:Verkauf|Verkauft)\\s*:?\\s*' + units + '\\s*[,;]?\\s*' + price + '$', 'iu');
const priceFirst = new RegExp('^(?:Verkauf|Verkauft)\\s*:?\\s*' + price + '\\s*[,;]?\\s*' + units + '$', 'iu');
const amount = (text: string) => Number(text.replace(',', '.'));
const euros = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 8 }) + ' €';
export function parseSale(text: string) {
  const q = text.trim().match(quantityFirst), p = text.trim().match(priceFirst);
  if (!q && !p) return;
  const quantity = Number(q ? q[1] : p![2]), price = amount(q ? q[2] : p![1]);
  if (Number.isSafeInteger(quantity) && quantity > 0 && quantity <= 100000000 && Number.isFinite(quantity * price) && price > 0)
    return { quantity, price };
}
type Draft = { message: number; round: string; isin: string; quantity: number; price: number; at: string;
  lastExecution: string; signalId?: string };
function makeDraft(state: State, text: string, chat: string, message: number, date: number, reply?: number): Draft | string {
  const sale = parseSale(text);
  if (!sale) return help;
  const r = state.round;
  if (!r) return 'Es gibt keine offene Signalposition. Prüfe bitte zuerst die Kaufbuchung.';
  const pending = state.signals.find(s => s.roundId === r.id && s.side === 'sell' && s.status === 'pending');
  const signal = reply ? state.signals.find(s => s.telegramMessages?.includes(`${chat}:${reply}`)) : pending;
  if (reply && (!signal || signal.side !== 'sell' || signal.roundId !== r.id || signal.status !== 'pending'))
    return 'Diese Antwort gehört zu keinem offenen Verkauf der aktuellen Runde. Sende den Verkauf als neue Nachricht.';
  if (sale.quantity > r.lots.reduce((sum, lot) => sum + lot.quantity, 0)) return 'Die Stückzahl übersteigt den offenen Bestand.';
  if (reply && signal && sale.quantity > signal.quantity) return 'Die Stückzahl übersteigt das beantwortete Signal. Prüfe sie oder melde den Verkauf als neue Nachricht.';
  const at = new Date(date * 1000).toISOString();
  const last = state.executions[0];
  const latest = Math.max(Date.parse(r.startedAt), ...r.lots.map(l => Date.parse(l.enteredAt)), last ? Date.parse(last.at) : 0);
  if (date * 1000 < latest) return 'Nach dieser Nachricht wurde bereits eine Ausführung erfasst. Bitte mit dem Bestand abgleichen.';
  if (reply && signal && date * 1000 < Date.parse(signal.at)) return 'Die Verkaufszeit liegt vor dem Signal.';
  return { message, round: r.id, isin: r.config.isin, ...sale, at, lastExecution: last?.id ?? '',
    ...(signal && sale.quantity <= signal.quantity && Date.parse(at) >= Date.parse(signal.at) && { signalId: signal.id }) };
}
async function applyDraft(state: State, tx: Prisma.TransactionClient, d: Draft, fees: number, tax: number | null) {
  const r = state.round;
  const signal = d.signalId && state.signals.find(s => s.id === d.signalId);
  if (!r || r.id !== d.round || r.config.isin !== d.isin || (state.executions[0]?.id ?? '') !== d.lastExecution ||
      (d.signalId && (!signal || signal.status !== 'pending'))) return { state, result: 'Der Bestand hat sich geändert. Bitte den Verkauf neu melden.' };
  const id = d.signalId ?? crypto.randomUUID();
  if (!signal) {
    const allocations = r.lots.filter(l => l.quantity > 0).map(l => ({ lotId: l.id, quantity: l.quantity }));
    state.signals.unshift({ id, roundId: r.id, isin: d.isin, side: 'sell', reason: 'Manuell gemeldeter Verkauf',
      at: d.at, quoteAt: d.at, expiresAt: d.at, stage: r.stage, targetPct: 0, budget: 0, capital: r.capital,
      vix: null, price: d.price, quantity: allocations.reduce((sum, l) => sum + l.quantity, 0), allocations,
      status: 'pending', notification: {} });
  }
  const booked = await persistFill(state, tx, { signalId: id, action: 'execute', quantity: d.quantity,
    price: d.price, fees, at: d.at, taxWithheld: tax, note: 'Verkauf in Telegram bestätigt' });
  for (const s of booked.state.signals) {
    if (s.roundId === r.id && s.status === 'pending') s.status = 'superseded';
  }
  const remaining = booked.state.round?.lots.reduce((n, l) => n + l.quantity, 0) ?? 0;
  return { state: booked.state, result: `Verkauf eingetragen: ${d.quantity} Stück zu ${euros(d.price)}. Restbestand: ${remaining} Stück.` };
}
export async function handleSaleText(bot: string, chat: string, raw: string, message: number, date: number, reply?: number) {
  const text = raw.trim();
  if (!/^(Verkauf|Verkauft|Buchen)\b/iu.test(text)) return;
  const prefix = `telegram-sale:${bot}:${chat}`;
  const resultId = `${prefix}:${message}`;
  const result = await changeState(async (state, tx) => {
    const previous = await tx.vixCache.findUnique({ where: { id: resultId } });
    if (previous) {
      const data = previous.data as { result: string; sent: boolean };
      return { state, result: data.sent ? null : data.result };
    }
    let result: string;
    if (/^Buchen\b/iu.test(text)) {
      const match = /^Buchen\s+(\d+)\s+(\d+(?:[.,]\d{1,2})?)(?:\s*(?:€|EUR))?(?:\s+Steuer\s+(\d+(?:[.,]\d{1,2})?)\s*(?:€|EUR)?)?$/iu.exec(text);
      const row = await tx.vixCache.findUnique({ where: { id: prefix } });
      const d = row?.data as unknown as Draft | undefined;
      if (!match || !Number.isFinite(amount(match[2])) || (match[3] && !Number.isFinite(amount(match[3])))) result = 'Format: Buchen <Nummer> <Gebühren in EUR>. Optional: Steuer <Betrag>.';
      else if (!d || Number(match[1]) !== d.message) result = 'Dieser Verkaufsvorschlag ist nicht mehr offen.';
      else {
        const booked = await applyDraft(state, tx, d, amount(match[2]), match[3] ? amount(match[3]) : null);
        state = booked.state; result = booked.result;
        await tx.vixCache.delete({ where: { id: prefix } });
      }
    } else {
      const d = makeDraft(state, text, chat, message, date, reply);
      if (typeof d === 'string') result = d;
      else {
        await tx.vixCache.upsert({ where: { id: prefix }, create: { id: prefix, data: d }, update: { data: d } });
        const at = new Date(d.at).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' });
        result = `Verkauf erfassen? ${d.isin} · ${d.quantity} Stück zu ${euros(d.price)}. Ausführungszeit: ${at} (Nachrichtenzeit, Berlin).\nBestätige mit „Buchen ${message} 0“, wenn die Gebühren 0 € betragen. Sonst ersetze 0 durch die Gebühren. Optional ergänzen: Steuer 1,23.`;
      }
    }
    await tx.vixCache.create({ data: { id: resultId, data: { result, sent: false } } });
    return { state, result };
  }).catch(async (error: unknown) => {
    const reason = error instanceof Error ? error.message : '';
    const conflicts = ['Zur Tranche fehlt die zugehörige Buchung. Bitte den Bestand abgleichen.',
      'Bestand weicht von der bestätigten Signalrunde ab', 'Verkauf überschreitet den zugehörigen Bestand',
      'Bestand wurde zwischenzeitlich verändert', 'Stückzahl, Kurs, Gebühren oder Ausführungszeit ungültig'];
    if (!conflicts.includes(reason)) throw error;
    const result = `Verkauf nicht gebucht. ${reason}`;
    const { prisma } = await import('@/lib/prisma');
    await prisma.vixCache.upsert({ where: { id: resultId }, create: { id: resultId, data: { result, sent: false } }, update: {} });
    return result;
  });
  if (!result) return;
  await telegramCall('sendMessage', { chat_id: chat, text: result });
  const { prisma } = await import('@/lib/prisma');
  await prisma.vixCache.update({ where: { id: resultId }, data: { data: { result, sent: true } } });
}
