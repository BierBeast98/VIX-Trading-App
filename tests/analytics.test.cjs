const { test } = require('node:test');
const assert = require('node:assert/strict');
require('./load-ts.cjs');
const { calcPerformanceMetrics, runBacktest } = require('../lib/analytics.ts');
const { tradeReturn, tradePnl, holdingDays } = require('../lib/trade-metrics.ts');
const trade = (overrides = {}) => ({ id: 'legacy', certificateId: 'DE000TEST000', entryDate: '2026-01-01', exitDate: '2026-01-02', entryVix: 15, barrierLevel: 10, alertTriggered: false, entryPrice: 2, exitPrice: 3, quantity: 10, returnPct: 999, ...overrides });
const params = { direction:'long', entryThreshold: 16, targetReturnPct: 18, stepPct:5, leverageRatio:1, maxHoldDays:60, stopLossPct:0, knockoutBarrierPct:0 };
const history = (values, dates = values.map((_, i) => `2026-01-${String(i + 1).padStart(2, '0')}`)) => values.map((close, i) => ({date: dates[i], close}));
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
test('model maximum holding period uses calendar days across the weekend', () => {
  const r = runBacktest(history([15,16,17],['2026-01-02','2026-01-05','2026-01-06']),{...params,maxHoldDays:2});
  assert.equal(r.trades[0].exitDate,'2026-01-05'); assert.equal(r.trades[0].holdDays,3);
});
test('model trailing floor activates at target rather than one step below the live rule', () => {
  const r = runBacktest(history([10,12,11.5,14]),{...params,entryThreshold:10,targetReturnPct:18});
  assert.equal(r.trades[0].exitReason,'trailing_stop'); assert.equal(r.trades[0].exitDate,'2026-01-03');
});
test('model long certificate loss is capped at 100% and capital remains lost', () => {
  const r = runBacktest(history([10,1,10,11]),{...params,leverageRatio:10});
  assert.equal(r.trades[0].returnPct,-100); assert.equal(r.maxDrawdown,100); assert.equal(r.totalReturn,-100);
});
test('model drawdown measures percentage loss from equity peak, not sum of percentage points', () => {
  const r = runBacktest(history([10,20,10,5]),{...params,maxHoldDays:1,targetReturnPct:200});
  near(r.totalReturn,0); near(r.maxDrawdown,50);
});
test('partial futures series cannot silently blend unrelated futures and spot levels', () => {
  const r=runBacktest(history([10,11]),params,[{date:'2026-01-01',close:20}]);
  assert.equal(r.tradesSimulated,0); assert.match(r.period,/Unvollständige/);
});
test('bad dates, zero prices and invalid model parameters produce no fabricated trades', () => {
  for(const h of [history([0,11]),history([10,11],['bad','2026-01-02']),history([10,11],['2026-01-02','2026-01-01'])]) assert.equal(runBacktest(h,params).tradesSimulated,0);
  assert.equal(runBacktest(history([10,11]),{...params,maxHoldDays:NaN}).tradesSimulated,0);
});
