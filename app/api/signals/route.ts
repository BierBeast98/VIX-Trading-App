import { telegramChatId } from '@/lib/signals/telegram';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { allowed, sameOrigin } from '@/lib/signals/auth';
import { changeState, readState } from '@/lib/signals/store';
import { prisma } from '@/lib/prisma';
export const dynamic = 'force-dynamic';
const configSchema = z.object({
  enabled: z.boolean(), capital: z.number().finite().min(1).max(100000000),
  variant: z.enum(['A', 'B', 'C']), leverage: z.union([z.literal(1.5), z.literal(1.9), z.literal(2), z.literal(2.3)]),
  isin: z.union([z.literal(''), z.string().regex(/^[A-Z]{2}[A-Z0-9]{10}$/)]), wkn: z.string().max(12),
  futureSymbol: z.string().max(30), futureName: z.string().max(160),
  futureExpiry: z.union([z.literal(''), z.iso.date()]), productVerified: z.boolean(),
  barrier: z.number().finite().min(0).max(1000), email: z.boolean(), telegram: z.boolean(),
  broker: z.string().max(100), opensAt: z.union([z.literal(''), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)]),
  closesAt: z.union([z.literal(''), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)]),
  closedDates: z.array(z.iso.date()).max(400),
}).strict();
export async function GET(req: NextRequest) {
  if (!allowed(req)) return NextResponse.json({ error: 'Bitte Signalbereich entsperren', configured: !!process.env.SIGNALS_ACCESS_KEY }, { status: 401 });
  try {
    const [state, settings] = await Promise.all([readState(), prisma.settings.findUnique({ where: { id: 1 } })]);
    return NextResponse.json({ ...state, channels: {
      telegram: !!process.env.TELEGRAM_BOT_TOKEN && !!(await telegramChatId()),
      email: !!process.env.RESEND_API_KEY && !!settings?.alertEmail,
      links: !!process.env.APP_URL,
    } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Signalzustand konnte nicht geladen werden' }, { status: 503 }); }
}
export async function PUT(req: NextRequest) {
  if (!allowed(req) || !sameOrigin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const config = configSchema.parse(await req.json());
    if (config.enabled && (!config.broker || !config.opensAt || !config.closesAt || config.opensAt >= config.closesAt || !config.productVerified || !config.isin || !config.futureSymbol || !config.futureExpiry || !config.futureName || config.barrier <= 0 || (!config.email && !config.telegram))) throw new Error('Brokerzeiten, geprüftes Long-Produkt, VX-Basisvertrag und mindestens einen Versandkanal einrichten');
    const result = await changeState(async state => {
      const locked = state.round || state.signals.some(s => s.status === 'pending');
      const keys = ['capital', 'variant', 'leverage', 'isin', 'wkn', 'futureSymbol', 'futureName', 'futureExpiry', 'productVerified', 'barrier'] as const;
      if (locked && keys.some(k => config[k] !== state.config[k])) throw new Error('Strategie und Produkt sind bei offener Runde oder offenem Signal gesperrt');
      if (state.config.enabled !== config.enabled) { state.previousVix = null; state.previousVixAt = null; state.armed = false; }
      state.config = config;
      state.health = config.enabled ? 'Bereit für nächsten serverseitigen Prüflauf' : 'Überwachung pausiert';
      return { state, result: state };
    });
    return NextResponse.json(result);
  } catch (e) { return NextResponse.json({ error: e instanceof z.ZodError ? 'Eingaben bitte prüfen' : e instanceof Error ? e.message : 'Speichern fehlgeschlagen' }, { status: 400 }); }
}
