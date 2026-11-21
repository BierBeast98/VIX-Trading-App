const test = require('node:test');
const assert = require('node:assert/strict');
require('./load-ts.cjs');
const { NextRequest } = require('next/server');
const Module = require('node:module');
const originalLoad = Module._load;
Module._load = function(name, ...args) { if (name === '@/lib/signals/rate-limit') return { limitBearer: async () => null }; return originalLoad.call(this, name, ...args); };
const { proxy } = require('../proxy.ts');
Module._load = originalLoad;
const { sessionCookie } = require('../lib/signals/auth.ts');
process.env.SIGNALS_ACCESS_KEY = 'example-key-for-tests';
process.env.AUTH_SESSION_SECRET = 'session-secret-for-tests-32-bytes-long';
function req(path, options = {}) { return new NextRequest(`https://example.test${path}`, options); }
test('financial reads and mutations require access, including legacy routes', async () => {
  for (const path of ['/api/trades', '/api/positions/123', '/api/settings', '/api/account-capital', '/api/analytics', '/api/alerts/test', '/api/auth/status', '/api/vontobel/batch', '/api/vix/historical']) {
    assert.equal((await proxy(req(path))).status, 401, path);
    assert.equal((await proxy(req(path, { method: 'POST' }))).status, 401, path);
  }
});
test('authenticated session can access data; cross-origin writes are rejected', async () => {
  const cookie = `signals_session=${sessionCookie()}`;
  assert.equal((await proxy(req('/api/trades', { headers: { cookie } }))).status, 200);
  assert.equal((await proxy(req('/api/trades', { method: 'POST', headers: { cookie, origin: 'https://evil.test' } }))).status, 403);
  assert.equal((await proxy(req('/api/trades', { method: 'POST', headers: { cookie, origin: 'https://example.test' } }))).status, 200);
});
test('public quotes and separately authenticated scheduler routes remain reachable', async () => {
  for (const path of ['/api/vix/spot', '/api/calendar', '/api/signals/check', '/api/archive/collect', '/api/alerts/check', '/api/telegram/connect', '/api/signals/session']) assert.equal((await proxy(req(path))).status, 200, path);
});
