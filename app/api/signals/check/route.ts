import { NextRequest, NextResponse } from 'next/server';
import { allowed, cronAllowed, sameOrigin } from '@/lib/signals/auth';
import { runSignalsCheck } from '@/lib/signals/service';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  if (!cronAllowed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return run();
}
export async function POST(req: NextRequest) {
  if (!allowed(req) || !sameOrigin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return run();
}
async function run() {
  try { return NextResponse.json(await runSignalsCheck()); }
  catch { return NextResponse.json({ error: 'Signalprüfung fehlgeschlagen; keine Ausführung gebucht' }, { status: 503 }); }
}
