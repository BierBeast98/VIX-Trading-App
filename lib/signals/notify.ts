import { telegramChatId } from './telegram';
import { Resend } from 'resend';
import { readState, changeState } from './store';
import { marketOpen, fresh, type Signal } from './engine';
const eur = (n: number) => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
export function signalText(s: Signal, reminder = false) {
  return [reminder ? 'Erinnerung: Ausführung noch nicht erfasst' : (s.side === 'buy' ? 'KAUFSIGNAL' : 'VERKAUFSSIGNAL'),
    s.reason, `ISIN: ${s.isin}`, `Rundenbudget: ${eur(s.capital)}`,
    s.side === 'buy' ? `Zielquote: ${s.targetPct} % · zusätzlicher Betrag bis ${eur(s.budget)} inkl. Gebühren` : 'Verkauf der angegebenen Stückzahl',
    `${s.quantity} Stück · ${s.side === 'buy' ? 'Briefkurs' : 'Geldkurs'} bei Signal: ${eur(s.price)}`,
    `Kurszeit: ${new Date(s.quoteAt).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}`,
    s.side === 'buy' ? `Kaufsignal gültig bis ${new Date(s.expiresAt).toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin' })}; Gebühren bei Stückzahl berücksichtigen.` : 'Verkaufssignal bleibt bis zur Bestätigung offen. Aktuellen Kurs vor der Order prüfen.',
    'Order selbst beim Broker aufgeben. Danach Screenshot senden oder Ausführung in der App erfassen.',
    process.env.APP_URL ? `${process.env.APP_URL.replace(/\/$/, '')}/signals#${s.id}` : '',
  ].filter(Boolean).join('\n');
}
/** Per-channel receipts: failures retry; successful channels are not resent until reminder due. */
export async function deliverSignals() {
  const state = await readState(); const now = new Date();
  if (!state.config.enabled || !marketOpen(state.config, now)) return;
  if (!state.quote || !fresh(state.quote.productAt, now)) return;
  for (const signal of state.signals.filter(s => s.status === 'pending')) {
    if (signal.side === 'buy' && (!fresh(state.quote.vixAt, now) || !fresh(state.quote.futureAt, now) || Date.parse(signal.expiresAt) < now.getTime())) continue;
    for (const channel of ['telegram', 'email'] as const) {
      if (!state.config[channel]) continue;
      const leaseKey = `${channel}:lease`;
      const claimed = await changeState(async s => {
        const target = s.signals.find(x => x.id === signal.id);
        if (!s.config.enabled || !marketOpen(s.config, new Date()) || target?.status !== 'pending') return { state: s, result: null };
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
