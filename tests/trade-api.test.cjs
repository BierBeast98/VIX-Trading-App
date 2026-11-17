const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
require('./load-ts.cjs');
let state;
let failTradeCreate = false;
const clone = value => structuredClone(value);
const prisma = {
  trade: {
    findUnique: async ({ where }) => {
      const row = state.trades.find(t => t.id === where.id);
      return row ? { ...clone(row), position: clone(state.positions.find(p => p.id === row.positionId) ?? null) } : null;
    },
    findMany: async ({ where }) => clone(state.trades.filter(t => t.positionId === where.positionId)),
    update: async ({ where, data }) => {
      const row = state.trades.find(t => t.id === where.id);
      Object.assign(row, clone(data));
      return clone(row);
    },
    create: async ({ data }) => {
      if (failTradeCreate) throw new Error('simulated write failure');
      const row = { id: 'new-trade', ...clone(data) };
      state.trades.push(row); return clone(row);
    },
    delete: async ({ where }) => { state.trades = state.trades.filter(t => t.id !== where.id); },
  },
  position: {
    findUnique: async ({ where }) => {
      const row = state.positions.find(p => p.id === where.id);
      return row ? { ...clone(row), trades: clone(state.trades.filter(t => t.positionId === row.id)) } : null;
    },
    create: async ({ data }) => { const row = { id: 'new-position', notes: '', ...clone(data) }; state.positions.push(row); return clone(row); },
    update: async ({ where, data }) => { const row = state.positions.find(p => p.id === where.id); Object.assign(row, clone(data)); return clone(row); },
    delete: async ({ where }) => { state.positions = state.positions.filter(p => p.id !== where.id); },
  },
  $transaction: async callback => { const before = clone(state); try { return await callback(prisma); } catch (error) { state = before; throw error; } },
};
const originalLoad = Module._load;
Module._load = function (name, parent, ...rest) {
  if (name === '@/lib/prisma') return { prisma };
  return originalLoad.call(this, name, parent, ...rest);
};
const trades = require('../app/api/trades/route.ts');
const trade = require('../app/api/trades/[id]/route.ts');
const positions = require('../app/api/positions/[id]/route.ts');
Module._load = originalLoad;
const params = { params: Promise.resolve({ id: 't1' }) };
const posParams = { params: Promise.resolve({ id: 'p1' }) };
const request = (data, method = 'PUT') => new Request('http://localhost', { method, ...(data === undefined ? {} : { body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } }) });
function reset(overrides = {}) {
  failTradeCreate = false;
  state = {
    positions: [{ id: 'p1', certificateId: 'DE000TEST123', direction: 'long', entryVix: 15, entryPrice: 2, currentPrice: 2.5, barrierLevel: 10, leverageRatio: 2, status: 'open', notes: '' }],
    trades: [{ id: 't1', positionId: 'p1', certificateId: 'DE000TEST123', direction: 'long', entryDate: new Date('2026-11-10T10:00:00Z'), exitDate: null, entryVix: 15, entryPrice: 2, exitPrice: null, quantity: 10, barrierLevel: 10, leverageRatio: 2, returnPct: null, holdDays: null, notes: '', ...overrides }],
  };
}
test('rejects reversed dates and invalid calendar dates before persistence', async () => {
  reset(); const before = clone(state);
  assert.equal((await trade.PUT(request({ exitDate: '2026-11-09', exitPrice: 3 }), params)).status, 400);
  assert.deepEqual(state, before);
  assert.equal((await trade.PUT(request({ entryDate: '2026-02-31' }), params)).status, 400);
});
test('single-price edit recalculates merged return and synchronizes position prices', async () => {
  reset({ exitDate: new Date('2026-11-11T10:00:00Z'), exitPrice: 3, returnPct: 50 });
  const res = await trade.PUT(request({ entryPrice: 1.5 }), params);
  assert.equal(res.status, 200); assert.equal(state.trades[0].returnPct, 100);
  assert.equal(state.positions[0].entryPrice, 1.5); assert.equal(state.positions[0].currentPrice, 3); assert.equal(state.positions[0].status, 'closed');
});
test('zero exit execution records total loss, even for short underlying exposure', async () => {
  reset({ direction: 'short' });
  assert.equal((await trade.PUT(request({ exitDate: '2026-11-11T10:00:00Z', exitPrice: 0 }), params)).status, 200);
  assert.equal(state.trades[0].returnPct, -100); assert.equal(state.positions[0].currentPrice, 0);
});
test('reopening clears realized data and recomputes holding duration to null', async () => {
  reset({ exitDate: new Date('2026-11-11'), exitPrice: 3, returnPct: 50, holdDays: 1 });
  assert.equal((await trade.PUT(request({ exitDate: null }), params)).status, 200);
  assert.equal(state.trades[0].exitPrice, null); assert.equal(state.trades[0].returnPct, null); assert.equal(state.trades[0].holdDays, null); assert.equal(state.positions[0].status, 'open');
});
test('manual historical return survives without complete prices; open trades cannot realize it', async () => {
  reset({ entryPrice: null, exitDate: new Date('2026-11-11'), returnPct: 12 });
  assert.equal((await trade.PUT(request({ notes: 'historical' }), params)).status, 200); assert.equal(state.trades[0].returnPct, 12);
  assert.equal((await trade.PUT(request({ exitDate: null, returnPct: 90 }), params)).status, 200); assert.equal(state.trades[0].returnPct, null);
});
test('rejects invalid price and quantity and missing trades', async () => {
  reset();
  for (const body of [{ entryPrice: 0 }, { exitPrice: -1 }, { quantity: 0 }, { quantity: 1.5 }]) assert.equal((await trade.PUT(request(body), params)).status, 400);
  assert.equal((await trade.PUT(request({ notes: '' }), { params: Promise.resolve({ id: 'missing' }) })).status, 404);
});
test('position close never turns a cached quote into an execution', async () => {
  reset(); const before = clone(state);
  assert.equal((await positions.DELETE(request(undefined, 'DELETE'), posParams)).status, 409); assert.deepEqual(state, before);
  assert.equal((await positions.DELETE(request({ exitDate: '2026-11-11', exitPrice: 3, quantity: 9 }, 'DELETE'), posParams)).status, 409); assert.deepEqual(state, before);
  assert.equal((await positions.DELETE(request({ exitDate: '2026-11-11', exitPrice: 3, quantity: 10 }, 'DELETE'), posParams)).status, 200);
  assert.equal(state.trades[0].returnPct, 50); assert.equal(state.positions[0].currentPrice, 3);
});
test('position close rejects dates before entry with no writes', async () => {
  reset(); const before = clone(state);
  assert.equal((await positions.DELETE(request({ exitDate: '2026-11-09', exitPrice: 3, quantity: 10 }, 'DELETE'), posParams)).status, 400); assert.deepEqual(state, before);
});
test('position update cannot bypass trade consistency or set arbitrary status', async () => {
  reset();
  assert.equal((await positions.PUT(request({ status: 'closed' }), posParams)).status, 400);
  assert.equal((await positions.PUT(request({ entryPrice: 20 }), posParams)).status, 409);
  assert.equal((await positions.PUT(request({ currentPrice: 3 }), posParams)).status, 200);
});
test('managed signal holdings stay protected even if trade notes are changed', async () => {
  reset(); state.positions[0].notes = 'signal:lot';
  assert.equal((await trade.PUT(request({ notes: '' }), params)).status, 409);
  assert.equal((await trade.DELETE(request(undefined, 'DELETE'), params)).status, 409);
});
test('failed trade creation rolls back its new position', async () => {
  reset(); const before = clone(state); failTradeCreate = true;
  const oldError = console.error; console.error = () => {};
  try { assert.equal((await trades.POST(request({ certificateId: 'DE000TEST123', entryDate: '2026-11-10', barrierLevel: 10, entryPrice: 2, quantity: 10 }, 'POST'))).status, 500); }
  finally { console.error = oldError; }
  assert.deepEqual(state, before);
});
test('deleting one grouped trade preserves other open trades and position', async () => {
  reset(); state.trades.push({ ...clone(state.trades[0]), id: 't2' });
  assert.equal((await trade.DELETE(request(undefined, 'DELETE'), params)).status, 200);
  assert.equal(state.trades.length, 1); assert.equal(state.positions.length, 1); assert.equal(state.positions[0].status, 'open');
});
