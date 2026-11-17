import { timingSafeEqual, createHmac } from 'node:crypto';
import type { NextRequest } from 'next/server';
export function same(a: string, b: string): boolean {
  const x = Buffer.from(a); const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function cronAllowed(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return !!secret && same(req.headers.get('authorization') ?? '', `Bearer ${secret}`);
}
function signature(expiry: string) { return createHmac('sha256', process.env.SIGNALS_ACCESS_KEY!).update(`signals:${expiry}`).digest('hex'); }
export function sessionCookie() {
  const expiry = String(Date.now() + 7 * 86400000);
  return `${expiry}.${signature(expiry)}`;
}
export function allowed(req: NextRequest): boolean {
  const key = process.env.SIGNALS_ACCESS_KEY;
  if (!key) return false;
  if (same(req.headers.get('authorization') ?? '', `Bearer ${key}`)) return true;
  const [expiry, sig] = (req.cookies.get('signals_session')?.value ?? '').split('.');
  return !!expiry && !!sig && Number(expiry) > Date.now() && same(sig, signature(expiry));
}
export function sameOrigin(req: NextRequest) {
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  return !origin || origin === new URL(req.url).origin ||
    (!!host && origin === `${new URL(req.url).protocol}//${host}`) ||
    (!!process.env.APP_URL && origin === new URL(process.env.APP_URL).origin);
}
