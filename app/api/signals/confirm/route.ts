import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { allowed, sameOrigin } from '@/lib/signals/auth';
import { recordFill } from '@/lib/signals/store';
const cashDetails = {
  taxWithheld: z.number().finite().nonnegative().nullable().optional(),
  note: z.string().max(1000).optional(),
};
const schema = z.discriminatedUnion('action', [
  z.object({ signalId: z.uuid(), action: z.enum(['execute', 'skip']),
    receipt: z.object({ id: z.string().regex(/^telegram-receipt:\d+:\d+:\d+$/), isin: z.string().regex(/^[A-Z]{2}[A-Z0-9]{9}\d$/) }).optional(),
    quantity: z.number().int().positive().max(100000000).optional(), price: z.number().finite().positive().optional(),
    fees: z.number().finite().nonnegative().optional(), at: z.iso.datetime({ offset: true }).optional(), ...cashDetails,
  }).strict(),
  z.object({ roundId: z.uuid(), action: z.literal('settle'), quantity: z.number().int().positive().max(100000000), proceeds: z.number().finite().nonnegative(),
    fees: z.number().finite().nonnegative(), at: z.iso.datetime({ offset: true }), ...cashDetails,
  }).strict(),
]);
export async function POST(req: NextRequest) {
  if (!allowed(req) || !sameOrigin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { const result = await recordFill(schema.parse(await req.json())); return NextResponse.json(result); }
  catch (e) { return NextResponse.json({ error: e instanceof z.ZodError ? 'Ausführungsdaten bitte prüfen' : e instanceof Error ? e.message : 'Bestätigung fehlgeschlagen' }, { status: 400 }); }
}
