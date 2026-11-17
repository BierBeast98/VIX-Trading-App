import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { telegramCall, TELEGRAM_CONNECTION_ID } from '@/lib/signals/telegram';
import { PAIRING_ID, type Pairing, hasSecret, privateChatForPairing } from '@/lib/signals/telegram-pairing';
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  const secret = (req.headers.get('authorization') ?? '').replace(/^Bearer /, '');
  let claimId: string | undefined;
  try {
    const row = await prisma.vixCache.findUnique({ where: { id: PAIRING_ID } });
    const pairing = row?.data as unknown as Pairing | undefined;
    if (!pairing || !hasSecret(secret, pairing.adminHash) || Date.parse(pairing.expiresAt) <= Date.now()) return NextResponse.json({ error: 'Verbindungsfreigabe fehlt oder ist abgelaufen' }, { status: 401 });
    if (pairing.status === 'completed') return NextResponse.json({ connected: true, username: pairing.expectedBot });
    const me = await telegramCall('getMe');
    if (!me?.is_bot || String(me.username).toLowerCase() !== pairing.expectedBot.toLowerCase()) throw new Error('Der hinterlegte Token gehört nicht zum vorgesehenen Bot');
    const webhook = await telegramCall('getWebhookInfo');
    if (webhook?.url) throw new Error('Der Bot wird bereits über einen Webhook verwendet; keine bestehende Verbindung überschrieben');
    const updates = await telegramCall('getUpdates', { timeout: 0, limit: 100, allowed_updates: ['message'] });
    const chatId = privateChatForPairing(updates, pairing);
    if (!chatId) return NextResponse.json({ connected: false, message: 'Bitte den persönlichen Verbindungslink öffnen und Starten tippen' }, { status: 202 });
    claimId = crypto.randomUUID();
    const claimed = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "VixCache" WHERE id = ${PAIRING_ID} FOR UPDATE`;
      const current = (await tx.vixCache.findUniqueOrThrow({ where: { id: PAIRING_ID } })).data as unknown as Pairing;
      if (current.adminHash !== pairing.adminHash || current.status === 'completed' || Date.parse(current.expiresAt) <= Date.now() || (current.status === 'connecting' && Date.now() - Date.parse(current.claimAt ?? '') < 60000)) return false;
      await tx.vixCache.update({ where: { id: PAIRING_ID }, data: { data: { ...current, status: 'connecting', claimAt: new Date().toISOString(), claimId } as unknown as Prisma.InputJsonValue } });
      return true;
    });
    if (!claimed) return NextResponse.json({ connected: false, message: 'Verbindungsprüfung läuft bereits' }, { status: 202 });
    await telegramCall('sendMessage', { chat_id: chatId, text: '✅ VIX Trading: Telegram ist verbunden. Dies ist eine Testnachricht, kein Handelssignal. Die Signalüberwachung bleibt bis zur Einrichtung von Brokerzeiten und Produkt pausiert.' });
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "VixCache" WHERE id = ${PAIRING_ID} FOR UPDATE`;
      const current = (await tx.vixCache.findUniqueOrThrow({ where: { id: PAIRING_ID } })).data as unknown as Pairing;
      if (current.claimId !== claimId) throw new Error('Verbindungsfreigabe wurde zwischenzeitlich geändert');
      const data = { chatId, botId: me.id, username: me.username, connectedAt: new Date().toISOString() };
      await tx.vixCache.upsert({ where: { id: TELEGRAM_CONNECTION_ID }, create: { id: TELEGRAM_CONNECTION_ID, data }, update: { data } });
      await tx.vixCache.update({ where: { id: PAIRING_ID }, data: { data: { ...current, status: 'completed' } as unknown as Prisma.InputJsonValue } });
    });
    return NextResponse.json({ connected: true, username: me.username });
  } catch (e) {
    if (claimId) await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "VixCache" WHERE id = ${PAIRING_ID} FOR UPDATE`;
      const row = await tx.vixCache.findUnique({ where: { id: PAIRING_ID } });
      const p = row?.data as unknown as Pairing;
      if (p?.claimId === claimId && p.status === 'connecting') await tx.vixCache.update({ where: { id: PAIRING_ID }, data: { data: { ...p, status: 'pending' } as unknown as Prisma.InputJsonValue } });
    }).catch(() => undefined);
    const known = e instanceof Error && ['Der hinterlegte Token gehört nicht zum vorgesehenen Bot', 'Der Bot wird bereits über einen Webhook verwendet; keine bestehende Verbindung überschrieben', 'Verbindungslink wurde von mehreren Chats geöffnet; bitte neue Verbindung starten', 'Telegram-Token fehlt auf dem Server', 'Telegram-Anfrage fehlgeschlagen; Token und Bot-Konfiguration prüfen'].includes(e.message);
    return NextResponse.json({ error: known ? (e as Error).message : 'Telegram-Verbindung konnte nicht abgeschlossen werden' }, { status: 503 });
  }
}
