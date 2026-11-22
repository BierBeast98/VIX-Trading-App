import { Resend } from 'resend';
import { prisma } from '@/lib/prisma';
import { telegramChatId } from './telegram';
import { readState, changeState } from './store';
import { marketOpen } from './engine';
import { levelText } from './levels';
/** Serialized claims and per-channel receipts prevent overlapping jobs from sending twice. */
export async function deliverLevels() {
  const snapshot = await readState();
  for (const event of snapshot.levels?.events ?? []) {
    if (Date.now() - Date.parse(event.at) > 30 * 60000) continue;
    for (const channel of ['telegram', 'email'] as const) {
      const claimed = await changeState(async state => {
        const target = state.levels?.events.find(e => e.id === event.id);
        const receipt = target?.notification[channel];
        if (!target || !state.config.enabled || !state.config[channel] || !marketOpen(state.config, new Date()) ||
          Date.now() - Date.parse(target.at) > 30 * 60000 || receipt?.sentAt ||
          (receipt?.leaseAt && Date.now() - Date.parse(receipt.leaseAt) < 120000)) return { state, result: null };
        target.notification[channel] = { ...receipt, leaseAt: new Date().toISOString() };
        return { state, result: target };
      });
      if (!claimed) continue;
      let error: string | undefined;
      let telegramMessage: string | undefined;
      try {
        const text = levelText(claimed);
        if (channel === 'telegram') {
          const token = process.env.TELEGRAM_BOT_TOKEN, chatId = await telegramChatId();
          if (!token || !chatId) throw new Error('not configured');
          const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text, link_preview_options: { is_disabled: true } }),
            signal: AbortSignal.timeout(10000),
          });
          const result = await response.json();
          if (Number.isSafeInteger(result.result?.message_id)) telegramMessage = `${chatId}:${result.result.message_id}`;
          if (!response.ok || !result.ok) throw new Error('delivery failed');
        } else {
          const settings = await prisma.settings.findUnique({ where: { id: 1 } });
          if (!settings?.alertEmail || !process.env.RESEND_API_KEY) throw new Error('not configured');
          const response = await new Resend(process.env.RESEND_API_KEY).emails.send({
            from: process.env.ALERT_FROM_EMAIL || 'VIX Trading <onboarding@resend.dev>', to: settings.alertEmail,
            subject: 'VIX-Einstiegsniveau erreicht', text,
          }, { idempotencyKey: `vix-level-${claimed.id}` });
          if (response.error) throw new Error('delivery failed');
        }
      } catch { error = 'Zustellung fehlgeschlagen; erneuter Versuch innerhalb von 30 Minuten'; }
      await changeState(async state => {
        const target = state.levels?.events.find(e => e.id === event.id);
        if (target && telegramMessage && !error) target.telegramMessage = telegramMessage;
        if (target) target.notification[channel] = error ? { error } : { sentAt: new Date().toISOString() };
        return { state, result: undefined };
      });
    }
  }
}
