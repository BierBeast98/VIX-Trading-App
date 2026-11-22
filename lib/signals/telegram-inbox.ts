import { prisma } from '@/lib/prisma';
import { telegramChatId, telegramCall } from './telegram';
import { PAIRING_ID, type Pairing } from './telegram-pairing';
import { readPurchase } from './receipt-ocr';
import { handleSaleText } from './telegram-sale';
import { changeState } from './store';

type Photo = { file_id: string; file_size?: number };
type Update = { update_id: number; message?: {
  message_id: number; date: number; text?: string; chat: { id: number; type: string }; from?: { id: number; is_bot: boolean };
  reply_to_message?: { message_id: number }; photo?: Photo[]; document?: Photo & { mime_type: string };
} };
const maxBytes = 8 * 1024 * 1024;
export function receiptPhoto(update: Update, chat: string) {
  const m = update.message;
  if (!m || m.chat.type !== 'private' || String(m.chat.id) !== chat || m.from?.id !== m.chat.id || m.from.is_bot) return;
  const photo = m.photo?.filter(p => (p.file_size ?? 0) <= maxBytes).at(-1) ??
    (m.document && ['image/jpeg', 'image/png', 'image/webp'].includes(m.document.mime_type) ? m.document : undefined);
  if (photo?.file_id && (photo.file_size ?? 0) <= maxBytes) return photo.file_id;
}
export function imageType(bytes: Buffer) {
  if (bytes.subarray(0, 3).equals(Buffer.from([255,216,255]))) return 'image/jpeg';
  if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP') return 'image/webp';
}
async function importImage(fileId: string) {
  const file = await telegramCall('getFile', { file_id: fileId });
  if (!file.file_path || !Number.isSafeInteger(file.file_size) || file.file_size > maxBytes) return;
  const res = await fetch(`https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`,
    { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error('Belegabruf fehlgeschlagen');
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length !== file.file_size) throw new Error('Beleg unvollständig');
  const type = imageType(bytes);
  if (type) return { type, content: bytes.toString('base64') };
}
export async function syncTelegramReceipts() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  const chat = await telegramChatId();
  if (!chat) return;
  const pairing = await prisma.vixCache.findUnique({ where: { id: PAIRING_ID } });
  const pair = pairing?.data as unknown as Pairing | undefined;
  if (pair && pair.status !== 'completed' && Date.parse(pair.expiresAt) > Date.now()) return;
  const bot = token.split(':')[0];
  const cursorId = 'telegram_inbox_cursor:' + bot;
  const cursor = await prisma.vixCache.findUnique({ where: { id: cursorId } });
  const previous = typeof cursor?.data === 'number' ? cursor.data : 0;
  // Telegram may restart update IDs at a random value after a week without updates.
  const offset = cursor && Date.now() - cursor.updatedAt.getTime() < 6 * 86400000 ? previous : 0;
  const updates: Update[] = await telegramCall('getUpdates', { offset, limit: 20, timeout: 0, allowed_updates: ['message'] });
  for (const update of updates) {
    const sender = update.message;
    if (sender?.text && sender.chat.type === 'private' && String(sender.chat.id) === chat &&
        sender.from?.id === sender.chat.id && !sender.from.is_bot) {
      await handleSaleText(bot, chat, sender.text, sender.message_id, sender.date, sender.reply_to_message?.message_id);
    }
    const file = receiptPhoto(update, chat);
    if (!file) continue;
    const m = update.message!;
    const id = `telegram-receipt:${bot}:${chat}:${m.message_id}`;
    if (await prisma.vixCache.count({ where: { id } })) continue;
    const image = await importImage(file);
    if (!image) continue;
    const fields = await readPurchase(image.content).catch(() => undefined);
    await changeState(async (state, tx) => {
      const receipts = state.receipts ??= [];
      if (!receipts.some(r => r.id === id)) {
        const key = `${chat}:${m.reply_to_message?.message_id}`;
        const signal = state.signals.find(s => s.telegramMessages?.includes(key));
        const level = state.levels?.events.find(e => e.telegramMessage === key);
        await tx.vixCache.create({ data: { id, data: image } });
        receipts.unshift({ id, ...(fields && { fields }), at: new Date(m.date * 1000).toISOString(), ...(signal && { signalId: signal.id }), ...(level && { levelId: level.id }) });
      }
      return { state, result: undefined };
    });
  }
  const last = updates.at(-1);
  if (last) {
    // Compare and swap so overlapping polls cannot rewind a newer cursor.
    await prisma.vixCache.upsert({ where: { id: cursorId }, create: { id: cursorId, data: last.update_id + 1 }, update: {} });
    await prisma.vixCache.updateMany({ where: { id: cursorId, data: { equals: previous } }, data: { data: last.update_id + 1 } });
  }
}
