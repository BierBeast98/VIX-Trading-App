import { prisma } from '@/lib/prisma';
import { NextResponse, type NextRequest } from 'next/server';

type Bucket = 'login' | 'bearer';
export type AttemptResult = 'allowed' | 'limited' | 'unavailable';
const LIMITS: Record<Bucket, number> = { login: 8, bearer: 120 };
const WINDOW_MS = 15 * 60 * 1000;

/** One row per global bucket. PostgreSQL serializes the upsert across all app processes.
 * Counts attempts before checking credentials so simultaneous guesses cannot race past the limit.
 * Uses the database clock and a fixed window, without trusting client-provided IP headers.
 */
export async function consumeAuthAttempt(bucket: Bucket): Promise<AttemptResult> {
  try {
    const id = `auth_rate_limit_v1:${bucket}`;
    const rows = await prisma.$queryRaw<Array<{ count: number }>>`
      INSERT INTO "VixCache" ("id", "data", "updatedAt")
      VALUES (${id}, jsonb_build_object('windowStart', (extract(epoch from clock_timestamp()) * 1000)::bigint, 'count', 1), clock_timestamp())
      ON CONFLICT ("id") DO UPDATE SET
        "data" = CASE
          WHEN COALESCE(("VixCache"."data"->>'windowStart')::bigint, 0) <= (extract(epoch from clock_timestamp()) * 1000)::bigint - ${WINDOW_MS}
          THEN jsonb_build_object('windowStart', (extract(epoch from clock_timestamp()) * 1000)::bigint, 'count', 1)
          ELSE jsonb_set("VixCache"."data", '{count}', to_jsonb(LEAST(COALESCE(("VixCache"."data"->>'count')::integer, 0) + 1, 1000000)))
        END,
        "updatedAt" = clock_timestamp()
      RETURNING ("data"->>'count')::integer AS "count"`;
    const count = rows[0]?.count;
    return Number.isInteger(count) && count > 0 ? (count <= LIMITS[bucket] ? 'allowed' : 'limited') : 'unavailable';
  } catch {
    // Do not leak SQL, credentials, or infrastructure details; fail closed on storage failure.
    console.error('[auth] rate limit unavailable');
    return 'unavailable';
  }
}
export function limitResponse(result: Exclude<AttemptResult, 'allowed'>) {
  return NextResponse.json({ error: result === 'limited' ? 'Zu viele Zugriffsversuche. Bitte später erneut versuchen.' : 'Zugriff vorübergehend nicht verfügbar.' }, {
    status: result === 'limited' ? 429 : 503,
    headers: { 'Cache-Control': 'no-store', ...(result === 'limited' ? { 'Retry-After': String(WINDOW_MS / 1000) } : {}) },
  });
}
/** Only bearer-bearing requests need this gate; signed cookie sessions are unaffected. */
export async function limitBearer(req: NextRequest): Promise<NextResponse | null> {
  if (!req.headers.has('authorization')) return null;
  const result = await consumeAuthAttempt('bearer');
  return result === 'allowed' ? null : limitResponse(result);
}
