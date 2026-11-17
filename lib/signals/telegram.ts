import { prisma } from '@/lib/prisma';
export const TELEGRAM_CONNECTION_ID = 'telegram_connection_v1';
export type TelegramConnection = { chatId: string; botId: number; username: string; connectedAt: string };
export async function telegramChatId(): Promise<string | null> {
  if (process.env.TELEGRAM_CHAT_ID) return process.env.TELEGRAM_CHAT_ID;
  const row = await prisma.vixCache.findUnique({ where: { id: TELEGRAM_CONNECTION_ID } });
  const data = row?.data as Partial<TelegramConnection> | undefined;
  return typeof data?.chatId === 'string' && /^\d+$/.test(data.chatId) ? data.chatId : null;
}
/** Token is sent only to Telegram; provider errors never contain request URLs in our output. */
export async function telegramCall(method: string, body: Record<string, unknown> = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('Telegram-Token fehlt auf dem Server');
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      cache: 'no-store', signal: AbortSignal.timeout(10000),
    });
    const data = await response.json();
    if (!response.ok || data.ok !== true) throw new Error('provider rejected request');
    return data.result;
  } catch { throw new Error('Telegram-Anfrage fehlgeschlagen; Token und Bot-Konfiguration prüfen'); }
}
