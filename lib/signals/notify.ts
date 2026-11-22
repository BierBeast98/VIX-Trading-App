import { telegramChatId } from './telegram';
import { Resend } from 'resend';
import { readState, changeState } from './store';
import { marketOpen, fresh, entryVixUsable, type Signal, type State } from './engine';
const eur = (n: number) => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
export function signalText(s: Signal, reminder = false) {
  return [reminder ? 'Erinnerung: Ausführung noch nicht erfasst' : (s.side === 'buy' ? 'KAUFSIGNAL' : 'VERKAUFSSIGNAL'),
    s.reason, `ISIN: ${s.isin}`, `Rundenbudget: ${eur(s.capital)}`,
    s.side === 'buy' ? `Zielquote: ${s.targetPct} % · zusätzlicher Betrag bis ${eur(s.budget)} inkl. Gebühren` : 'Verkauf der angegebenen Stückzahl',
    `${s.quantity} Stück · ${s.side === 'buy' ? 'Briefkurs' : 'Geldkurs'} bei Signal: ${eur(s.price)}`,
    s.side === 'buy' ? `VIX-Einstiegsbasis: ${s.vixSource === 'yahoo' ? 'Yahoo Finance' : s.vixSource ?? 'Quelle nicht aufgezeichnet'} · ${s.vixFeedMode === 'delayed' ? 'verzögert' : s.vixFeedMode === 'realtime' ? 'Echtzeit' : 'Feedmodus nicht aufgezeichnet'} · Kurszeit ${s.vixAt ? new Date(s.vixAt).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' }) : 'nicht aufgezeichnet'} · Alter bei Signal ${s.vixAgeMinutes != null ? s.vixAgeMinutes.toFixed(1) + ' Min.' : 'nicht aufgezeichnet'}` : '',
    s.side === 'buy' && s.vixFeedMode === 'delayed' ? 'VIX-Einstiegsbasis ist zeitversetzt; der aktuelle Zertifikatskurs kann bereits auf Marktbewegungen reagiert haben.' : '',
    `Vontobel-Kurszeit: ${new Date(s.quoteAt).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}`,
    s.side === 'buy' ? `Kaufsignal gültig bis ${new Date(s.expiresAt).toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin' })}; Gebühren bei Stückzahl berücksichtigen.` : 'Verkaufssignal bleibt bis zur Bestätigung offen. Aktuellen Kurs vor der Order prüfen.',
    'Order selbst beim Broker aufgeben. Danach Screenshot senden oder Ausführung in der App erfassen.',
    process.env.APP_URL ? `${process.env.APP_URL.replace(/\/$/, '')}/signals#${s.id}` : '',
  ].filter(Boolean).join('\n');
}
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
/** Recheck both the signal's original basis and the latest observation before claiming a delivery. */
function dispatchable(state: State, signal: Signal, now: Date): boolean {
  const quote = state.quote, cfg = state.round?.config ?? state.config;
  if (!quote || quote.isin !== signal.isin || quote.issuerStatus === 'inactive' || !positive(quote.bid) || !fresh(quote.productAt, now)) return false;
  if (signal.side === 'sell') return true;
  const basis = { ...quote, vix: signal.vix, vixAt: signal.vixAt ?? null,
    vixSource: signal.vixSource, vixFeedMode: signal.vixFeedMode,
    vixRealtime: signal.vixSource === 'massive' && signal.vixFeedMode === 'realtime' };
  return quote.productValid !== false && positive(quote.ask) && quote.ask >= quote.bid && positive(quote.future) &&
    fresh(quote.askAt ?? quote.productAt, now) && fresh(quote.futureAt, now) && fresh(signal.quoteAt, now) &&
    entryVixUsable(cfg, quote, now) && entryVixUsable(cfg, basis, now) && Date.parse(signal.expiresAt) >= now.getTime();
}
/** Per-channel receipts: failures retry; successful channels are not resent until reminder due. */
export async function deliverSignals() {
  const state = await readState(); const now = new Date();
  if (!state.config.enabled || !marketOpen(state.config, now)) return;
  if (!state.quote || !fresh(state.quote.productAt, now)) return;
  for (const signal of state.signals.filter(s => s.status === 'pending')) {
    if (!dispatchable(state, signal, now)) continue;
    for (const channel of ['telegram', 'email'] as const) {
      if (!state.config[channel]) continue;
      const leaseKey = `${channel}:lease`;
      const claimed = await changeState(async s => {
        const target = s.signals.find(x => x.id === signal.id);
        if (!s.config.enabled || !marketOpen(s.config, new Date()) || target?.status !== 'pending') return { state: s, result: null };
        if (!dispatchable(s, target, new Date())) return { state: s, result: null };
        const receipt = target.notification[channel];
        const elapsed = receipt?.sentAt ? Date.now() - Date.parse(receipt.sentAt) : Infinity;
        const interval = target.side === 'sell' ? 15 * 60000 : 86400000;
        const leases = target.notification as Record<string, { sentAt?: string; error?: string }>;
        const lease = leases[leaseKey]?.sentAt;
        if (elapsed < interval || (lease && Date.now() - Date.parse(lease) < 60000)) return { state: s, result: null };
        leases[leaseKey] = { sentAt: new Date().toISOString() };
        return { state: s, result: { signal: target, reminder: !!receipt?.sentAt } };
      });
      if (!claimed) continue;
      let error: string | undefined;
      try {
        const text = signalText(claimed.signal, claimed.reminder);
        if (channel === 'telegram') {
          const token = process.env.TELEGRAM_BOT_TOKEN, chatId = await telegramChatId();
          if (!token || !chatId) throw new Error('Telegram noch nicht eingerichtet');
          const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text, link_preview_options: { is_disabled: true } }), signal: AbortSignal.timeout(10000),
          });
          const data = await response.json();
          if (!response.ok || !data.ok) throw new Error('Telegram hat die Nachricht nicht angenommen');
        } else {
          const { prisma } = await import('@/lib/prisma');
          const settings = await prisma.settings.findUnique({ where: { id: 1 } });
          if (!process.env.RESEND_API_KEY || !settings?.alertEmail) throw new Error('E-Mail noch nicht eingerichtet');
          const result = await new Resend(process.env.RESEND_API_KEY).emails.send({
            from: process.env.ALERT_FROM_EMAIL || 'VIX Trading <onboarding@resend.dev>', to: settings.alertEmail,
            subject: `${signal.side === 'buy' ? 'Kaufsignal' : 'Verkaufssignal'}: ${signal.isin}`, text,
          }, { idempotencyKey: `signal-${signal.id}-${Math.floor(Date.now() / (15 * 60000))}` });
          if (result.error) throw new Error('E-Mail-Anbieter hat die Nachricht nicht angenommen');
        }
      } catch (e) {
        // Never persist URLs/tokens or raw provider error objects.
        error = e instanceof Error && ['Telegram noch nicht eingerichtet', 'E-Mail noch nicht eingerichtet'].includes(e.message) ? e.message : 'Zustellung fehlgeschlagen; erneuter Versuch beim nächsten Prüflauf';
      }
      await changeState(async s => {
        const target = s.signals.find(x => x.id === signal.id);
        if (target) {
          const old = target.notification[channel];
          target.notification[channel] = error ? { ...old, error } : { sentAt: new Date().toISOString() };
          delete (target.notification as Record<string, unknown>)[leaseKey];
        }
        return { state: s, result: undefined };
      });
    }
  }
}
