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
function signingSecret(): string | null {
  const secret = process.env.AUTH_SESSION_SECRET;
  return secret && Buffer.byteLength(secret) >= 32 ? secret : null;
}
function signature(expiry: string, secret: string) { return createHmac('sha256', secret).update(`dashboard-session:${expiry}`).digest('hex'); }
export function sessionCookie() {
  const secret = signingSecret();
  if (!secret) throw new Error('Session secret not configured');
  const expiry = String(Date.now() + 7 * 86400000);
  return `${expiry}.${signature(expiry, secret)}`;
}
export function allowed(req: NextRequest): boolean {
  const key = process.env.SIGNALS_ACCESS_KEY;
  if (key && same(req.headers.get('authorization') ?? '', `Bearer ${key}`)) return true;
  const secret = signingSecret();
  if (!secret) return false;
  const [expiry, sig, extra] = (req.cookies.get('signals_session')?.value ?? '').split('.');
  return !!expiry && /^\d{13}$/.test(expiry) && !!sig && !extra && Number(expiry) > Date.now() && same(sig, signature(expiry, secret));
}
/** Reuse the configured API access key for the single-user login. */
export async function verifyCredentials(email: unknown, password: unknown): Promise<boolean> {
  const configuredEmail = process.env.AUTH_EMAIL?.trim().toLowerCase();
  const key = process.env.SIGNALS_ACCESS_KEY;
  if (!configuredEmail || !key || !signingSecret() || typeof email !== 'string' || typeof password !== 'string' || email.length > 320 || Buffer.byteLength(password) > 1024) return false;
  return same(email.trim().toLowerCase(), configuredEmail) && same(password, key);
}
export function sameOrigin(req: NextRequest) {
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  return !origin || origin === new URL(req.url).origin ||
    (!!host && origin === `${new URL(req.url).protocol}//${host}`) ||
    (!!process.env.APP_URL && origin === new URL(process.env.APP_URL).origin);
}
