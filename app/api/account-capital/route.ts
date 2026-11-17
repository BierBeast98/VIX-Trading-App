import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { capitalSummary, type CapitalBaseline } from '@/lib/capital';
import type { State } from '@/lib/signals/engine';
import { allowed } from '@/lib/signals/auth';

export async function GET() {
  try {
    const rows = await prisma.vixCache.findMany({ where: { id: { in: ['account_capital', 'manual_strategy_v1'] } } });
    const baseline = rows.find(r => r.id === 'account_capital')?.data as CapitalBaseline | undefined;
    const state = rows.find(r => r.id === 'manual_strategy_v1')?.data as unknown as State | undefined;
    return NextResponse.json(capitalSummary(baseline ?? null, state ?? null), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    console.error('[account-capital] Read failed');
    return NextResponse.json({ error: 'Kapitaldaten konnten nicht geladen werden' }, { status: 503 });
  }
}
// Baseline changes require an explicit reconciliation, rather than overwriting a live ledger.
export async function PUT(req: NextRequest) {
  if (!allowed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ error: 'Kapitaländerungen müssen mit den bestätigten Ausführungen abgestimmt werden.' }, { status: 409 });
}
