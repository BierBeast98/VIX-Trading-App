import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { archiveRange } from './query';

export const DETAIL_RETENTION_DAYS = 60;
type Range = ReturnType<typeof archiveRange>;
type Counters = {
  calls: number;
  failed: number;
  bytes: number;
  durationMs: number;
  returnedPoints: number;
  insertedPoints: number;
};
export type DailyStats = Counters & {
  day: string;
  source: string;
  instrument: string;
  measurement: string;
};
const localDay = Prisma.sql`("startedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Berlin')::date`;

export async function compactMarketFetches(now: Date) {
  // Select by UTC storage timestamp, using an exact Berlin calendar-day boundary.
  // Deleting and adding counters happen in the same statement and transaction.
  await prisma.$executeRaw`
    WITH aged AS (
      SELECT id FROM "MarketFetch"
      WHERE "startedAt" < (
        ((${now.toISOString()}::timestamptz AT TIME ZONE 'Europe/Berlin')::date - ${DETAIL_RETENTION_DAYS}::int)::timestamp
        AT TIME ZONE 'Europe/Berlin' AT TIME ZONE 'UTC'
      )
      ORDER BY "startedAt", id LIMIT 2000 FOR UPDATE SKIP LOCKED
    ), moved AS (
      DELETE FROM "MarketFetch" f USING aged
      WHERE f.id = aged.id RETURNING f.*
    )
    INSERT INTO "MarketFetchDaily" (day, source, instrument, measurement, calls, failed, bytes, "durationMs", "returnedPoints", "insertedPoints")
    SELECT ${localDay}, source, instrument, measurement, COUNT(*), COUNT(*) FILTER (WHERE NOT success OR "errorCode" IS NOT NULL),
      COALESCE(SUM("responseBytes"), 0), SUM("durationMs"), SUM("returnedPoints"), SUM("insertedPoints")
    FROM moved GROUP BY 1, 2, 3, 4 ORDER BY 1, 2, 3, 4
    ON CONFLICT (day, source, instrument, measurement) DO UPDATE SET
      calls = "MarketFetchDaily".calls + EXCLUDED.calls,
      failed = "MarketFetchDaily".failed + EXCLUDED.failed,
      bytes = "MarketFetchDaily".bytes + EXCLUDED.bytes,
      "durationMs" = "MarketFetchDaily"."durationMs" + EXCLUDED."durationMs",
      "returnedPoints" = "MarketFetchDaily"."returnedPoints" + EXCLUDED."returnedPoints",
      "insertedPoints" = "MarketFetchDaily"."insertedPoints" + EXCLUDED."insertedPoints"
  `;
}

export async function marketFetchTotal(): Promise<number> {
  const [result] = await prisma.$queryRaw<{ calls: number }[]>`
    SELECT ((SELECT COUNT(*) FROM "MarketFetch") + (SELECT COALESCE(SUM(calls),0) FROM "MarketFetchDaily"))::float8 AS calls
  `;
  return result.calls;
}

export async function dailyMarketFetches(range: Range): Promise<DailyStats[]> {
  return prisma.$queryRaw<DailyStats[]>`
    WITH parts AS (
      SELECT ${localDay} AS day, source, instrument, measurement,
        COUNT(*) AS calls, COUNT(*) FILTER (WHERE NOT success OR "errorCode" IS NOT NULL) AS failed,
        COALESCE(SUM("responseBytes"), 0) AS bytes, SUM("durationMs") AS "durationMs",
        SUM("returnedPoints") AS "returnedPoints", SUM("insertedPoints") AS "insertedPoints"
      FROM "MarketFetch"
      WHERE "startedAt" BETWEEN (${range.from.toISOString()}::timestamptz AT TIME ZONE 'UTC')
        AND (${range.to.toISOString()}::timestamptz AT TIME ZONE 'UTC')
        AND (${range.source} = '' OR source = ${range.source})
        AND (${range.instrument} = '' OR instrument = ${range.instrument})
      GROUP BY 1, 2, 3, 4
      UNION ALL
      SELECT day, source, instrument, measurement, calls, failed, bytes, "durationMs", "returnedPoints", "insertedPoints"
      FROM "MarketFetchDaily"
      WHERE day BETWEEN (${range.from.toISOString()}::timestamptz AT TIME ZONE 'Europe/Berlin')::date
        AND (${range.to.toISOString()}::timestamptz AT TIME ZONE 'Europe/Berlin')::date
        AND (${range.source} = '' OR source = ${range.source})
        AND (${range.instrument} = '' OR instrument = ${range.instrument})
    )
    SELECT to_char(day, 'YYYY-MM-DD') AS day, source, instrument, measurement,
      SUM(calls)::float8 AS calls, SUM(failed)::float8 AS failed, SUM(bytes)::float8 AS bytes,
      SUM("durationMs")::float8 AS "durationMs", SUM("returnedPoints")::float8 AS "returnedPoints",
      SUM("insertedPoints")::float8 AS "insertedPoints"
    FROM parts GROUP BY 1, 2, 3, 4 ORDER BY 1 DESC, 2, 3, 4
  `;
}
