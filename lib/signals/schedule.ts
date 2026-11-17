import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { same } from './auth';
export const MONITOR_CRON_ID = 'signal_monitor_cron_v1';
type MonitorCron = { tokenHash?: string; enabled?: boolean; intervalMinutes?: number; jobUid?: string;
  installedAt?: string; lastAttemptAt?: string; lastCompletedAt?: string; lastResult?: string; lastErrorAt?: string };
/** Dedicated credential only permits GET /api/signals/check, never administration or trade confirmation. */
export async function monitorCronAllowed(req: NextRequest): Promise<boolean> {
  const header = req.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) return false;
  const token = header.slice(7);
  if (token.length < 32 || token.length > 256) return false;
  try {
    const row = await prisma.vixCache.findUnique({ where: { id: MONITOR_CRON_ID } });
    const config = row?.data as MonitorCron | null;
    return config?.enabled === true && typeof config.tokenHash === 'string' && /^[a-f0-9]{64}$/.test(config.tokenHash) &&
      same(createHash('sha256').update(token).digest('hex'), config.tokenHash);
  } catch { return false; }
}
export async function recordMonitorRun(startedAt: string, checked: boolean, error = false): Promise<void> {
  try {
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "VixCache" WHERE id = ${MONITOR_CRON_ID} FOR UPDATE`;
      const row = await tx.vixCache.findUnique({ where: { id: MONITOR_CRON_ID } });
      if (!row) return;
      const previous = row.data as MonitorCron;
      const at = new Date().toISOString();
      await tx.vixCache.update({ where: { id: MONITOR_CRON_ID }, data: { data: {
        ...previous, lastAttemptAt: startedAt, lastResult: error ? 'error' : checked ? 'checked' : 'skipped',
        ...(error ? { lastErrorAt: at } : { lastCompletedAt: at }),
      } as Prisma.InputJsonValue } });
    });
  } catch { console.error('[signal-monitor] Could not persist scheduled-run status'); }
}
