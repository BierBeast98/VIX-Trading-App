import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getVixSpot } from '@/lib/yahoo-finance';
import { withArchiveContext, persistenceError, trackedVontobel } from './capture';
import { compactMarketFetches } from './retention';
import { strategyArchiveTargets } from './targets';
import { archiveConfig, collectingNow } from './config';
export async function collectMarketData(now = new Date()){
 const config=await archiveConfig();
 if(!collectingNow(config,now))return {collected:false,reason:config.enabled?'outside_collection_window':'collection_paused'};
 const slot=String(Math.floor(now.getTime()/(config.intervalMinutes*60000)));
 const id=crypto.randomUUID(),leaseUntil=new Date(now.getTime()+120000);
 let claimed=false,runId=id;
 try{await prisma.marketCollectionRun.create({data:{id,slot,startedAt:now,leaseUntil,status:'running'}});claimed=true;}
 catch(e){if(!(e instanceof Prisma.PrismaClientKnownRequestError)||e.code!=='P2002')throw e;
  const prior=await prisma.marketCollectionRun.findUniqueOrThrow({where:{slot}});runId=prior.id;
  if(prior.status==='completed'||prior.status==='partial')return {collected:false,reason:'slot_already_completed'};
  // An expired worker lease can be reclaimed once; concurrent workers use a compare-and-set.
  const updated=await prisma.marketCollectionRun.updateMany({where:{id:prior.id,leaseUntil:{lt:now}},data:{leaseUntil,status:'running',attempts:{increment:1}}});claimed=updated.count===1;
 }
 if(!claimed)return {collected:false,reason:'collection_in_progress'};
 try{
  const targets = await strategyArchiveTargets();
  const captureFailure = await withArchiveContext({origin:'collector',runId,slot},async()=>{
   await Promise.allSettled([
    getVixSpot({ allowRealtime: false }),
    ...targets.map(target => trackedVontobel(
      `https://markets.vontobel.com/de-de/produkte/hebel/mini-futures/${target.isin}`,
      { signal: AbortSignal.timeout(12000) },
      target,
    )),
   ]);
   return persistenceError();
  });
  const [calls,failed]=await Promise.all([prisma.marketFetch.count({where:{runId}}),prisma.marketFetch.count({where:{runId,OR:[{success:false},{errorCode:{not:null}}]}})]);
  const expected=1+targets.length;
  const status=calls<expected||captureFailure?'failed':failed?'partial':'completed';
  await prisma.marketCollectionRun.update({where:{id:runId},data:{status,finishedAt:new Date(),errorCode:status==='failed'?'capture_incomplete':null}});
  // A maintenance error cannot invalidate a market-data run already persisted.
  if (Number(slot) % 12 === 0) {
   try { await compactMarketFetches(now); }
   catch { console.error('[market-archive] fetch retention maintenance failed'); }
  }
  return {collected:true,status,calls,failed};
 }catch{await prisma.marketCollectionRun.update({where:{id:runId},data:{status:'failed',finishedAt:new Date(),errorCode:'collection_error'}});throw new Error('Datensammlung fehlgeschlagen');}
}
