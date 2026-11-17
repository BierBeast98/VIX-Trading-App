const {test}=require('node:test'); const assert=require('node:assert/strict');const ts=require('typescript');const fs=require('node:fs');const Module=require('node:module');
const file=require('node:path').resolve('lib/capital.ts');const m=new Module(file,module);m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);const{capitalSummary}=m.exports;
const baseline={value:1500,startingCapital:1500,source:'strategy-baseline',asOf:'2026-11-17T10:00:00Z'};
const buy={side:'buy',at:'2026-11-17T11:00:00Z',quantity:100,price:4,fees:2};
const sell={side:'sell',at:'2026-11-18T11:00:00Z',quantity:100,price:5,fees:3};
test('new strategy does not inherit legacy snapshot or returns',()=>{assert.equal(capitalSummary({value:3700},null).startingCapital,null);const r=capitalSummary(baseline,{executions:[],round:null});assert.equal(r.currentCapital,1500);assert.equal(r.returnPct,0);assert.equal(r.availableCapital,1500)});
test('buy reserves acquisition cost including fees without creating loss',()=>{const r=capitalSummary(baseline,{executions:[buy],round:{startedAt:buy.at,lots:[{cost:402}]}});assert.equal(r.currentCapital,1500);assert.equal(r.availableCapital,1098);assert.equal(r.investedCapital,402)});
test('full exit realizes net gain after both fees exactly once',()=>{const r=capitalSummary(baseline,{executions:[sell,buy],round:null});assert.equal(r.currentCapital,1595);assert.equal(r.realizedPnlEur,95);assert.equal(r.availableCapital,1595)});
test('partial exit uses actual remaining allocated acquisition cost',()=>{const r=capitalSummary(baseline,{executions:[{...sell,quantity:50},buy],round:{startedAt:buy.at,lots:[{cost:201}]}});assert.equal(r.currentCapital,1546);assert.equal(r.availableCapital,1345);assert.equal(r.realizedPnlEur,46)});
test('pre-baseline execution does not affect strategy cash',()=>{const r=capitalSummary(baseline,{executions:[{...sell,at:'2026-07-10T10:00:00Z'}],round:null});assert.equal(r.currentCapital,1500)});

test("allocation capital follows current round or next-round config",()=>{assert.equal(capitalSummary(baseline,{config:{capital:1595},executions:[],round:null}).allocationCapital,1595);assert.equal(capitalSummary(baseline,{config:{capital:1595},executions:[],round:{capital:1500,startedAt:buy.at,lots:[]}}).allocationCapital,1500)});
