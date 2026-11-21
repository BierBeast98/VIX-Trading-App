import { NextRequest, NextResponse } from 'next/server';
import { sameOrigin, sessionCookie, verifyCredentials } from '@/lib/signals/auth';
import { consumeAuthAttempt, limitResponse } from '@/lib/signals/rate-limit';

const MAX_BODY_BYTES = 4096;
async function readSmallJson(req: NextRequest): Promise<unknown> {
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (!Number.isFinite(declared) || declared < 0 || declared > MAX_BODY_BYTES) throw new Error('body too large');
  const reader = req.body?.getReader();
  if (!reader) return {};
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) { await reader.cancel(); throw new Error('body too large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Ungültiger Ursprung' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  const attempt = await consumeAuthAttempt('login');
  if (attempt !== 'allowed') return limitResponse(attempt);
  let body: { email?: unknown; password?: unknown };
  try { body = await readSmallJson(req) as typeof body; }
  catch { return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400, headers: { 'Cache-Control': 'no-store' } }); }
  if (!await verifyCredentials(body?.email, body?.password)) return NextResponse.json({ error: 'E-Mail oder Passwort ungültig oder Anmeldung nicht eingerichtet' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  response.cookies.set('signals_session', sessionCookie(), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/api', maxAge: 7 * 86400 });
  return response;
}
