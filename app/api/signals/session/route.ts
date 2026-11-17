import { NextRequest, NextResponse } from 'next/server';
import { same, sameOrigin, sessionCookie } from '@/lib/signals/auth';
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Ungültiger Ursprung' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const key = process.env.SIGNALS_ACCESS_KEY;
  if (!key || typeof body.key !== 'string' || !same(body.key, key)) return NextResponse.json({ error: 'Zugangsschlüssel fehlt oder ist ungültig' }, { status: 401 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set('signals_session', sessionCookie(), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/api', maxAge: 7 * 86400 });
  return response;
}
