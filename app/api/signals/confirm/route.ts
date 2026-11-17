import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { allowed, sameOrigin } from '@/lib/signals/auth';
import { recordFill } from '@/lib/signals/store';
const schema = z.object({ signalId: z.uuid(), action: z.enum(['execute', 'skip']),
  quantity: z.number().int().positive().max(100000000).optional(), price: z.number().finite().positive().optional(),
  fees: z.number().finite().min(0).optional(), at: z.iso.datetime({ offset: true }).optional(), note: z.string().max(1000).optional(),
}).strict();
export async function POST(req: NextRequest) {
  if (!allowed(req) || !sameOrigin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { const result = await recordFill(schema.parse(await req.json())); return NextResponse.json(result); }
  catch (e) { return NextResponse.json({ error: e instanceof z.ZodError ? 'Ausführungsdaten bitte prüfen' : e instanceof Error ? e.message : 'Bestätigung fehlgeschlagen' }, { status: 400 }); }
}
