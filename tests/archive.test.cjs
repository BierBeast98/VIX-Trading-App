const {test}=require('node:test');const assert=require('node:assert/strict');require('./load-ts.cjs');
const {sampleKey,quality,iso,yahooSamples,vontobelSamples,csvCell}=require('../lib/archive/normalize.ts');
const {collectingNow,archiveDefaults}=require('../lib/archive/config.ts');
const at=new Date('2026-11-17T14:00:00Z');
const sample={source:'vontobel',instrument:'VX:UXZ6',contract:'UXZ6',kind:'future_quote',sourceAt:at.toISOString(),last:22.3};
test('exact repeated source observations deduplicate across fetches; price revisions remain distinct',()=>{assert.equal(sampleKey(sample,'a'),sampleKey(sample,'b'));assert.notEqual(sampleKey(sample,'a'),sampleKey({...sample,last:22.4},'a'));});
test('different contracts never merge and missing timestamp observations remain separate',()=>{assert.notEqual(sampleKey(sample,'a'),sampleKey({...sample,contract:'UXF7',instrument:'VX:UXF7'},'a'));assert.notEqual(sampleKey({...sample,sourceAt:null},'a'),sampleKey({...sample,sourceAt:null},'b'));});
test('quality distinguishes stale, unknown and future source times without inventing timestamps',()=>{assert.equal(quality(sample,at),'fresh');assert.equal(quality(sample,new Date(at.getTime()+360000)),'stale');assert.equal(quality({...sample,sourceAt:null},at),'missing_timestamp');assert.equal(quality({...sample,sourceAt:'2026-11-17T15:00:00Z'},at),'future_timestamp');assert.equal(iso(0),null);assert.equal(iso('invalid'),null);});
test('VIX3M is an explicitly labelled proxy index, never VX',()=>{const rows=yahooSamples('^VIX3M','quote',{regularMarketPrice:20,regularMarketTime:at});assert.equal(rows[0].kind,'index_proxy_quote');assert.equal(rows[0].metadata.proxyForVx,true);assert.equal(rows[0].contract,undefined);});
test('historical Yahoo bars retain real OHLC and timestamps',()=>{const rows=yahooSamples('^VIX','chart',{quotes:[{date:at,open:20,high:23,low:19,close:22,volume:0}]});assert.equal(rows[0].kind,'intraday_bar');assert.equal(rows[0].high,23);assert.equal(rows[0].quality,'historical');});
test('current issuer snapshot records contract identity and bid/ask separately',()=>{const m={props:{pageProps:{additionalData:{data:{isin:'DE000BD11R44',isActive:true,currency:'EUR',direction:1},price:{bid:.93,ask:.94,latestTimestamp:at.toISOString()},underlyings:[{symbol:'UXZ6',name:'Dec 2026',price:{latest:22.3,latestTimestamp:at.toISOString(),currency:'USD'}}]}}}};const rows=vontobelSamples(`<script>${JSON.stringify(m)}</script>`,'DE000BD11R44','page');assert.equal(rows[0].ask,.94);assert.equal(rows[1].contract,'UXZ6');assert.equal(rows[1].instrument,'VX:UXZ6');});
test('historical product underlying series is never falsely assigned to the current contract',()=>{const rows=vontobelSamples(JSON.stringify({payload:{series:[{isProduct:false,priceIdentifier:'generic',points:[{timestamp:at.getTime(),close:20}]},{isProduct:true,points:[{timestamp:at.getTime(),bid:.9}]}]}}),'DE000BD11R44','chart');assert.match(rows[0].instrument,/UNVERIFIED/);assert.equal(rows[0].contract,undefined);assert.equal(rows[0].quality,'unverified_contract');assert.equal(rows[1].open,undefined);});
test('CSV preserves separators and quotes and neutralizes spreadsheet formulas',()=>{assert.equal(csvCell('a;"b'),'"a;""b"');assert.equal(csvCell('=1+1'),'"\'=1+1"');assert.equal(csvCell(-2.5),'"-2.5"');assert.equal(csvCell(null),'""');});
test('scheduled collection respects Berlin time, holidays and weekends independently of trading flags',()=>{const c={...archiveDefaults,enabled:true};assert.equal(collectingNow(c,at),true);assert.equal(collectingNow({...c,closedDates:['2026-11-17']},at),false);assert.equal(collectingNow(c,new Date('2026-11-21T14:00:00Z')),false);assert.equal(collectingNow(c,new Date('2026-11-17T21:00:00Z')),false);assert.equal(collectingNow(c,new Date('2026-07-08T06:00:00Z')),true);});

const {archiveRange}=require('../lib/archive/query.ts');
test('archive filters accept Massive as a distinct source and preserve exact VIX instrument',()=>{
 const params=new URLSearchParams({from:'2026-11-17T00:00:00Z',to:'2026-11-17T23:59:59Z',source:'massive',instrument:'MASSIVE:I:VIX'});
 const range=archiveRange(params);assert.equal(range.source,'massive');assert.equal(range.instrument,'MASSIVE:I:VIX');
 for(const source of ['','yahoo','vontobel']){params.set('source',source);assert.equal(archiveRange(params).source,source);}
 params.set('source','unrecognized');assert.throws(()=>archiveRange(params));
});
test('Massive and Yahoo VIX observations remain separate even at the same timestamp and price',()=>{
 const massive={source:'massive',instrument:'MASSIVE:I:VIX',kind:'index_quote',sourceAt:at.toISOString(),last:15};
 const yahoo={...massive,source:'yahoo',instrument:'YAHOO:^VIX'};
 assert.notEqual(sampleKey(massive,'m'),sampleKey(yahoo,'y'));
});

test('Yahoo VIX quote remains explicitly delayed even when source timestamp looks fresh',()=>{const row=yahooSamples('^VIX','quote',{regularMarketPrice:20,regularMarketTime:at})[0];assert.equal(row.quality,'delayed');assert.equal(row.metadata.delayMinutes,15);assert.equal(quality(row,at),'delayed');});
