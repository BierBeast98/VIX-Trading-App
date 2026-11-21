const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
require('./load-ts.cjs');
const { NextRequest } = require('next/server');
const Module = require('node:module');
const originalLoad = Module._load;
Module._load = function(name, ...args) { if (name === '@/lib/signals/rate-limit') return { consumeAuthAttempt: async () => 'allowed' }; return originalLoad.call(this, name, ...args); };
const { POST } = require('../app/api/signals/session/route.ts');
Module._load = originalLoad;
const { allowed } = require('../lib/signals/auth.ts');
process.env.AUTH_EMAIL = 'person@example.test';
process.env.AUTH_SESSION_SECRET = 'session-secret-for-tests-32-bytes-long';
process.env.SIGNALS_ACCESS_KEY = 'existing-widget-key';
function request(body, origin = 'https://example.test') {
  return new NextRequest('https://example.test/api/signals/session', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
}
test('email and password create an HttpOnly session for all protected APIs', async () => {
  const response = await POST(request({ email: 'PERSON@example.test', password: 'existing-widget-key' }));
  assert.equal(response.status, 200);
  const cookie = response.cookies.get('signals_session');
  assert.equal(cookie.httpOnly, true); assert.equal(cookie.sameSite, 'strict'); assert.equal(cookie.path, '/api');
  assert.equal(allowed(new NextRequest('https://example.test/api/signals', { headers: { cookie: `signals_session=${cookie.value}` } })), true);
});
test('wrong email, wrong password and legacy key-shaped login are rejected', async () => {
  for (const body of [{ email: 'wrong@example.test', password: 'existing-widget-key' }, { email: 'person@example.test', password: 'bad' }, { key: 'existing-widget-key' }]) assert.equal((await POST(request(body))).status, 401);
});
test('foreign origins and missing session secret are rejected', async () => {
  assert.equal((await POST(request({ email: 'person@example.test', password: 'existing-widget-key' }, 'https://evil.test'))).status, 403);
  const saved = process.env.AUTH_SESSION_SECRET; delete process.env.AUTH_SESSION_SECRET;
  try { assert.equal((await POST(request({ email: 'person@example.test', password: 'existing-widget-key' }))).status, 401); }
  finally { process.env.AUTH_SESSION_SECRET = saved; }
});
test('legacy cookies do not authenticate; widget bearer compatibility remains', () => {
  const expiry = String(Date.now() + 86400000);
  const oldSig = createHmac('sha256', process.env.SIGNALS_ACCESS_KEY).update(`signals:${expiry}`).digest('hex');
  assert.equal(allowed(new NextRequest('https://example.test/api/signals', { headers: { cookie: `signals_session=${expiry}.${oldSig}` } })), false);
  assert.equal(allowed(new NextRequest('https://example.test/api/widget', { headers: { authorization: 'Bearer existing-widget-key' } })), true);
});
