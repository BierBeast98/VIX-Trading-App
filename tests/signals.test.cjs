const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const compiled = ts.transpileModule(fs.readFileSync('lib/signals/engine.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = new Module(__filename); mod._compile(compiled, __filename);
const { initialState, evaluate, confirm, roundMetrics, marketOpen } = mod.exports;
const start = new Date('2026-11-17T15:00:00Z');
const cfg = { enabled: true, capital: 10000, variant: 'C', leverage: 2.3, isin: 'DE000TEST0001', wkn: 'TEST00', futureName: 'VX February 2027', futureSymbol: 'UXG7', futureExpiry: '2027-02-17', productVerified: true, barrier: 5, email: true, telegram: true, broker: 'Testbroker / Testplatz', opensAt: '08:00', closesAt: '22:00', closedDates: [] };
const quote = (vix, now = start, bid = 10, ask = 10) => ({ isin: cfg.isin, at: now.toISOString(), vix, vixRealtime:true,vixAt: now.toISOString(), future: vix * 1.1, futureAt: now.toISOString(), bid, ask, productAt: now.toISOString(), askAt: now.toISOString(), productValid: true });
function ready() { const s = initialState(); s.config = { ...cfg }; return s; }
function crossed(value = 15, bid = 10) { const s = evaluate(ready(), quote(16, new Date(start - 60000)), new Date(start - 60000)); return evaluate(s, quote(value, start, bid), start); }
function bought() { const s = crossed(); return confirm(s, { signalId: s.signals[0].id, action: 'execute', quantity: 299, price: 10, fees: 5, at: start.toISOString() }, start); }
function atDays(days) { return new Date(start.getTime() + days * 86400000); }
test('no initial purchase merely because VIX is low', () => assert.equal(evaluate(ready(), quote(14), start).signals.length, 0));
test('first threshold and jump use cumulative 30/40/50 allocation', () => { for (const [v, pct] of [[15, 30], [14.5, 40], [13.5, 50], [12.4, 50]]) { const s = crossed(v); assert.equal(s.signals[0].targetPct, pct); assert.equal(s.signals[0].budget, pct * 100); } });
test('stale, future-dated and missing timestamps never create a buy', () => { for (const at of [null, '2026-11-17T14:00:00Z', '2026-11-17T15:05:00Z']) { const s = ready(); s.previousVix = 16; s.previousVixAt = '2026-11-17T14:59:00Z'; s.armed = true; const q = quote(15); q.productAt = at; assert.equal(evaluate(s, q, start).signals.length, 0); } });
test('missing ask, inactive product, wrong contract or >15% premium block buys', () => { for (const changes of [{ ask: null }, { productValid: false }, { isin: 'DE000WRONG01' }, { future: 30 }]) { const s = ready(); s.previousVix = 16; s.previousVixAt = '2026-11-17T14:59:00Z'; s.armed = true; assert.equal(evaluate(s, { ...quote(15), ...changes }, start).signals.length, 0); } });
test('sample gaps do not infer missed crossings', () => { const s = ready(); s.previousVix = 16; s.previousVixAt = '2026-11-17T14:00:00Z'; s.armed = true; assert.equal(evaluate(s, quote(15), start).signals.length, 0); });
test('signal generation does not change holdings', () => assert.equal(crossed().round, null));
test('fees, idempotent confirmation and conflicting retries', () => { const s = crossed(); const fill = { signalId: s.signals[0].id, action: 'execute', quantity: 299, price: 10, fees: 5 }; const next = confirm(s, fill, start); assert.equal(next.round.spent, 2995); assert.equal(confirm(next, fill, start).round.spent, 2995); assert.throws(() => confirm(next, { ...fill, price: 11 }, start), /andere Ausführung/); });
test('real broker fill above recommendation is recorded accurately', () => { const s = crossed(); const next = confirm(s, { signalId: s.signals[0].id, action: 'execute', quantity: 301, price: 10, fees: 5 }, start); assert.equal(next.round.spent, 3015); });
test('add-on computes only difference, including paid fees', () => { const s = bought(); const now = new Date(start.getTime() + 60000); const next = evaluate(s, quote(14.5, now), now); assert.equal(next.signals[0].budget, 1005); assert.equal(next.signals[0].targetPct, 40); });
test('6% round loss has priority and remains recordable without spot or future', () => { const s = bought(); const now = new Date(start.getTime() + 60000); const q = { ...quote(15, now, 7.9), vix: null, vixRealtime:true,vixAt: null, future: null, futureAt: null }; const next = evaluate(s, q, now); assert.match(next.signals[0].reason, /Rundenverlustlimit/); assert.equal(next.signals[0].quantity, 299); });
test('trailing uses distance from peak and never decreases; blocks additions', () => { let s = bought(); let now = new Date(start.getTime() + 60000); s = evaluate(s, quote(15, now, 12.1), now); assert.equal(s.round.trailing, true); const floor = s.round.floorFactor; now = new Date(start.getTime() + 120000); s = evaluate(s, quote(13.5, now, 12), now); assert.equal(s.round.floorFactor, floor); assert.equal(s.signals.filter(x => x.status === 'pending').length, 0); now = new Date(start.getTime() + 180000); s = evaluate(s, quote(13.4, now, 11), now); assert.match(s.signals[0].reason, /Trailing/); });
test('B reduces each tranche after ten calendar days and preserves realized losses', () => { let s = bought(); s.round.config.variant = 'B'; const now = atDays(10); s = evaluate(s, quote(15, now, 9.5), now); const sell = s.signals[0]; assert.match(sell.reason, /80/); assert.equal(sell.quantity, Math.floor(299 * .8)); s = confirm(s, { signalId: sell.id, action: 'execute', quantity: sell.quantity, price: 9.5, fees: 5, at: now.toISOString() }, now); assert.equal(s.round.lots[0].quantity, 60); assert.equal(s.round.reduced, true); const metric = roundMetrics(s.round, 9.5); assert.ok(Math.abs(metric.pnl - (299 * 9.5 - 2995 - 5)) < 1e-8); const later = atDays(20); s = evaluate(s, quote(15, later, 9.5), later); assert.match(s.signals[0].reason, /20/); assert.equal(s.signals[0].quantity, 60); });
test('late buy supersedes outdated sell allocations', () => { let s = bought(); const now = new Date(start.getTime() + 60000); s = evaluate(s, quote(14.5, now), now); const buy = s.signals[0]; const later = new Date(start.getTime() + 120000); s = evaluate(s, quote(14.4, later, 7), later); assert.equal(s.signals[0].side, 'sell'); s = confirm(s, { signalId: buy.id, action: 'execute', quantity: 100, price: 10, fees: 0, at: now.toISOString() }, later); assert.equal(s.signals.filter(x => x.status === 'pending').length, 0); });
test('after full exit, low VIX cannot immediately re-enter', () => { let s = bought(); const now = new Date(start.getTime() + 60000); s = evaluate(s, quote(14, now, 7), now); s = confirm(s, { signalId: s.signals[0].id, action: 'execute', quantity: 299, price: 7, fees: 5, at: now.toISOString() }, now); assert.equal(s.round, null); assert.equal(s.armed, false); const later = new Date(start.getTime() + 120000); assert.equal(evaluate(s, quote(13, later), later).signals.filter(x => x.status === 'pending').length, 0); });
test('broker hours, weekends, holidays and DST gate signals', () => { assert.equal(marketOpen(cfg, start), true); assert.equal(marketOpen(cfg, new Date('2026-11-17T21:00:00Z')), false); assert.equal(marketOpen(cfg, new Date('2026-11-21T15:00:00Z')), false); assert.equal(marketOpen({ ...cfg, closedDates: ['2026-11-17'] }, start), false); assert.equal(marketOpen(cfg, new Date('2026-07-08T06:00:00Z')), true); assert.equal(marketOpen({ ...cfg, broker: '' }, start), false); assert.equal(evaluate(ready(), quote(15, new Date('2026-11-17T22:00:00Z')), new Date('2026-11-17T22:00:00Z')).signals.length, 0); });
test('partial sell risk escalation supersedes old reduction signal', () => { let s = bought(); const now = atDays(10); s = evaluate(s, quote(15, now, 9.5), now); assert.match(s.signals[0].reason, /80/); const later = new Date(now.getTime() + 60000); s = evaluate(s, quote(15, later, 7), later); assert.match(s.signals[0].reason, /Rundenverlustlimit/); assert.equal(s.signals[1].status, 'superseded'); assert.equal(s.signals[0].quantity, 299); });
test('day-ten reduction is checked once, not again after a later price drop', () => { let s = bought(); s.round.config.variant = 'B'; let now = atDays(10); s = evaluate(s, quote(15, now, 10.5), now); assert.equal(s.round.day10Checked, true); assert.equal(s.signals.filter(x => x.status === 'pending').length, 0); now = atDays(13); s = evaluate(s, quote(15, now, 9.5), now); assert.equal(s.signals.filter(x => x.status === 'pending').length, 0); });
test('A time exit and B position loss have the documented priority', () => { let s = bought(); s.round.config.variant = 'A'; const now = atDays(10); s = evaluate(s, quote(15, now, 10), now); assert.match(s.signals[0].reason, /Zeitverkauf/); s = bought(); s.round.config.variant = 'B'; const next = evaluate(s, quote(15, start, 5), start); assert.match(next.signals[0].reason, /Positionsverlustgrenze/); });
test('expired buy can be recorded from a later screenshot; no duplicate holdings', () => { let s = crossed(); const later = new Date(start.getTime() + 6 * 60000); s = evaluate(s, quote(15, later), later); const old = s.signals[0]; assert.equal(old.status, 'expired'); s = confirm(s, { signalId: old.id, action: 'execute', quantity: 299, price: 10, fees: 5, at: start.toISOString(), note: 'Screenshot' }, later); assert.equal(s.round.lots.length, 1); assert.equal(s.executions[0].note, 'Screenshot'); });
test('late results of overlapping quote requests cannot trigger a stale exit', () => { let s = bought(); const later = new Date(start.getTime() + 120000); s = evaluate(s, quote(15, later, 12), later); const old = new Date(start.getTime() + 60000); const result = evaluate(s, quote(15, old, 7), later); assert.equal(result.signals.filter(x => x.status === 'pending').length, 0); assert.equal(result.quote.productAt, later.toISOString()); });

test('delayed or unverified VIX provenance blocks even newly timestamped buys and cannot arm a crossing', () => {
  for (const vixRealtime of [false, undefined]) {
    const first = evaluate(ready(), { ...quote(16, new Date(start - 60000)), vixRealtime }, new Date(start - 60000));
    assert.equal(first.previousVix, null); assert.equal(first.armed, false);
    const second = evaluate(first, { ...quote(15), vixRealtime }, start);
    assert.equal(second.signals.length, 0); assert.match(second.health, /Echtzeitfeed/);
  }
});
test('missing VIX realtime entitlement does not suppress a certificate-price risk exit', () => {
  const now = new Date(start.getTime() + 60000);
  const next = evaluate(bought(), { ...quote(15, now, 7.9), vixRealtime: false }, now);
  assert.equal(next.signals[0].side, 'sell'); assert.match(next.signals[0].reason, /Rundenverlustlimit/);
});

function delayedReady() { const s = ready(); s.config.vixEntryPolicy = 'delayed20'; return s; }
function delayedQuote(value, now = start, ageMinutes = 20, changes = {}) {
  return { ...quote(value, now), vixRealtime: false, vixSource: 'yahoo', vixFeedMode: 'delayed',
    vixAt: new Date(now.getTime() - ageMinutes * 60000).toISOString(), ...changes };
}
function delayedArmed() {
  const early = new Date(start.getTime() - 60000);
  return evaluate(delayedReady(), delayedQuote(16, early), early);
}
test('explicit delayed20 entry accepts original Yahoo samples at exactly 20 minutes and records provenance', () => {
  const s = evaluate(delayedArmed(), delayedQuote(15), start);
  assert.equal(s.signals.length, 1); const signal = s.signals[0];
  assert.equal(signal.side, 'buy'); assert.equal(signal.vix, 15);
  assert.equal(signal.vixSource, 'yahoo'); assert.equal(signal.vixFeedMode, 'delayed');
  assert.equal(signal.vixAt, '2026-11-17T14:40:00.000Z'); assert.equal(signal.vixAgeMinutes, 20);
  assert.equal(signal.quoteAt, start.toISOString()); assert.equal(signal.price, 10);
});
test('delayed entry rejects 20 minutes plus one millisecond and 21 minutes without advancing source state', () => {
  for (const vixAt of [new Date(start.getTime() - 20 * 60000 - 1).toISOString(), new Date(start.getTime() - 21 * 60000).toISOString()]) {
    const before = delayedArmed(); const next = evaluate(before, delayedQuote(15, start, 20, { vixAt }), start);
    assert.equal(next.signals.length, 0); assert.equal(next.previousVixAt, before.previousVixAt);
    assert.match(next.health, /20 Minuten/);
  }
});
test('delayed entry fails closed on missing or wrong provenance and invalid original timestamps', () => {
  for (const changes of [{vixSource:undefined},{vixSource:'massive'},{vixSource:'unknown'},{vixFeedMode:undefined},{vixFeedMode:'unknown'},{vixFeedMode:'realtime'},{vixAt:null},{vixAt:'invalid'},{vixAt:new Date(start.getTime()+60001).toISOString()}]) {
    const next = evaluate(delayedArmed(), delayedQuote(15,start,20,changes),start);
    assert.equal(next.signals.length,0); assert.match(next.health,/20 Minuten/);
  }
});
test('delayed source tolerance permits exactly one minute of clock skew, but source samples still advance', () => {
  const early = new Date(start.getTime() - 60000);
  const armed = evaluate(delayedReady(),delayedQuote(16,early,-1),early);
  const next = evaluate(armed,delayedQuote(15,start,-1),start);
  assert.equal(next.signals.length,1); assert.equal(next.signals[0].vixAgeMinutes,-1);
});
test('delayed20 permission never relaxes Vontobel bid, ask, or actual VX five-minute limits', () => {
  for (const field of ['productAt','askAt','futureAt']) {
    const state=delayedArmed();state.quote=null;
    const next = evaluate(state,delayedQuote(15,start,20,{[field]:new Date(start.getTime()-5*60000-1).toISOString()}),start);
    assert.equal(next.signals.length,0,field);
  }
  const atBoundary = new Date(start.getTime()-5*60000).toISOString();
  const boundaryState=delayedArmed();boundaryState.quote=null;
  assert.equal(evaluate(boundaryState,delayedQuote(15,start,20,{productAt:atBoundary,askAt:atBoundary,futureAt:atBoundary}),start).signals.length,1);
});
test('delayed source crossing never bridges gaps over ten minutes or reuses the same source sample', () => {
  const late = new Date(start.getTime()+11*60000);
  assert.equal(evaluate(delayedArmed(),delayedQuote(15,late),late).signals.length,0);
  const before=delayedArmed();
  assert.equal(evaluate(before,delayedQuote(15,start,20,{vixAt:before.previousVixAt}),start).signals.length,0);
});
test('omitted and realtime policies retain the five-minute realtime entry requirement', () => {
  for(const policy of [undefined,'realtime','invalid']) {
    const s=ready(); if(policy !== undefined)s.config.vixEntryPolicy=policy;
    s.previousVix=16;s.previousVixAt=new Date(start.getTime()-21*60000).toISOString();s.armed=true;
    assert.equal(evaluate(s,delayedQuote(15),start).signals.length,0);
  }
  const s=ready();s.config.vixEntryPolicy='realtime';s.previousVix=16;s.previousVixAt=new Date(start.getTime()-6*60000).toISOString();s.armed=true;
  assert.equal(evaluate(s,{...quote(15),vixAt:new Date(start.getTime()-5*60000-1).toISOString()},start).signals.length,0);
});
test('risk exit needs a fresh Vontobel bid while delayed/missing VIX and actual VX cannot suppress it', () => {
  const s=bought();s.config.vixEntryPolicy='delayed20';s.round.config.vixEntryPolicy='delayed20';
  const now=new Date(start.getTime()+60000);
  const q=delayedQuote(15,now,21,{vix:null,vixAt:null,future:null,futureAt:null,bid:7.9,ask:null});
  const exit=evaluate(s,q,now);assert.equal(exit.signals[0].side,'sell');assert.equal(exit.signals[0].vix,null);
  assert.equal(exit.signals[0].vixAgeMinutes,null);assert.match(exit.signals[0].reason,/Rundenverlustlimit/);
  const staleState=structuredClone(s);staleState.quote=null;
  const stale=evaluate(staleState,{...q,productAt:new Date(now.getTime()-5*60000-1).toISOString()},now);
  assert.equal(stale.signals.filter(signal=>signal.status==='pending').length,0);assert.match(stale.health,/kein frischer Geldkurs/);
});

test('configured entry levels control crossing, explanation, and frozen round stages', () => {
  const configured = ready();
  configured.config.entryLevels = [20, 18, 16];
  configured.config.notificationLevels = [14, 13, 12];
  const early = new Date(start.getTime() - 60_000);
  const armed = evaluate(configured, quote(20, early), early);
  assert.equal(evaluate(armed, quote(20), start).signals.length, 0);
  const crossing = evaluate(armed, quote(18.5), start);
  assert.equal(crossing.signals[0].targetPct, 30);
  assert.match(crossing.signals[0].reason, /unterschreitet 20/);
  const round = confirm(crossing, { signalId: crossing.signals[0].id, action: 'execute', quantity: 299, price: 10 }, start);
  round.config.entryLevels = [24, 21, 19];
  const next = new Date(start.getTime() + 60_000);
  assert.equal(evaluate(round, quote(18, next), next).signals[0].targetPct, 40);
});

test('definitive inactivity supersedes a pending recommendation and permits subsequent manual settlement', () => {
  const held = bought();
  const at = new Date(start.getTime() + 60_000);
  const sell = evaluate(held, quote(15, at, 7), at);
  assert.equal(sell.signals[0].status, 'pending');
  const later = atDays(1);
  const next = evaluate(sell, { ...quote(15, later, 7), issuerStatus: 'inactive', productValid: false }, later);
  assert.equal(next.signals[0].status, 'superseded');
  assert.match(next.health, /Ausbuchung/);
  const fill = { action: 'settle', roundId: next.round.id, quantity: 299, proceeds: 0, fees: 0, at: later.toISOString(), taxWithheld: 0 };
  assert.throws(() => confirm(next, { ...fill, quantity: 298 }, later), /Bestand/);
  const settled = confirm(next, fill, later);
  assert.equal(settled.round, null);
  assert.equal(settled.config.productVerified, false);
  assert.equal(settled.config.capital, 7005);
  assert.equal(settled.executions[0].price, 0);
  assert.equal(settled.executions[0].taxWithheld, 0);
  assert.deepEqual(confirm(settled, fill, later), settled);
  assert.throws(() => confirm(settled, { ...fill, proceeds: 10 }, later), /andere Ausführung/);
});

test('withholding reduces future allocation capital but leaves the round risk result pre-tax', () => {
  const held = bought();
  const first = atDays(10);
  const reduced = evaluate(held, quote(15, first, 9.5), first);
  const partial = reduced.signals[0];
  const next = confirm(reduced, { signalId: partial.id, action: 'execute', quantity: partial.quantity, price: 9.5, fees: 2, taxWithheld: 12 }, first);
  assert.equal(next.round.taxWithheld, 12);
  assert.ok(Math.abs(roundMetrics(next.round, 9.5).pnl - (299 * 9.5 - 2995 - 2)) < 1e-8);
  const last = atDays(20);
  const sold = confirm(next, { action: 'settle', roundId: next.round.id, quantity: 60, proceeds: 6, fees: 0, at: last.toISOString() }, last);
  assert.ok(Math.abs(sold.config.capital - (10000 + 239 * 9.5 + 6 - 2995 - 2 - 12)) < 1e-8);
  assert.equal(sold.executions[0].taxWithheld, null);
});
