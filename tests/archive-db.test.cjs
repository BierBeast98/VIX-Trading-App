const {test}=require('node:test');const assert=require('node:assert/strict');
if(!/^postgresql:\/\/[^/]*@127\.0\.0\.1:55439\/vix_signals_test$/.test(process.env.DATABASE_URL??''))throw new Error('Refusing test outside disposable local DB');
require('./load-ts.cjs');
const {prisma}=require('../lib/prisma.ts');const capture=require('../lib/archive/capture.ts');
const yahoo=require('../lib/yahoo-finance.ts');
yahoo.getVixSpot=()=>capture.trackedYahoo('^VIX','quote',async()=>({regularMarketPrice:20,regularMarketTime:new Date()}));
const {collectMarketData}=require('../lib/archive/collector.ts');
const {archiveDefaults}=require('../lib/archive/config.ts');
test('archive persists requests, deduplicates rows, separates source failures and serializes collectors',async()=>{
 const originalFetch=global.fetch;
 try{
  await prisma.marketObservation.deleteMany();await prisma.marketFetch.deleteMany();await prisma.marketCollectionRun.deleteMany();
  const at=new Date();const sample={source:'yahoo',instrument:'YAHOO:^VIX',kind:'index_quote',last:20,sourceAt:at.toISOString()};
  for(const id of ['fetch-a','fetch-b'])await capture.persistFetch({id,source:'yahoo',operation:'quote',instrument:'YAHOO:^VIX',startedAt:at,success:true,measurement:'sdk_call',samples:[sample]});
  assert.equal(await prisma.marketObservation.count(),1);assert.equal(await prisma.marketFetch.count(),2);
  assert.equal((await prisma.marketFetch.findUnique({where:{id:'fetch-b'}})).insertedPoints,0);
  await capture.persistFetch({id:'fetch-c',source:'yahoo',operation:'quote',instrument:'YAHOO:^VIX',startedAt:at,success:true,measurement:'sdk_call',samples:[{...sample,last:21}]});assert.equal(await prisma.marketObservation.count(),2);
  global.fetch=async()=>{throw new Error('simulated network failure')};await assert.rejects(capture.trackedVontobel('https://markets.vontobel.com/de-de/produkte/hebel/mini-futures/DE000BD11R44'));assert.equal(await prisma.marketFetch.count({where:{success:false}}),1);
  await prisma.vixCache.upsert({where:{id:'market_archive_config_v1'},create:{id:'market_archive_config_v1',data:{...archiveDefaults,enabled:true,opensAt:'00:00',closesAt:'23:59'}},update:{data:{...archiveDefaults,enabled:true,opensAt:'00:00',closesAt:'23:59'}}});
  let physicalCalls=0;
  global.fetch=async(url)=>{physicalCalls++;if(String(url).includes('/api/'))return new Response(JSON.stringify({payload:{series:[{isProduct:true,points:[{timestamp:Date.now(),bid:.93}]},{isProduct:false,points:[{timestamp:Date.now(),close:22}]}]}}));const body={props:{pageProps:{additionalData:{data:{isin:'DE000BD11R44',isActive:true,currency:'EUR'},price:{bid:.93,ask:.94,latestTimestamp:new Date().toISOString()},underlyings:[{symbol:'UXZ6',price:{latest:22,latestTimestamp:new Date().toISOString()}}]}}}};return new Response(`<script>${JSON.stringify(body)}</script>`)};
  const result=await Promise.all([collectMarketData(),collectMarketData()]);assert.equal(result.filter(r=>r.collected).length,1);assert.equal(physicalCalls,2);assert.equal(await prisma.marketCollectionRun.count(),1);assert.equal(await prisma.marketFetch.count({where:{origin:'collector'}}),3);assert.ok(await prisma.marketObservation.count({where:{instrument:'VX:UXZ6'}}));
  const data=await prisma.marketObservation.findFirst({where:{instrument:'UNVERIFIED_UNDERLYING_SERIES:DE000BD11R44'}});assert.equal(data.quality,'unverified_contract');assert.equal(data.contract,null);
  // A completed slot never repeats source requests.
  const repeat=await collectMarketData();assert.equal(repeat.collected,false);assert.equal(physicalCalls,2);
  console.log('DB archive verified; no real provider requests issued');
 }finally{global.fetch=originalFetch;await prisma.$disconnect()}
});
