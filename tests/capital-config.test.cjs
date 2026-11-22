const {test}=require('node:test');const assert=require('node:assert/strict');const Module=require('node:module');require('./load-ts.cjs');
const {initialState}=require('../lib/signals/engine.ts');let state;const audits=[];const saved=Module._load;
Module._load=function(name,parent,...rest){if(name==='@/lib/prisma')return{prisma:{}};if(name==='@/lib/signals/telegram')return{telegramChatId:async()=>null};if(name==='@/lib/signals/auth')return{allowed:()=>true,sameOrigin:()=>true};if(name==='@/lib/signals/store')return{changeState:async fn=>{const next=structuredClone(state);const result=await fn(next,{vixCache:{findUnique:async()=>({data:{source:'strategy-baseline'}}),create:async args=>{audits.push(args.data)}}});state=result.state;return result.result;}};return saved.call(this,name,parent,...rest)};
const route=require('../app/api/signals/route.ts');Module._load=saved;
const request=config=>new Request('http://localhost/api/signals',{method:'PUT',body:JSON.stringify(config)});
test('established capital baseline cannot be silently replaced through signal settings',async()=>{state=initialState();state.config.capital=1500;const result=await route.PUT(request({...state.config,capital:2000}));assert.equal(result.status,400);assert.match((await result.json()).error,/Kapitalbasis/);assert.equal(state.config.capital,1500)});
test('other signal settings remain editable while monitoring stays paused',async()=>{state=initialState();state.config.capital=1500;const result=await route.PUT(request({...state.config,broker:'comdirect · Stuttgart'}));assert.equal(result.status,200);assert.equal(state.config.capital,1500);assert.equal(state.config.enabled,false);assert.equal(state.config.broker,'comdirect · Stuttgart')});

test('approved delayed policy does not require a paid API key to configure monitoring',async()=>{const previousKey=process.env.MASSIVE_API_KEY;delete process.env.MASSIVE_API_KEY;try{state=initialState();Object.assign(state.config,{capital:1500,vixEntryPolicy:'delayed20',broker:'comdirect',opensAt:'08:00',closesAt:'22:00',productVerified:true,isin:'DE000TEST001',futureSymbol:'UXG7',futureName:'VX February 2027',futureExpiry:'2027-02-17',barrier:5});const result=await route.PUT(request({...state.config,enabled:true}));assert.equal(result.status,200);assert.equal(state.config.vixEntryPolicy,'delayed20');}finally{if(previousKey!==undefined)process.env.MASSIVE_API_KEY=previousKey;}});
test('older client saves preserve accepted delayed policy and a policy switch resets source crossing',async()=>{state=initialState();Object.assign(state.config,{capital:1500,vixEntryPolicy:'delayed20'});const config={...state.config};delete config.vixEntryPolicy;assert.equal((await route.PUT(request(config))).status,200);assert.equal(state.config.vixEntryPolicy,'delayed20');state.previousVix=16;state.previousVixAt='2026-11-17T11:00:00Z';state.armed=true;assert.equal((await route.PUT(request({...state.config,vixEntryPolicy:'realtime'}))).status,200);assert.equal(state.previousVix,null);assert.equal(state.previousVixAt,null);assert.equal(state.armed,false);});

test('switching an enabled delayed strategy to realtime still requires a configured paid key',async()=>{const before=process.env.MASSIVE_API_KEY;delete process.env.MASSIVE_API_KEY;try{state=initialState();Object.assign(state.config,{enabled:true,capital:1500,vixEntryPolicy:'delayed20',broker:'comdirect',opensAt:'08:00',closesAt:'22:00',productVerified:true,isin:'DE000TEST001',futureSymbol:'UXG7',futureName:'VX February2027',futureExpiry:'2027-02-17',barrier:5});const result=await route.PUT(request({...state.config,vixEntryPolicy:'realtime'}));assert.equal(result.status,400);assert.match((await result.json()).error,/Echtzeitzugang/);assert.equal(state.config.vixEntryPolicy,'delayed20');}finally{if(before!==undefined)process.env.MASSIVE_API_KEY=before;}});

test('threshold edits validate descending order and reset the entry crossing without changing alert thresholds', async () => {
  state = initialState();
  state.previousVix = 16;
  state.armed = true;
  assert.equal((await route.PUT(request({ ...state.config, entryLevels: [16, 16, 14] }))).status, 400);
  const before = audits.length;
  assert.equal((await route.PUT(request({ ...state.config, entryLevels: [17, 16, 14] }))).status, 200);
  assert.deepEqual(state.config.entryLevels, [17, 16, 14]);
  assert.deepEqual(state.config.notificationLevels, [15.5, 14.5, 13.5]);
  assert.equal(state.previousVix, null);
  assert.equal(state.armed, false);
  assert.equal(audits.length, before + 1);
  assert.deepEqual(audits.at(-1).data.config.entryLevels, [17, 16, 14]);
});

test('threshold alerts remain editable with an outstanding signal and can run without a product', async () => {
  state = initialState();
  Object.assign(state.config, { vixEntryPolicy: 'delayed20', broker: 'Test', opensAt: '08:00', closesAt: '22:00' });
  assert.equal((await route.PUT(request({ ...state.config, enabled: true }))).status, 200);
  state.signals.push({ status: 'pending' });
  state.levels = { sourceAt: '2026-11-20T15:00:00Z', below: [15.5, 14.5], events: [] };
  assert.equal((await route.PUT(request({ ...state.config, entryLevels: [17, 16, 14] }))).status, 400);
  assert.equal((await route.PUT(request({ ...state.config, notificationLevels: [17, 16, 15.5] }))).status, 200);
  assert.deepEqual(state.levels.below, [15.5]);
  assert.equal(state.levels.sourceAt, '2026-11-20T15:00:00Z');
});
