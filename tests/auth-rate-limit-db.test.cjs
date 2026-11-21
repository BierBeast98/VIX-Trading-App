const { test } = require('node:test');
const assert = require('node:assert/strict');
require('./load-ts.cjs');
const expected = 'postgresql://vixauth@127.0.0.1:55449/vix_auth_test';
const enabled = process.env.DATABASE_URL === expected && process.env.VIX_AUTH_TEST_DB === '1';
// Never connect to a user-supplied database: this test mutates only the guarded local test DB.
test('database limiter serializes simultaneous attempts and resets only after the window', { skip: !enabled }, async () => {
  const { prisma } = require('../lib/prisma.ts');
  const { consumeAuthAttempt } = require('../lib/signals/rate-limit.ts');
  try {
    await prisma.vixCache.deleteMany({ where: { id: { in: ['auth_rate_limit_v1:login', 'auth_rate_limit_v1:bearer'] } } });
    const results = await Promise.all(Array.from({ length: 20 }, () => consumeAuthAttempt('login')));
    assert.equal(results.filter(x => x === 'allowed').length, 8);
    assert.equal(results.filter(x => x === 'limited').length, 12);
    assert.equal(await consumeAuthAttempt('login'), 'limited');
    assert.equal(await consumeAuthAttempt('bearer'), 'allowed');
    await prisma.$executeRaw`UPDATE "VixCache" SET "data" = jsonb_set("data", '{windowStart}', '1'::jsonb) WHERE "id" = 'auth_rate_limit_v1:login'`;
    assert.equal(await consumeAuthAttempt('login'), 'allowed');
  } finally {
    await prisma.vixCache.deleteMany({ where: { id: { in: ['auth_rate_limit_v1:login', 'auth_rate_limit_v1:bearer'] } } });
    await prisma.$disconnect();
  }
});
