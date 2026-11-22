import { NextRequest, NextResponse } from 'next/server';
import { allowed, sameOrigin } from '@/lib/signals/auth';
import { prisma } from '@/lib/prisma';
import { syncTelegramReceipts } from '@/lib/signals/telegram-inbox';

export async function POST(req: NextRequest) {
  if (!allowed(req) || !sameOrigin(req)) return new Response(null, { status: 401 });
  try {
    await syncTelegramReceipts();
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: 'Telegram-Belege konnten nicht abgerufen werden' }, { status: 503 }); }
}
export async function GET(req: NextRequest) {
  if (!allowed(req)) return new Response(null, { status: 401 });
  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!/^telegram-receipt:\d+:\d+:\d+$/.test(id)) return new Response(null, { status: 404 });
  const row = await prisma.vixCache.findUnique({ where: { id } });
  if (!row) return new Response(null, { status: 404 });
  const { type, content } = row.data as { type: string; content: string };
  return new Response(new Uint8Array(Buffer.from(content, 'base64')), { headers: {
    'Content-Type': type, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox",
  } });
}
