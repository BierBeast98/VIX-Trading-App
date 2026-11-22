const {test}=require('node:test');const assert=require('node:assert/strict');
if(!/^postgresql:\/\/[^/]*@127\.0\.0\.1:55439\/vix_archive_test$/.test(process.env.DATABASE_URL??''))throw new Error('Refusing test outside disposable local DB');
require('./load-ts.cjs');
const {prisma}=require('../lib/prisma.ts');const capture=require('../lib/archive/capture.ts');
const yahoo=require('../lib/yahoo-finance.ts');
yahoo.getVixSpot=()=>capture.trackedYahoo('^VIX','quote',async()=>({regularMarketPrice:20,regularMarketTime:new Date()}));
const {collectMarketData}=require('../lib/archive/collector.ts');
const {archiveDefaults}=require('../lib/archive/config.ts');
const { initialState }=require('../lib/signals/engine.ts');
const { compactMarketFetches, dailyMarketFetches, marketFetchTotal }=require('../lib/archive/retention.ts');
test('archive persists requests, deduplicates rows, separates source failures and serializes collectors',async()=>{
 const originalFetch=global.fetch;
 try{
  await prisma.trade.deleteMany();await prisma.position.deleteMany();
  await prisma.marketObservation.deleteMany();await prisma.marketFetch.deleteMany();await prisma.marketCollectionRun.deleteMany();
  await prisma.$executeRaw`DELETE FROM "MarketFetchDaily"`;
  const initial = initialState();
  initial.config = { ...initial.config, isin: 'DE000BD11R44', productVerified: true, futureSymbol: 'UXZ6', futureExpiry: '2026-12-16', barrier: 12.1 };
  await prisma.vixCache.upsert({ where: {id:'manual_strategy_v1'}, create: {id:'manual_strategy_v1', data:initial}, update: {data:initial} });
  const at=new Date();const sample={source:'yahoo',instrument:'YAHOO:^VIX',kind:'index_quote',last:20,sourceAt:at.toISOString()};
  for(const id of ['fetch-a','fetch-b'])await capture.persistFetch({id,source:'yahoo',operation:'quote',instrument:'YAHOO:^VIX',startedAt:at,success:true,measurement:'sdk_call',samples:[sample]});
  assert.equal(await prisma.marketObservation.count(),1);assert.equal(await prisma.marketFetch.count(),2);
  assert.equal((await prisma.marketFetch.findUnique({where:{id:'fetch-b'}})).insertedPoints,0);
  await capture.persistFetch({id:'fetch-c',source:'yahoo',operation:'quote',instrument:'YAHOO:^VIX',startedAt:at,success:true,measurement:'sdk_call',samples:[{...sample,last:21}]});assert.equal(await prisma.marketObservation.count(),2);
  global.fetch=async()=>{throw new Error('simulated network failure')};await assert.rejects(capture.trackedVontobel('https://markets.vontobel.com/de-de/produkte/hebel/mini-futures/DE000BD11R44'));assert.equal(await prisma.marketFetch.count({where:{success:false}}),1);
  await prisma.vixCache.upsert({where:{id:'market_archive_config_v1'},create:{id:'market_archive_config_v1',data:{...archiveDefaults,enabled:true,opensAt:'00:00',closesAt:'23:59'}},update:{data:{...archiveDefaults,enabled:true,opensAt:'00:00',closesAt:'23:59'}}});
  let physicalCalls=0, active=true;
  const requestedIsins = [];
  const sourceAt=at.toISOString();
  global.fetch=async(url)=>{
    assert.doesNotMatch(String(url),/\/api\//);
    physicalCalls++;
    const isin = String(url).split('/').at(-1);
    requestedIsins.push(isin);
    const body={props:{pageProps:{additionalData:{
      data:{isin,isActive:active,currency:'EUR',direction:1,stopLoss:12.1},
      price:{bid:.93,ask:.94,latestTimestamp:sourceAt},
      underlyings:[{symbol:'UXZ6',price:{latest:22,latestTimestamp:sourceAt,currency:'USD'}}],
    }}}};
    return new Response(`<script>${JSON.stringify(body)}</script>`);
  };
  const monday = new Date('2026-11-16T14:00:00Z');
  const result=await Promise.all([collectMarketData(monday),collectMarketData(monday)]);
  assert.equal(result.filter(r=>r.collected).length,1);assert.equal(physicalCalls,1);
  assert.equal(await prisma.marketCollectionRun.count(),1);
  assert.equal(await prisma.marketFetch.count({where:{origin:'collector'}}),2);
  const pair=await prisma.marketObservation.findMany({where:{kind:{in:['strategy_vx_quote','strategy_certificate_quote']}}});
  assert.equal(pair.length,2);assert.equal(pair[0].fetchId,pair[1].fetchId);
  assert.equal(pair.find(row=>row.contract==='UXZ6').metadata.futureExpiry,'2026-12-16');
  assert.equal(await prisma.marketObservation.count({where:{kind:'unverified_underlying_point'}}),0);
  const repeat=await collectMarketData(monday);
  assert.equal(repeat.collected,false);assert.equal(physicalCalls,1);
  await collectMarketData(new Date('2026-11-16T14:05:00Z'));
  assert.equal(await prisma.marketObservation.count({where:{kind:'strategy_vx_quote'}}),2);
  assert.equal(await prisma.marketObservation.count({where:{kind:'strategy_product_status'}}),1);
  active=false;
  await collectMarketData(new Date('2026-11-16T14:10:00Z'));
  const statuses=await prisma.marketObservation.findMany({where:{kind:'strategy_product_status'},orderBy:{id:'asc'}});
  assert.deepEqual(statuses.map(row=>row.metadata.status),['active','inactive']);
  assert.equal(await prisma.marketObservation.count({where:{kind:'strategy_certificate_quote'}}),2);

  const before=await marketFetchTotal();
  const old = new Date('2025-07-15T22:30:00Z');
  await prisma.marketFetch.create({data:{id:'old-fetch',source:'yahoo',operation:'quote',instrument:'YAHOO:^VIX',origin:'app',measurement:'sdk_call',startedAt:old,finishedAt:old,durationMs:7,success:false,responseBytes:20,returnedPoints:3,insertedPoints:1}});
  const range={from:new Date('2025-07-15T22:00:00Z'),to:new Date('2025-07-16T21:59:59Z'),source:'yahoo',instrument:'YAHOO:^VIX'};
  const [dayBefore]=await dailyMarketFetches(range);
  assert.equal(dayBefore.day,'2025-07-16');
  await Promise.all([compactMarketFetches(at),compactMarketFetches(at),compactMarketFetches(at)]);
  assert.equal(await prisma.marketFetch.count({where:{id:'old-fetch'}}),0);
  assert.equal(await marketFetchTotal(), before+1);
  const [dayAfter]=await dailyMarketFetches(range);
  assert.deepEqual(dayAfter,dayBefore);
  assert.deepEqual([dayAfter.calls,dayAfter.failed,dayAfter.bytes,dayAfter.durationMs,dayAfter.returnedPoints,dayAfter.insertedPoints],[1,1,20,7,3,1]);
  const { NextRequest } = require('next/server');
  const { GET: getArchive } = require('../app/api/archive/route.ts');
  const { GET: getArchiveExport } = require('../app/api/archive/export/route.ts');
  const accessKey = crypto.randomUUID();
  const previousKey = process.env.SIGNALS_ACCESS_KEY;
  process.env.SIGNALS_ACCESS_KEY = accessKey;
  const filter = new URLSearchParams({from:range.from.toISOString(),to:range.to.toISOString(),source:range.source,instrument:range.instrument});
  const headers = { authorization: `Bearer ${accessKey}` };
  try {
   const data = await getArchive(new NextRequest(`http://localhost/api/archive?${filter}`,{headers}));
   assert.equal(data.status, 200);
   const summary = await data.json();
   assert.deepEqual(summary.daily, [{day:'2025-07-16',calls:1,failed:1,bytes:20}]);
   assert.equal(summary.requests,1);
   assert.deepEqual(summary.config.isins,['DE000BD11R44']);
   const csv = await getArchiveExport(new NextRequest(`http://localhost/api/archive/export?${filter}&type=days`,{headers}));
   assert.equal(csv.status,200);
   assert.match(await csv.text(),/"2025-07-16";"yahoo";"YAHOO:\^VIX";"sdk_call";"1";"1";"20"/);
   const recent = await getArchiveExport(new NextRequest('http://localhost/api/archive/export?type=quotes&instrument=VX:UXZ6',{headers}));
   assert.equal(recent.status,200);
   const quotes = await recent.text();
   assert.match(quotes,/^id;fetchId;source/);
   assert.match(quotes,/strategy_vx_quote/);
   assert.match(quotes,/futureExpiry/);
  } finally {
   if (previousKey === undefined) delete process.env.SIGNALS_ACCESS_KEY;
   else process.env.SIGNALS_ACCESS_KEY = previousKey;
  }
  const heldIsin = 'DE000VJ4MNF2';
  active=true;
  await prisma.position.create({data:{certificateId:heldIsin,entryPrice:1,barrierLevel:12,currentBarrier:12,leverageRatio:2,status:'open'}});
  const standalone = await prisma.trade.create({data:{certificateId:heldIsin,entryDate:at,barrierLevel:12}});
  await prisma.trade.create({data:{certificateId:'DE000VJ4MNF3',entryDate:at,barrierLevel:12}});
  const beforeHeld = requestedIsins.length;
  await collectMarketData(new Date('2026-11-16T14:15:00Z'));
  assert.deepEqual(requestedIsins.slice(beforeHeld).sort(), ['DE000BD11R44', heldIsin]);
  const held = await prisma.marketObservation.findFirstOrThrow({where:{isin:heldIsin,kind:'strategy_certificate_quote'}});
  assert.equal(held.metadata.status,'active_unmapped');assert.equal(held.contract,null);
  assert.equal(await prisma.marketObservation.count({where:{isin:heldIsin,kind:'strategy_vx_quote'}}),0);
  await prisma.position.updateMany({where:{certificateId:heldIsin},data:{status:'closed'}});
  await prisma.trade.update({where:{id:standalone.id},data:{exitDate:at}});
  const beforeClose = requestedIsins.length;
  await collectMarketData(new Date('2026-11-16T14:20:00Z'));
  assert.deepEqual(requestedIsins.slice(beforeClose),['DE000BD11R44']);
  console.log('DB archive verified; no real provider requests issued');
 }finally{global.fetch=originalFetch;await prisma.$disconnect()}
});
