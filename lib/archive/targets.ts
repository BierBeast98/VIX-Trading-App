import { prisma } from '@/lib/prisma';
import { readState } from '@/lib/signals/store';
import { eligibleArchiveTarget, verifiedArchiveTarget, type ArchiveTarget } from './strategy-samples';

export async function strategyArchiveTargets(): Promise<ArchiveTarget[]> {
  const [state, positions, trades] = await Promise.all([
    readState(),
    prisma.position.findMany({
      where: { status: 'open', OR: [{ trades: { none: {} } }, { trades: { some: { exitDate: null } } }] },
      distinct: ['certificateId'], select: { certificateId: true },
    }),
    prisma.trade.findMany({
      where: { exitDate: null, positionId: null }, distinct: ['certificateId'], select: { certificateId: true },
    }),
  ]);
  const candidates = [state.config];
  if (state.round?.lots.some(lot => lot.quantity > 0)) candidates.unshift(state.round.config);
  const targets = new Map<string, ArchiveTarget>();
  for (const candidate of candidates) {
    if (verifiedArchiveTarget(candidate) && !targets.has(candidate.isin)) targets.set(candidate.isin, candidate);
  }
  for (const row of [...positions, ...trades]) {
    const isin = row.certificateId.trim().toUpperCase();
    const target = { isin, held: true } as const;
    if (!targets.has(isin) && eligibleArchiveTarget(target)) targets.set(isin, target);
  }
  return [...targets.values()];
}
