const { test } = require('node:test');
const assert = require('node:assert/strict');
require('./load-ts.cjs');
const { calcPerformanceMetrics } = require('../lib/analytics.ts');
const { tradeReturn, tradePnl, tradeNetResult, holdingDays } = require('../lib/trade-metrics.ts');
const trade = (overrides = {}) => ({ id: 'legacy', certificateId: 'DE000TEST000', entryDate: '2026-01-01', exitDate: '2026-01-02', entryVix: 15, barrierLevel: 10, alertTriggered: false, entryPrice: 2, exitPrice: 3, quantity: 10, returnPct: 999, ...overrides });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
test('actual certificate prices override stale returns and zero exit is a full loss in both directions', () => {
  near(tradeReturn(trade()), 50);
  near(tradeReturn(trade({direction:'short', exitPrice:0})), -100);
  near(tradePnl(trade({exitPrice:0})), -20);
});
test('invalid chronology is visible but excluded, and source trade is unchanged', () => {
  const wrong = trade({id:'reversed', entryDate:'2026-03-23', exitDate:'2026-03-09'});
  const before = JSON.stringify(wrong); const m = calcPerformanceMetrics([trade(), wrong]);
  assert.equal(m.closedTrades, 2); assert.equal(m.invalidDateTrades, 1); assert.equal(m.analyzedTrades, 1);
  near(m.totalPnlEur, 10); near(m.avgReturn, 50); assert.equal(JSON.stringify(wrong), before);
});
test('same-day and intraday duration are preserved rather than clamped to one day or omitted', () => {
  near(holdingDays('2026-01-01T08:00:00Z','2026-01-01T20:00:00Z'), .5);
  const m = calcPerformanceMetrics([trade({exitDate:'2026-01-01'}), trade()]); near(m.avgHoldDays, .5);
});
test('missing return is not a zero-percent loss and priced P&L does not require a stored return', () => {
  const m = calcPerformanceMetrics([trade({returnPct:null}),trade({entryPrice:null,exitPrice:null,returnPct:null})]);
  assert.equal(m.closedTrades,2); assert.equal(m.analyzedTrades,1); assert.equal(m.missingReturnTrades,1);
  near(m.winRate,1); near(m.totalPnlEur,10);
});
test('legacy certificate returns never manufacture an account compound or annualized return', () => {
  const m = calcPerformanceMetrics([trade(),trade({id:'other',quantity:1})]);
  assert.equal(m.compoundReturn,null); assert.equal(m.annualizedReturn,null); near(m.totalPnlEur,11);
});
test('reported net trade performance separates unknown charges, known zero and taxes paid', () => {
  const known = trade({ entryFees: .5, exitFees: 1, taxWithheld: 2 });
  const unknownTax = trade({ entryFees: 0, exitFees: 0 });
  const knownZeroTax = trade({ entryFees: 0, exitFees: 0, taxWithheld: 0 });
  const legacy = trade({ taxWithheld: 0 });
  const m = calcPerformanceMetrics([known, unknownTax, knownZeroTax, legacy]);
  assert.equal(m.tradesWithEurData, 4);
  assert.equal(m.tradesWithFees, 3);
  assert.equal(m.tradesWithTax, 2);
  near(m.totalPnlEur, 40);
  near(m.pnlBeforeTax, 28.5);
  near(m.pnlAfterTax, 16.5);
  near(tradeNetResult(known).afterTaxReturnPct, 6.5 / 20.5 * 100);
  assert.equal(tradeNetResult(unknownTax).afterTax, null);
  assert.equal(tradeNetResult(legacy).beforeTax, null);
  assert.equal(tradeNetResult({ ...known, exitDate: null }).beforeTax, null);
});
