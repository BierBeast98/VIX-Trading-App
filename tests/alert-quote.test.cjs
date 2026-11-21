const {test}=require('node:test'); const assert=require('node:assert/strict'); require('./load-ts.cjs');
const {freshBid}=require('../lib/alert-quote.ts');
const now=Date.parse('2026-11-21T12:00:00Z'), ttl=30*60*1000;
test('legacy alerts use original issuer time and reject missing, stale and future bids',()=>{
 for(const timestamp of [null, undefined, 'invalid', now-ttl-1, now+60001]) assert.equal(freshBid({bid:1,timestamp},now,ttl),null);
 assert.equal(freshBid({bid:1,timestamp:now-ttl},now,ttl),1);
 assert.equal(freshBid({bid:1,timestamp:(now-1000)/1000},now,ttl),1);
 assert.equal(freshBid({bid:1,timestamp:new Date(now).toISOString()},now,ttl),1);
 assert.equal(freshBid({bid:0,timestamp:now},now,ttl),null);
});
