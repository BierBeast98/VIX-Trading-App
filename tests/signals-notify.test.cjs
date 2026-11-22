const { test } = require('node:test');
const assert = require('node:assert/strict');
require('./load-ts.cjs');
const { initialState } = require('../lib/signals/engine.ts');
const store = require('../lib/signals/store.ts');
let state;
store.readState = async () => structuredClone(state);
store.changeState = async fn => { const result = await fn(structuredClone(state)); state = result.state; return result.result; };
const { deliverSignals } = require('../lib/signals/notify.ts');
const { telegramTestLabels } = require('../lib/signals/telegram-tests.ts');
const { POST: sendTelegramTest } = require('../app/api/telegram/test/route.ts');
const { NextRequest } = require('next/server');

test('Telegram test route sends each labeled scenario only to the configured chat', async () => {
  const originalFetch = global.fetch;
  const env = { ...process.env };
  const messages = [];
  Object.assign(process.env, { SIGNALS_ACCESS_KEY: 'test-access', TELEGRAM_BOT_TOKEN: 'test-token', TELEGRAM_CHAT_ID: '1234' });
  global.fetch = async (_url, options) => {
    messages.push(JSON.parse(options.body));
    return { ok: true, json: async () => ({ ok: true }) };
  };
  const submit = (scenario, authorization = 'Bearer test-access') => sendTelegramTest(new NextRequest('https://vix.test/api/telegram/test', {
    method: 'POST', headers: { authorization, origin: 'https://vix.test', 'content-type': 'application/json' },
    body: JSON.stringify({ scenario }),
  }));
  try {
    assert.equal((await submit('loss', 'Bearer wrong')).status, 401);
    assert.equal((await submit('invalid')).status, 400);
    assert.equal(messages.length, 0);
    for (const scenario of Object.keys(telegramTestLabels)) assert.equal((await submit(scenario)).status, 200);
    assert.equal(messages.length, 6);
    assert.ok(messages.every(message => message.chat_id === '1234' && /^TEST · /.test(message.text)));
    assert.doesNotMatch(messages[0].text, /ISIN|Stück|Briefkurs/);
    assert.match(messages[1].text, /ISIN/);
    assert.ok(messages.every(message => !/Kurszeit|zeitversetzt|verzögert|Fiktives Szenario/.test(message.text)));
    assert.match(messages[2].text, /Hoch \+40 % · Schwelle \+35 %/);
    assert.match(messages[5].text, /Verlustgrenze −35 %/);
  } finally {
    global.fetch = originalFetch;
    for (const name of ['SIGNALS_ACCESS_KEY', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID']) {
      if (env[name] === undefined) delete process.env[name]; else process.env[name] = env[name];
    }
  }
});
function fixture() {
  const s = initialState(); s.config.enabled = true; s.config.telegram = true; s.config.email = false;
  s.config.broker = 'Test'; s.config.opensAt = '00:00'; s.config.closesAt = '23:59';
  const at = new Date().toISOString();
  s.quote = { isin: 'DE000TEST0001', at, vix: 15, vixAt: at, future: 16, futureAt: at, bid: 10, ask: 11, productAt: at };
  s.signals = [{ id: crypto.randomUUID(), side: 'sell', status: 'pending', isin: s.quote.isin, reason: 'Test', capital: 10000, at, quoteAt: at, expiresAt: new Date(Date.now()+300000).toISOString(), price: 10, quantity: 10, notification: {} }];
  return s;
}
test('Telegram receipt, deduplication, reminder, retry and market gate without real messages', async () => {
  // Fix the wall clock to a weekday inside the configured window.
  const RealDate = Date; const instant = RealDate.parse('2026-11-17T11:00:00Z');
  global.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [instant])); } static now() { return instant; } };
  const oldFetch = global.fetch;
  let calls = 0, fail = false;
  global.fetch = async () => { calls++; return { ok: !fail, json: async () => ({ ok: !fail }) }; };
  process.env.TELEGRAM_BOT_TOKEN = 'test-only'; process.env.TELEGRAM_CHAT_ID = 'test-only';
  try {
    state = fixture(); await deliverSignals(); assert.equal(calls,1); assert.ok(state.signals[0].notification.telegram.sentAt);
    await deliverSignals(); assert.equal(calls,1);
    state.signals[0].notification.telegram.sentAt = new RealDate(instant - 16*60000).toISOString();
    await deliverSignals(); assert.equal(calls,2);
    state = fixture(); fail = true; await deliverSignals(); assert.equal(calls,3); assert.equal(state.signals[0].notification.telegram.sentAt,undefined); assert.ok(state.signals[0].notification.telegram.error);
    fail = false; await deliverSignals(); assert.equal(calls,4); assert.ok(state.signals[0].notification.telegram.sentAt);
    state = fixture(); state.config.closesAt = '01:00'; await deliverSignals(); assert.equal(calls,4);
    state = fixture(); state.quote.productAt = '2026-11-17T10:00:00Z'; await deliverSignals(); assert.equal(calls,4);
    for (const bid of [null, 0, NaN, Infinity]) { state=fixture(); state.quote.bid=bid; await deliverSignals(); assert.equal(calls,4); }
  } finally { global.fetch = oldFetch; global.Date = RealDate; delete process.env.TELEGRAM_BOT_TOKEN; delete process.env.TELEGRAM_CHAT_ID; }
});

test('approved delayed Yahoo entry is delivered with provenance; stale data and unapproved mode are not', async () => {
  const RealDate=Date;const instant=RealDate.parse('2026-11-17T11:00:00Z');
  global.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[instant]));}static now(){return instant;}};
  const oldFetch=global.fetch;let messages=[];
  global.fetch=async(url,options)=>{messages.push(JSON.parse(options.body).text);return{ok:true,json:async()=>({ok:true})};};
  process.env.TELEGRAM_BOT_TOKEN='test-only';process.env.TELEGRAM_CHAT_ID='test-only';
  function buy(){const s=fixture();s.config.vixEntryPolicy='delayed20';s.quote.vixAt=new RealDate(instant-16*60000).toISOString();s.quote.vixSource='yahoo';s.quote.vixFeedMode='delayed';s.quote.vixRealtime=false;Object.assign(s.signals[0],{side:'buy',budget:450,targetPct:30,vix:15,vixAt:s.quote.vixAt,vixSource:'yahoo',vixFeedMode:'delayed',vixAgeMinutes:16});return s;}
  try{
    state=buy();await deliverSignals();assert.equal(messages.length,1);assert.doesNotMatch(messages[0],/verzögert|Kurszeit|ISIN|Stück/);
    state=buy();state.config.vixEntryPolicy='realtime';await deliverSignals();assert.equal(messages.length,1);
    state=buy();state.quote.vixAt=new RealDate(instant-21*60000).toISOString();await deliverSignals();assert.equal(messages.length,1);
    state=buy();state.quote.productAt=new RealDate(instant-6*60000).toISOString();await deliverSignals();assert.equal(messages.length,1);
    state=buy();state.quote.askAt=new RealDate(instant-6*60000).toISOString();await deliverSignals();assert.equal(messages.length,1);
    state=buy();state.signals[0].vixAt=new RealDate(instant-21*60000).toISOString();await deliverSignals();assert.equal(messages.length,1);
    state=buy();state.signals[0].vixSource=undefined;await deliverSignals();assert.equal(messages.length,1);
    state=buy();state.quote.ask=null;await deliverSignals();assert.equal(messages.length,1);
    state=buy();state.quote.future=null;await deliverSignals();assert.equal(messages.length,1);
  }finally{global.fetch=oldFetch;global.Date=RealDate;delete process.env.TELEGRAM_BOT_TOKEN;delete process.env.TELEGRAM_CHAT_ID;}
});

test('Telegram receipt sync stores image and recognized fields once, links only an exact reply', async () => {
  const { prisma } = require('../lib/prisma.ts');
  const tg = require('../lib/signals/telegram.ts');
  const ocr = require('../lib/signals/receipt-ocr.ts');
  const { syncTelegramReceipts } = require('../lib/signals/telegram-inbox.ts');
  const bytes = Buffer.from([255,216,255,217]);
  const rows = new Map();
  const cache = prisma.vixCache;
  const edits = [];
  function stub(target, key, value) {
    edits.push([target, key, target[key]]);
    target[key] = value;
  }
  const fake = {
    count: async ({where}) => Number(rows.has(where.id)),
    create: async ({data}) => rows.set(data.id, data),
    findUnique: async ({where}) => rows.get(where.id),
    upsert: async ({create}) => rows.set(create.id, {...create, updatedAt: new Date()}),
    updateMany: async () => ({}),
  };
  const message = { date: 1700000000, message_id: 4, chat: {id: 9, type: 'private'}, from: {id: 9, is_bot: false},
    reply_to_message: {message_id: 2}, photo: [{file_id: 'picture', file_size: bytes.length}] };
  const updates = [ {update_id: 1, message: {...message, chat: {id: 8, type: 'private'}}}, {update_id: 2, message} ];
  const token = process.env.TELEGRAM_BOT_TOKEN;
  process.env.TELEGRAM_BOT_TOKEN = '123:test';
  const state = initialState(); state.signals.push({id:'signal',telegramMessages:['9:2']});
  let downloads = 0;
  try {
    for (const key of Object.keys(fake)) stub(cache, key, fake[key]);
    stub(tg, 'telegramChatId', async () => '9');
    stub(tg, 'telegramCall', async method => method === 'getFile' ? {file_path:'photos/1', file_size:bytes.length} : updates);
    stub(ocr, 'readPurchase', async () => ({quantity:45}));
    stub(store, 'changeState', async fn => fn(state, {vixCache:fake}));
    stub(global, 'fetch', async () => { downloads++; return new Response(bytes); });
    await syncTelegramReceipts();
    await syncTelegramReceipts();
    assert.equal(downloads, 1);
    assert.equal(state.receipts.length, 1);
    assert.equal(state.receipts[0].signalId, 'signal');
    assert.equal(state.receipts[0].fields.quantity, 45);
    assert.equal(rows.get(state.receipts[0].id).data.content, bytes.toString('base64'));
  } finally {
    for (const [target, key, old] of edits.reverse()) target[key] = old;
    if (token === undefined) delete process.env.TELEGRAM_BOT_TOKEN; else process.env.TELEGRAM_BOT_TOKEN = token;
  }
});

test('Telegram records confirmed partial and full sales once and refuses overselling', async t => {
  const { handleSaleText, parseSale } = require('../lib/signals/telegram-sale.ts');
  const { prisma } = require('../lib/prisma.ts');
  const telegram = require('../lib/signals/telegram.ts');
  assert.deepEqual(parseSale('Verkauf zu 2,40 €, 50 Stück'), { quantity: 50, price: 2.4 });
  assert.equal(parseSale('Verkauf 50 Stück zu 0 €'), undefined);
  const rows = new Map(), replies = [];
  const cache = {
    findUnique: async ({ where }) => rows.get(where.id),
    create: async ({ data }) => rows.set(data.id, data),
    upsert: async ({ create }) => rows.set(create.id, create),
    delete: async ({ where }) => rows.delete(where.id),
  };
  const cacheUpdate = prisma.vixCache.update;
  prisma.vixCache.update = async ({ where, data }) => rows.set(where.id, data);
  t.after(() => { prisma.vixCache.update = cacheUpdate; });
  t.mock.method(telegram, 'telegramCall', async (_, body) => replies.push(body.text));
  const date = Math.floor(Date.now() / 1000) - 30;
  const startedAt = new Date((date - 600) * 1000).toISOString();
  let state = initialState();
  state.round = { id: 'round', config: { ...state.config, isin: 'DE000TEST123' }, capital: 1000, stage: 1, startedAt,
    spent: 200, realized: 0, lots: [{ id: 'lot', enteredAt: startedAt, quantity: 100, originalQuantity: 100,
      fees: 0, cost: 200, entryPrice: 2, tradeId: 'trade', positionId: 'position' }] };
  const tx = { vixCache: cache, trade: {
    findUnique: async () => ({ quantity: state.round.lots[0].quantity, entryFees: 0, exitDate: null }),
    update: async () => {}, create: async () => ({}),
  }, position: { create: async () => ({ id: 'closed' }), update: async () => {} } };
  t.mock.method(store, 'changeState', async fn => {
    const next = await fn(structuredClone(state), tx); state = next.state; return next.result;
  });
  const send = (text, id) => handleSaleText('123', '456', text, id, date + id);
  await send('Verkauf 50 Stück zu 2,40 €', 1);
  assert.match(replies.at(-1), /Buchen 1 0/);
  assert.equal(state.executions.length, 0);
  await send('Buchen 1 1,50 Steuer 0,20', 2);
  await send('Buchen 1 1,50 Steuer 0,20', 2);
  assert.equal(state.executions.length, 1);
  assert.equal(state.round.lots[0].quantity, 50);
  assert.equal(state.executions[0].fees, 1.5);
  assert.equal(state.executions[0].taxWithheld, .2);
  await send('Verkauf 51 Stück zu 2,40 €', 3);
  assert.match(replies.at(-1), /übersteigt/);
  await send('Verkauf zu 2,50 €, 50 Stück', 4);
  await send('Buchen 4 0', 5);
  assert.equal(state.round, null);
  assert.match(replies.at(-1), /Restbestand: 0/);
});
