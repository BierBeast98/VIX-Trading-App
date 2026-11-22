import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { allowed } from '@/lib/signals/auth';
import { archiveConfig } from '@/lib/archive/config';
import { archiveRange } from '@/lib/archive/query';
import { persistenceError } from '@/lib/archive/capture';
import { dailyMarketFetches, DETAIL_RETENTION_DAYS, marketFetchTotal } from '@/lib/archive/retention';
import { strategyArchiveTargets } from '@/lib/archive/targets';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!allowed(req)) {
    return NextResponse.json({ error: 'Bitte Archivbereich entsperren', configured: !!process.env.SIGNALS_ACCESS_KEY }, { status: 401 });
  }
  try {
    const r = archiveRange(req.nextUrl.searchParams);
    const pointsWhere = {
      receivedAt: { gte: r.from, lte: r.to },
      ...(r.instrument ? { instrument: r.instrument } : {}),
      ...(r.source ? { source: r.source } : {}),
    };
    const [config, targets, totalPoints, totalFetches, points, quality, streams, fetches, lastRuns, changes, storage] = await Promise.all([
      archiveConfig(),
      strategyArchiveTargets(),
      prisma.marketObservation.count(),
      marketFetchTotal(),
      prisma.marketObservation.count({ where: pointsWhere }),
      prisma.marketObservation.groupBy({ by: ['quality'], where: pointsWhere, _count: { _all: true } }),
      prisma.marketObservation.groupBy({
        by: ['source', 'instrument', 'kind', 'contract'], where: pointsWhere, _count: { _all: true },
        _min: { sourceAt: true, receivedAt: true }, _max: { sourceAt: true, receivedAt: true }, orderBy: { instrument: 'asc' },
      }),
      dailyMarketFetches(r),
      prisma.marketCollectionRun.findMany({ orderBy: { startedAt: 'desc' }, take: 8 }),
      prisma.marketObservation.findMany({
        where: { ...pointsWhere, kind: 'strategy_product_status' }, orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
        take: 12, select: { id: true, isin: true, receivedAt: true, metadata: true },
      }),
      prisma.$queryRaw<{ bytes: number }[]>`
        SELECT (pg_total_relation_size('"MarketObservation"') + pg_total_relation_size('"MarketFetch"') +
          pg_total_relation_size('"MarketCollectionRun"') + pg_total_relation_size('"MarketFetchDaily"'))::float8 AS bytes
      `,
    ]);
    const totals = { requests: 0, failed: 0, sdkCalls: 0, httpCalls: 0, responseBytes: 0, returnedPoints: 0, insertedPoints: 0, durationMs: 0 };
    const days = new Map<string, { day: string; calls: number; failed: number; bytes: number }>();
    for (const row of fetches) {
      totals.requests += row.calls;
      totals.failed += row.failed;
      totals.sdkCalls += row.measurement === 'sdk_call' ? row.calls : 0;
      totals.httpCalls += row.measurement === 'http_request' ? row.calls : 0;
      totals.responseBytes += row.bytes;
      totals.returnedPoints += row.returnedPoints;
      totals.insertedPoints += row.insertedPoints;
      totals.durationMs += row.durationMs;
      const day = days.get(row.day) ?? { day: row.day, calls: 0, failed: 0, bytes: 0 };
      days.set(row.day, { day: row.day, calls: day.calls + row.calls, failed: day.failed + row.failed, bytes: day.bytes + row.bytes });
    }

    const { tokenHash: _, ...publicConfig } = config;
    void _;
    return NextResponse.json({
      config: { ...publicConfig, isins: targets.map(target => target.isin) },
      totalPoints, totalFetches, points, quality, ...totals,
      averageMs: totals.requests ? totals.durationMs / totals.requests : 0,
      streams, daily: [...days.values()].slice(0, 366), lastRuns, storageBytes: storage[0]?.bytes ?? 0,
      productChanges: changes.map(change => ({ ...change, id: String(change.id) })),
      persistenceErrorAt: persistenceError(), from: r.from, to: r.to,
      measurementNote: 'Gezählt werden direkte Massive- und Vontobel-Aufrufe sowie Yahoo-SDK-Aufrufe. Antwortgrößen beziehen sich auf die dekomprimierten Daten direkter Abrufe.',
      retentionNote: `Kursdaten und Produktstatus bleiben langfristig gespeichert. Nach ${DETAIL_RETENTION_DAYS} Tagen bleiben von technischen Einzelabrufen die Tagesstatistiken erhalten.`,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Archivdaten konnten nicht geladen werden. Datenbankeinrichtung und Filter prüfen.' }, { status: 503 });
  }
}
