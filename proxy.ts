import { NextRequest, NextResponse } from 'next/server';
import { allowed, sameOrigin } from '@/lib/signals/auth';
import { limitBearer } from '@/lib/signals/rate-limit';

// These routes are called by independent schedulers or perform their own login.
const independent = new Set(['/api/signals/session', '/api/signals/check', '/api/archive/collect', '/api/alerts/check', '/api/telegram/connect']);
const publicPaths = new Set(['/api/vix/spot', '/api/calendar']);

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (independent.has(path)) return NextResponse.next();
  const publicRead = req.method === 'GET' && publicPaths.has(path);
  // VIX spot is public but offers a private feed to authorized bearer clients.
  if (!publicRead || path === '/api/vix/spot') {
    const blocked = await limitBearer(req);
    if (blocked) return blocked;
  }
  if (!publicRead && !allowed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !sameOrigin(req)) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }
  const response = NextResponse.next();
  if (!publicRead) response.headers.set('Cache-Control', 'no-store');
  return response;
}

export const config = { matcher: '/api/:path*' };
