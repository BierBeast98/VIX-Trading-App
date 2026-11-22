const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
function load(file, deps = {}) {
 const m = new Module(__filename); m.require = name => deps[name] ?? require(name);
 m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file); return m.exports;
}
const engine = load('lib/signals/engine.ts');
const { evaluateLevels, levelText } = load('lib/signals/levels.ts', {'./engine':engine});
const now = new Date('2026-11-19T15:00:00Z');
function state() { const s=engine.initialState(); Object.assign(s.config,{enabled:true,vixEntryPolicy:'delayed20',broker:'comdirect',opensAt:'08:00',closesAt:'22:00'});return s; }
function quote(value, minute=0) {return {vix:value,vixAt:new Date(now.getTime()-15*60000+minute*60000).toISOString(),vixSource:'yahoo',vixFeedMode:'delayed',bid:null,ask:null,productValid:false};}
test('initial below-level observation notifies without any certificate or future',()=>{const s=state();evaluateLevels(s,quote(14),now);assert.deepEqual(s.levels.events[0].levels,[15.5,14.5]);assert.equal(s.signals.length,0);assert.equal(s.round,null);assert.match(levelText(s.levels.events[0]),/VIX-EINSTIEGSNIVEAU ERREICHT/);});
test('no duplicate while below; each level rearms after rising above it',()=>{const s=state();evaluateLevels(s,quote(15.5),now);evaluateLevels(s,quote(15.4,1),now);assert.equal(s.levels.events.length,1);evaluateLevels(s,quote(16,2),now);evaluateLevels(s,quote(13,3),now);assert.equal(s.levels.events.length,2);assert.deepEqual(s.levels.events[0].levels,[15.5,14.5,13.5]);});
test('rejects old source samples, stale/missing/invalid prices, paused and closed windows',()=>{for(const q of [{...quote(13),vixAt:null},{...quote(13),vixAt:'2026-11-19T13:00:00Z'},{...quote(13),vix:NaN},{...quote(13),vixFeedMode:'unknown'}]){const s=state();evaluateLevels(s,q,now);assert.equal(s.levels,undefined);}const s=state();evaluateLevels(s,quote(16,1),now);evaluateLevels(s,quote(13),now);assert.equal(s.levels.events.length,0);s.config.enabled=false;evaluateLevels(s,quote(13,2),now);assert.equal(s.levels.events.length,0);const c=state();c.config.closedDates=['2026-11-19'];evaluateLevels(c,quote(13),now);assert.equal(c.levels,undefined);});
test('channel receipts avoid repeat sends, failures retry independently',async()=>{
 const s=state();const realtime=new Date();s.levels={sourceAt:realtime.toISOString(),below:[15.5],events:[{id:'test',at:realtime.toISOString(),levels:[15.5],value:15,sourceAt:realtime.toISOString(),source:'yahoo',delayed:true,notification:{}}]};
 let sends=0, emails=0, fail=true;
 const original=global.fetch, old=process.env.TELEGRAM_BOT_TOKEN, emailKey=process.env.RESEND_API_KEY;
 global.fetch=async()=>{sends++;return {ok:true,json:async()=>({ok:true})};};process.env.TELEGRAM_BOT_TOKEN='test';process.env.RESEND_API_KEY='test';
 const {deliverLevels}=load('lib/signals/level-notify.ts',{'./engine':{marketOpen:()=>true},'./levels':{levelText},'./store':{readState:async()=>structuredClone(s),changeState:async fn=>(await fn(s)).result},'./telegram':{telegramChatId:async()=>123},'@/lib/prisma':{prisma:{settings:{findUnique:async()=>({alertEmail:'test@example.com'})}}},resend:{Resend:class{emails={send:async()=>{emails++;return {error:fail?{}:null};}}}}});
 try{await deliverLevels();fail=false;await deliverLevels();await deliverLevels();assert.equal(sends,1);assert.equal(emails,2);assert.ok(s.levels.events[0].notification.email.sentAt);}finally{global.fetch=original;if(old===undefined)delete process.env.TELEGRAM_BOT_TOKEN;else process.env.TELEGRAM_BOT_TOKEN=old;if(emailKey===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=emailKey;}
});

test('independent configurable notification levels still work with inactive product metadata', () => {
  const s = state();
  s.config.notificationLevels = [18, 17, 16];
  s.config.entryLevels = [15.5, 14.5, 13.5];
  evaluateLevels(s, { ...quote(16.5), issuerStatus: 'inactive', productValid: false }, now);
  assert.deepEqual(s.levels.events[0].levels, [18, 17]);
  assert.equal(s.signals.length, 0);
});
test('first entry crossing without a product sends one budget hint and creates no position', () => {
  const s = state();
  Object.assign(s, { previousVix: 16.08, previousVixAt: quote(16.08).vixAt, armed: true });
  s.config.capital = 1500;
  evaluateLevels(s, quote(15.94, 1), now);
  evaluateLevels(s, quote(15.94, 1), now);
  assert.equal(s.levels.events.length, 1);
  assert.equal(s.levels.events[0].entryHint.budget, 450);
  assert.doesNotMatch(levelText(s.levels.events[0]), /ISIN|Stück|Kurszeit/);
  assert.equal(s.round, null);
});
