const { test } = require('node:test');
const assert = require('node:assert/strict');
require('./load-ts.cjs');
const { initialState } = require('../lib/signals/engine.ts');
const store = require('../lib/signals/store.ts');
let state;
store.readState = async () => structuredClone(state);
store.changeState = async fn => { const result = await fn(structuredClone(state)); state = result.state; return result.result; };
const { deliverSignals } = require('../lib/signals/notify.ts');
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
    state=buy();await deliverSignals();assert.equal(messages.length,1);assert.match(messages[0],/Yahoo Finance.*verzögert/);assert.match(messages[0],/16.0 Min/);assert.match(messages[0],/Vontobel-Kurszeit/);
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
