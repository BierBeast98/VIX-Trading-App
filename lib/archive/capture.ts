import { AsyncLocalStorage } from 'node:async_hooks';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { quality, sampleKey, yahooSamples, vontobelSamples, type Sample } from './normalize';
type Context = { origin: string; runId?: string; slot?: string };
const context = new AsyncLocalStorage<Context>();
export function withArchiveContext<T>(value: Context, fn: () => T): T { return context.run(value, fn); }
let lastPersistenceError: string | null = null;
export function persistenceError() { return lastPersistenceError; }
export async function persistFetch(input: { id: string; source: string; operation: string; instrument: string;
  startedAt: Date; success: boolean; measurement: string; httpStatus?: number; responseBytes?: number; errorCode?: string; samples: Sample[] }) {
  const finishedAt = new Date(), ctx = context.getStore();
  try {
    await prisma.$transaction(async tx => {
      // Persist new VIX observations only; request statistics remain available for all sources.
      const rows = input.samples.filter(s => s.instrument === 'YAHOO:^VIX' || s.instrument === 'MASSIVE:I:VIX').map(s => ({ key: ctx?.origin === 'collector' && ctx.slot && s.instrument === 'YAHOO:^VIX' && s.kind === 'index_quote' ? `collector-vix:${ctx.slot}` : sampleKey(s,input.id),fetchId:input.id,source:s.source,instrument:s.instrument,kind:s.kind,
        currency:s.currency ?? null,isin:s.isin ?? null,contract:s.contract ?? null,sourceAt:s.sourceAt ? new Date(s.sourceAt) : null,
        receivedAt:finishedAt,quality:quality(s,finishedAt),last:s.last ?? null,bid:s.bid ?? null,ask:s.ask ?? null,
        open:s.open ?? null,high:s.high ?? null,low:s.low ?? null,close:s.close ?? null,volume:s.volume ?? null,
        metadata:({ ...s.metadata, ...(ctx?.origin === 'collector' && ctx.slot ? { archiveSlot: ctx.slot } : {}) }) as Prisma.InputJsonValue }));
      const inserted = rows.length ? (await tx.marketObservation.createMany({data:rows,skipDuplicates:true})).count : 0;
      await tx.marketFetch.create({data:{id:input.id,runId:ctx?.runId ?? null,source:input.source,operation:input.operation,instrument:input.instrument,
        origin:ctx?.origin ?? 'app',measurement:input.measurement,startedAt:input.startedAt,finishedAt,
        durationMs:Math.min(2147483647,Math.max(0,finishedAt.getTime()-input.startedAt.getTime())),success:input.success,
        httpStatus:input.httpStatus ?? null,responseBytes:input.responseBytes ?? null,returnedPoints:input.samples.length,insertedPoints:inserted,errorCode:input.errorCode ?? null}});
    },{timeout:20000});
    lastPersistenceError = null;
  } catch {
    lastPersistenceError = new Date().toISOString();
    console.error('[market-archive] persistence failed; source result preserved');
  }
}
export async function trackedYahoo<T>(symbol: string, operation: string, fn: () => Promise<T>): Promise<T> {
  const id=crypto.randomUUID(),startedAt=new Date();
  let value: T;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { value=await Promise.race([fn(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Source timeout')),30000);})]); }
  catch(e) { await persistFetch({id,source:'yahoo',operation,instrument:`YAHOO:${symbol}`,startedAt,success:false,measurement:'sdk_call',errorCode:'source_error',samples:[]});throw e; }
  finally { if(timer)clearTimeout(timer); }
  let samples: Sample[]=[];
  try { samples=yahooSamples(symbol,operation,value); } catch { /* source shape remains visible as zero points */ }
  await persistFetch({id,source:'yahoo',operation,instrument:`YAHOO:${symbol}`,startedAt,success:true,measurement:'sdk_call',samples,errorCode:samples.length ? undefined : 'no_supported_points'});
  return value;
}
/** All direct Vontobel HTTP requests are counted once, including failures; HTML is not retained. */
export async function trackedVontobel(url: string, options?: RequestInit): Promise<Response> {
  const id=crypto.randomUUID(),startedAt=new Date();
  const isin=url.match(/\/([A-Z]{2}[A-Z0-9]{10})(?:[/?]|$)/)?.[1] ?? 'unknown';
  const type=url.includes('/api/') ? 'chart' : 'page';
  let response: Response;
  try { response=await fetch(url,{...options,cache:'no-store'}); }
  catch(e) { await persistFetch({id,source:'vontobel',operation:type,instrument:`ISIN:${isin}`,startedAt,success:false,measurement:'http_request',errorCode:'network_error',samples:[]});throw e; }
  let samples:Sample[]=[],bytes:number|undefined,errorCode:string|undefined;
  try { const text=await response.clone().text();bytes=Buffer.byteLength(text,'utf8');if(response.ok)samples=vontobelSamples(text,isin,type); }
  catch { errorCode='payload_parse_error'; }
  if(!response.ok)errorCode=`http_${response.status}`;
  else if(!samples.length&&!errorCode)errorCode='no_supported_points';
  await persistFetch({id,source:'vontobel',operation:type,instrument:`ISIN:${isin}`,startedAt,success:response.ok && !errorCode,measurement:'http_request',httpStatus:response.status,responseBytes:bytes,samples,errorCode});
  return response;
}
