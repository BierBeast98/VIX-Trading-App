const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const Module = require('node:module');
require('./load-ts.cjs');
const { NextRequest, NextResponse } = require('next/server');
let disposition = 'allowed', bearerChecks = 0, loginChecks = 0, runs = 0;
const blockedResponse = result => NextResponse.json({ error: 'blocked' }, { status: result === 'limited' ? 429 : 503 });
const mockLimiter = {
  consumeAuthAttempt: async () => { loginChecks++; return disposition; },
  limitResponse: blockedResponse,
  limitBearer: async req => { if (!req.headers.has('authorization')) return null; bearerChecks++; return disposition === 'allowed' ? null : blockedResponse(disposition); },
};
const cronToken = 'dedicated-cron-token-for-test-1234567890';
const originalLoad = Module._load;
Module._load = function(name, ...args) {
  if (name === '@/lib/signals/rate-limit') return mockLimiter;
  if (name === '@/lib/signals/auth') return { allowed: () => false, sameOrigin: () => true, cronAllowed: () => false, sessionCookie: () => 'signed', verifyCredentials: async () => true };
  if (name === '@/lib/archive/config') return { archiveConfig: async () => ({ tokenHash: createHash('sha256').update(cronToken).digest('hex') }) };
  if (name === '@/lib/archive/collector') return { collectMarketData: async () => { runs++; return { collected: true }; } };
  if (name === '@/lib/signals/service') return { runSignalsCheck: async () => { runs++; return { checked: true }; } };
  if (name === '@/lib/signals/schedule') return { monitorCronAllowed: async () => true, recordMonitorRun: async () => {} };
  return originalLoad.call(this, name, ...args);
};
const { proxy } = require('../proxy.ts');
const session = require('../app/api/signals/session/route.ts');
const signal = require('../app/api/signals/check/route.ts');
const archive = require('../app/api/archive/collect/route.ts');
Module._load = originalLoad;
const req = (path, options = {}) => new NextRequest(`https://example.test${path}`, options);
const bearer = { authorization: 'Bearer invalid-test-key' };
test('global bearer throttle covers protected API and public VIX endpoint', async () => {
  disposition = 'limited'; bearerChecks = 0;
  assert.equal((await proxy(req('/api/trades', { headers: bearer }))).status, 429);
  assert.equal((await proxy(req('/api/vix/spot', { headers: bearer }))).status, 429);
  assert.equal((await proxy(req('/api/vix/spot'))).status, 200);
  assert.equal(bearerChecks, 2);
  disposition = 'unavailable'; assert.equal((await proxy(req('/api/widget', { headers: bearer }))).status, 503);
});
test('login throttle is fail-closed, counts successful requests, and caps body length', async () => {
  loginChecks = 0; disposition = 'limited';
  assert.equal((await session.POST(req('/api/signals/session', { method: 'POST', body: '{}' }))).status, 429);
  disposition = 'unavailable'; assert.equal((await session.POST(req('/api/signals/session', { method: 'POST', body: '{}' }))).status, 503);
  disposition = 'allowed'; assert.equal((await session.POST(req('/api/signals/session', { method: 'POST', body: JSON.stringify({ email: 'x', password: 'y' }) }))).status, 200);
  assert.equal((await session.POST(req('/api/signals/session', { method: 'POST', body: JSON.stringify({ password: 'x'.repeat(5000) }) }))).status, 400);
  assert.equal(loginChecks, 4);
});
test('manual and archive bearer requests are limited while dedicated cron remains independent', async () => {
  runs = 0; bearerChecks = 0; disposition = 'limited';
  assert.equal((await signal.POST(req('/api/signals/check', { method: 'POST', headers: bearer }))).status, 429);
  assert.equal((await archive.POST(req('/api/archive/collect', { method: 'POST', headers: bearer }))).status, 429);
  assert.equal((await signal.GET(req('/api/signals/check', { headers: { authorization: `Bearer ${cronToken}` } }))).status, 200);
  assert.equal((await archive.POST(req('/api/archive/collect', { method: 'POST', headers: { authorization: `Bearer ${cronToken}` } }))).status, 200);
  assert.equal(runs, 2); assert.equal(bearerChecks, 2);
});
