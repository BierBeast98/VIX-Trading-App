import { NextRequest,NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { allowed } from '@/lib/signals/auth';
import { csvCell } from '@/lib/archive/normalize';
import { archiveRange } from '@/lib/archive/query';
import { dailyMarketFetches } from '@/lib/archive/retention';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 if(!allowed(req))return NextResponse.json({error:'Bitte Archivbereich entsperren'},{status:401});
 try{
  const r=archiveRange(req.nextUrl.searchParams);const type=req.nextUrl.searchParams.get('type')??'quotes';if(!['quotes','requests','days'].includes(type))throw new Error('Exporttyp ungültig');
  const headers = { 'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="vix-${type}-${r.from.toISOString().slice(0,10)}-${r.to.toISOString().slice(0,10)}.csv"`,'Cache-Control':'no-store' };
  if (type === 'days') {
    const fields = ['day', 'source', 'instrument', 'measurement', 'calls', 'failed', 'bytes', 'durationMs', 'returnedPoints', 'insertedPoints'] as const;
    const rows = await dailyMarketFetches(r);
    const lines = rows.map(row => fields.map(field => csvCell(row[field])).join(';'));
    return new Response('\ufeff' + [fields.join(';'), ...lines].join('\r\n') + '\r\n', { headers });
  }
  const fields=type==='quotes'?['id','fetchId','source','instrument','kind','currency','isin','contract','sourceAt','receivedAt','quality','last','bid','ask','open','high','low','close','volume','metadata']:['id','source','operation','instrument','origin','measurement','startedAt','finishedAt','durationMs','success','httpStatus','responseBytes','returnedPoints','insertedPoints','errorCode'];
  const enc=new TextEncoder();let cancelled=false,header=false,cursor=0n,fetchCursor:{id:string;startedAt:Date}|undefined;
  const stream=new ReadableStream({async pull(controller){
   if(cancelled)return;
   if(req.signal.aborted){controller.close();return;}
   try{
    if(!header){header=true;controller.enqueue(enc.encode('\ufeff'+fields.join(';')+'\r\n'));return;}
    const rows=type==='quotes'?await prisma.marketObservation.findMany({where:{id:{gt:cursor},receivedAt:{gte:r.from,lte:r.to},...(r.instrument?{instrument:r.instrument}:{}),...(r.source?{source:r.source}:{})},orderBy:{id:'asc'},take:1000}):await prisma.marketFetch.findMany({where:{startedAt:{gte:r.from,lte:r.to},...(r.instrument?{instrument:r.instrument}:{}),...(r.source?{source:r.source}:{}),...(fetchCursor?{OR:[{startedAt:{gt:fetchCursor.startedAt}},{startedAt:fetchCursor.startedAt,id:{gt:fetchCursor.id}}]}:{})},orderBy:[{startedAt:'asc'},{id:'asc'}],take:1000});
    if(cancelled)return;
    if(!rows.length){controller.close();return;}
    const text=rows.map(row=>fields.map(field=>{const value=(row as unknown as Record<string,unknown>)[field];return csvCell(value instanceof Date?value.toISOString():field==='metadata'?JSON.stringify(value):value)}).join(';')).join('\r\n')+'\r\n';
    controller.enqueue(enc.encode(text));
    if(type==='quotes')cursor=rows[rows.length-1].id as bigint;else fetchCursor=rows[rows.length-1] as {id:string;startedAt:Date};
    if(rows.length<1000)controller.close();
   }catch{if(!cancelled)controller.error(new Error('Export unterbrochen; Datei möglicherweise unvollständig'));}
  },cancel(){cancelled=true;}});
  return new Response(stream,{headers});
 }catch{return NextResponse.json({error:'Exportfilter bitte prüfen (ISO-Zeitstempel)'},{status:400});}
}
