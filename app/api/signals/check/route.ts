import { NextRequest, NextResponse } from 'next/server';
import { allowed, cronAllowed, sameOrigin } from '@/lib/signals/auth';
import { monitorCronAllowed, recordMonitorRun } from '@/lib/signals/schedule';
import { syncTelegramReceipts } from '@/lib/signals/telegram-inbox';
import { runSignalsCheck } from '@/lib/signals/service';
import { limitBearer } from '@/lib/signals/rate-limit';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;
export async function GET(req: NextRequest) {
  if (!cronAllowed(req) && !await monitorCronAllowed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return run(true);
}
export async function POST(req: NextRequest) {
  const blocked = await limitBearer(req);
  if (blocked) return blocked;
  if (!allowed(req) || !sameOrigin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return run();
}
async function run(scheduled = false) {
  const startedAt = new Date().toISOString();
  try {
    const [result, receiptsSynced] = await Promise.all([runSignalsCheck(), syncTelegramReceipts().then(() => true, () => false)]);
    if (scheduled) await recordMonitorRun(startedAt, result.checked);
    return NextResponse.json({ ...result, receiptsSynced }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    if (scheduled) await recordMonitorRun(startedAt, false, true);
    return NextResponse.json({ error: 'Signalprüfung fehlgeschlagen; keine Ausführung gebucht' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
