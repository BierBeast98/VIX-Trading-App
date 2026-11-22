import { NextRequest, NextResponse } from 'next/server';
import { allowed, sameOrigin } from '@/lib/signals/auth';
import { telegramCall, telegramChatId } from '@/lib/signals/telegram';
import { signalText } from '@/lib/signals/notify';
import { isTelegramTest, telegramTestSignal } from '@/lib/signals/telegram-tests';
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  if (!allowed(req) || !sameOrigin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  const body = req.body ? await req.json().catch(() => null) : undefined;
  if (body !== undefined && !isTelegramTest(body?.scenario)) {
    return NextResponse.json({ error: 'Unbekanntes Telegram-Testszenario.' }, { status: 400 });
  }
  try {
    const chatId = await telegramChatId();
    if (!chatId) return NextResponse.json({ error: 'Telegram ist noch nicht verbunden.' }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
    const text = body === undefined
      ? 'VIX Trading – Testnachricht. Die Telegram-Verbindung funktioniert. Dies ist kein Handelssignal.'
      : signalText(telegramTestSignal(body.scenario, new Date()), false, true);
    await telegramCall('sendMessage', { chat_id: chatId, text, link_preview_options: { is_disabled: true } });
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Testnachricht konnte nicht gesendet werden.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
}
