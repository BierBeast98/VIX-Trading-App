// Run only against the disposable local DB described in docs/SIGNALS.md.
const { test } = require('node:test');
const assert = require('node:assert/strict');
if (!/^postgresql:\/\/[^/]*@127\.0\.0\.1:55439\/vix_signals_test$/.test(process.env.DATABASE_URL ?? '')) throw new Error('Refusing integration test outside disposable local test DB');
require('./load-ts.cjs');
const { prisma } = require('../lib/prisma.ts');
const { initialState, evaluate } = require('../lib/signals/engine.ts');
const { changeState, readState, recordFill } = require('../lib/signals/store.ts');
const now = new Date('2026-10-19T15:00:00Z');
const config = { enabled: true, capital: 10000, variant: 'B', leverage: 2.3, isin: 'DE000TEST0001', wkn: '', futureSymbol: 'UXG7', futureName: 'VX Feb 2027', futureExpiry: '2027-02-17', productVerified: true, barrier: 5, email: true, telegram: true, broker: 'Test', opensAt: '08:00', closesAt: '22:00', closedDates: [] };
const quote = (vix, at, bid = 10) => ({ isin: config.isin, at: at.toISOString(), vix, vixRealtime:true,vixAt: at.toISOString(), future: vix * 1.1, futureAt: at.toISOString(), bid, ask: 10, productAt: at.toISOString(), askAt: at.toISOString(), productValid: true });
test('transactional fills, concurrent retries, trade/position sync and rollback', async () => {
  try {
    await prisma.trade.deleteMany(); await prisma.position.deleteMany(); await prisma.vixCache.deleteMany();
    let s = initialState(); s.config = config;
    const early = new Date(now.getTime() - 60000);
    s = evaluate(evaluate(s, quote(16, early), early), quote(15, now), now);
    const buyId = s.signals[0].id;
    await changeState(async () => ({ state: s, result: undefined }));
    const fill = { signalId: buyId, action: 'execute', quantity: 299, price: 10, fees: 5, at: now.toISOString(), note: 'Testbeleg' };
    await Promise.all([recordFill(fill), recordFill(fill)]);
    s = await readState(); assert.equal(s.executions.length, 1); assert.equal(await prisma.trade.count(), 1); assert.equal(await prisma.position.count(), 1);
    assert.ok(s.round.lots[0].tradeId); assert.ok(s.round.lots[0].positionId);
    const later = new Date('2026-10-29T15:00:00Z');
    // Engine clock is injected; confirmation clock is real. Use a past local date for DB fills.
    s = evaluate(s, quote(15, later, 9.5), later);
    s.signals[0].at = '2026-10-19T15:00:00Z';
    const sellId = s.signals[0].id;
    await changeState(async () => ({ state: s, result: undefined }));
    await recordFill({ signalId: sellId, action: 'execute', quantity: 239, price: 9.5, fees: 5, at: now.toISOString() });
    s = await readState(); assert.equal(s.round.lots[0].quantity, 60);
    assert.equal(await prisma.trade.count({ where: { exitDate: null } }), 1);
    assert.equal(await prisma.trade.count({ where: { exitDate: { not: null } } }), 1);
    assert.equal((await prisma.trade.findUnique({ where: { id: s.round.lots[0].tradeId } })).quantity, 60);
    assert.equal(await prisma.position.count({ where: { status: 'open' } }), 1);
    const end = new Date('2026-11-09T15:00:00Z'); s = evaluate(s, quote(15, end, 9.5), end); s.signals[0].at = now.toISOString();
    await changeState(async () => ({ state: s, result: undefined }));
    const finalId = s.signals[0].id;
    // Simulate a DB-side missing record: no partial state is committed.
    const tradeId = s.round.lots[0].tradeId;
    const savedTrade = await prisma.trade.findUnique({ where: { id: tradeId } });
    await prisma.trade.delete({ where: { id: tradeId } });
    await assert.rejects(recordFill({ signalId: finalId, action: 'execute', quantity: 60, price: 9.5, fees: 0, at: now.toISOString() }));
    assert.equal((await readState()).executions.length, 2);
    await prisma.trade.create({ data: savedTrade });
    await recordFill({ signalId: finalId, action: 'execute', quantity: 60, price: 9.5, fees: 0, at: now.toISOString() });
    s = await readState(); assert.equal(s.round, null); assert.equal(await prisma.position.count({ where: { status: 'open' } }), 0);
    assert.equal(await prisma.trade.count({ where: { exitDate: null } }), 0);
    assert.equal(s.executions.length, 3);
    const count = s.executions.length;
    // Cross-process style concurrent state mutations must preserve both writes.
    await Promise.all([changeState(async x => { x.config.capital += 1; return { state: x, result: undefined }; }), changeState(async x => { x.config.capital += 1; return { state: x, result: undefined }; })]);
    assert.equal((await readState()).config.capital, s.config.capital + 2);
    assert.equal((await readState()).executions.length, count);
  } finally { await prisma.$disconnect(); }
});
