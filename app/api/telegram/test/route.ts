import { NextRequest, NextResponse } from 'next/server';
import { allowed, sameOrigin } from '@/lib/signals/auth';
import { telegramCall, telegramChatId } from '@/lib/signals/telegram';
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  if (!allowed(req) || !sameOrigin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  try {
    const chatId = await telegramChatId();
    if (!chatId) return NextResponse.json({ error: 'Telegram ist noch nicht verbunden.' }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
    await telegramCall('sendMessage', { chat_id: chatId, text: 'VIX Trading – Testnachricht. Die Telegram-Verbindung funktioniert. Dies ist kein Handelssignal.' });
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Testnachricht konnte nicht gesendet werden.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
}
