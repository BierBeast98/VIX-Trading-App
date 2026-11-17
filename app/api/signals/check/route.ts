import { NextRequest, NextResponse } from 'next/server';
import { allowed, cronAllowed, sameOrigin } from '@/lib/signals/auth';
import { monitorCronAllowed, recordMonitorRun } from '@/lib/signals/schedule';
import { runSignalsCheck } from '@/lib/signals/service';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;
export async function GET(req: NextRequest) {
  if (!cronAllowed(req) && !await monitorCronAllowed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return run(true);
}
export async function POST(req: NextRequest) {
  if (!allowed(req) || !sameOrigin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return run();
}
async function run(scheduled = false) {
  const startedAt = new Date().toISOString();
  try {
    const result = await runSignalsCheck();
    if (scheduled) await recordMonitorRun(startedAt, result.checked);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    if (scheduled) await recordMonitorRun(startedAt, false, true);
    return NextResponse.json({ error: 'Signalprüfung fehlgeschlagen; keine Ausführung gebucht' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
