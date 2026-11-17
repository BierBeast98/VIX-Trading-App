import { NextRequest,NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { allowed } from '@/lib/signals/auth';
import { archiveConfig } from '@/lib/archive/config';
import { archiveRange } from '@/lib/archive/query';
import { persistenceError } from '@/lib/archive/capture';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 if(!allowed(req))return NextResponse.json({error:'Bitte Archivbereich entsperren',configured:!!process.env.SIGNALS_ACCESS_KEY},{status:401});
 try{
  const r=archiveRange(req.nextUrl.searchParams);
  const pointsWhere={receivedAt:{gte:r.from,lte:r.to},...(r.instrument?{instrument:r.instrument}:{}),...(r.source?{source:r.source}:{})};
  const fetchWhere={startedAt:{gte:r.from,lte:r.to},...(r.instrument?{instrument:r.instrument}:{}),...(r.source?{source:r.source}:{})};
  const [config,totalPoints,totalFetches,points,quality,requests,failed,sdkCalls,httpCalls,volumes,streams,daily,lastRuns,lastPoints,storage]=await Promise.all([
   archiveConfig(),prisma.marketObservation.count(),prisma.marketFetch.count(),prisma.marketObservation.count({where:pointsWhere}),
   prisma.marketObservation.groupBy({by:['quality'],where:pointsWhere,_count:{_all:true}}),
   prisma.marketFetch.count({where:fetchWhere}),prisma.marketFetch.count({where:{...fetchWhere,success:false}}),
   prisma.marketFetch.count({where:{...fetchWhere,measurement:'sdk_call'}}),prisma.marketFetch.count({where:{...fetchWhere,measurement:'http_request'}}),
   prisma.marketFetch.aggregate({where:fetchWhere,_sum:{responseBytes:true,returnedPoints:true,insertedPoints:true},_avg:{durationMs:true}}),
   prisma.marketObservation.groupBy({by:['source','instrument','kind','contract'],where:pointsWhere,_count:{_all:true},_min:{sourceAt:true,receivedAt:true},_max:{sourceAt:true,receivedAt:true},orderBy:{instrument:'asc'}}),
   prisma.$queryRaw<{day:string;calls:number;failed:number;bytes:number}[]>`SELECT to_char("startedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Berlin','YYYY-MM-DD') AS day, COUNT(*)::int AS calls, COUNT(*) FILTER (WHERE NOT success)::int AS failed, COALESCE(SUM("responseBytes"),0)::float8 AS bytes FROM "MarketFetch" WHERE "startedAt">=${r.from} AND "startedAt"<=${r.to} AND (${r.source}='' OR source=${r.source}) AND (${r.instrument}='' OR instrument=${r.instrument}) GROUP BY day ORDER BY day DESC LIMIT 366`,
   prisma.marketCollectionRun.findMany({orderBy:{startedAt:'desc'},take:8}),
   prisma.marketObservation.findMany({where:pointsWhere,orderBy:{id:'desc'},take:12,select:{id:true,source:true,instrument:true,kind:true,sourceAt:true,receivedAt:true,quality:true,bid:true,ask:true,last:true,close:true}}),
   prisma.$queryRaw<{bytes:number}[]>`SELECT (pg_total_relation_size('"MarketObservation"')+pg_total_relation_size('"MarketFetch"')+pg_total_relation_size('"MarketCollectionRun"'))::float8 AS bytes`,
  ]);
  const {tokenHash:_,...publicConfig}=config;void _;
  return NextResponse.json({config:publicConfig,totalPoints,totalFetches,points,quality,requests,failed,sdkCalls,httpCalls,
   responseBytes:volumes._sum.responseBytes??0,returnedPoints:volumes._sum.returnedPoints??0,insertedPoints:volumes._sum.insertedPoints??0,averageMs:volumes._avg.durationMs??0,
   streams,daily,lastRuns,lastPoints:lastPoints.map(p=>({...p,id:String(p.id)})),storageBytes:storage[0]?.bytes??0,
   persistenceErrorAt:persistenceError(),from:r.from,to:r.to,
   measurementNote:'Gezählt werden direkte Massive- und Vontobel-HTTP-Aufrufe sowie Yahoo-SDK-Aufrufe. Interne Yahoo-HTTP-Aufrufe und deren Bytes sind nicht erfasst. Bytes bezeichnen die dekomprimierte Antwortgröße der direkten Massive- und Vontobel-Aufrufe, nicht den gesamten Netzwerkverkehr.',
   retentionNote:'Keine automatische Löschung. Speicherung ab Einrichtung; keine rückwirkend erfundenen Abrufzahlen. Die ältere generische FUTURES-Tabelle bleibt getrennt, weil Kontrakt und mögliche VIX3M-Fallbacks dort nicht eindeutig sind.',
  },{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Archivdaten konnten nicht geladen werden. Datenbankeinrichtung und Filter prüfen.'},{status:503});}
}
