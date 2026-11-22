import { AsyncLocalStorage } from 'node:async_hooks';
import { prisma } from '@/lib/prisma';
import { eligibleArchiveTarget, strategyIssuerPageSamples, strategyIssuerSamples, type ArchiveTarget } from './strategy-samples';
import { quality, sampleKey, yahooSamples, vontobelSamples, type Sample } from './normalize';
type Context = { origin: string; runId?: string; slot?: string; persistenceFailure?: string | null };
const context = new AsyncLocalStorage<Context>();
export function withArchiveContext<T>(value: Context, fn: () => T): T { return context.run({ ...value, persistenceFailure: null }, fn); }
let lastPersistenceError: string | null = null;
export function persistenceError() { const active = context.getStore(); return active ? active.persistenceFailure ?? null : lastPersistenceError; }
export async function persistFetch(input: { id: string; source: string; operation: string; instrument: string;
  startedAt: Date; success: boolean; measurement: string; httpStatus?: number; responseBytes?: number; errorCode?: string; samples: Sample[] }) {
  const finishedAt = new Date(), ctx = context.getStore();
  try {
    await prisma.$transaction(async tx => {
      const retained = [];
      for (const sample of input.samples) {
        const isVix = sample.instrument === 'YAHOO:^VIX' || sample.instrument === 'MASSIVE:I:VIX';
        const isStrategySnapshot = sample.kind === 'strategy_vx_quote' || sample.kind === 'strategy_certificate_quote';
        const isProductStatus = sample.kind === 'strategy_product_status';
        if (!isVix && !isStrategySnapshot && !isProductStatus) continue;
        if (isProductStatus) {
          // Serialize status changes for this ISIN across collector and signal workers.
          await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`market-product:${sample.instrument}`}, 0))`;
          const previous = await tx.marketObservation.findFirst({
            where: { instrument: sample.instrument, kind: sample.kind }, orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
            select: { receivedAt: true, metadata: true },
          });
          const sameMetadata = Object.entries(sample.metadata ?? {}).every(([key, value]) =>
            (previous?.metadata as Record<string, unknown> | null)?.[key] === value);
          if (previous && (previous.receivedAt > finishedAt || sameMetadata)) continue;
        }
        retained.push({
          key: ctx?.origin === 'collector' && ctx.slot && sample.instrument === 'YAHOO:^VIX' && sample.kind === 'index_quote'
            ? `collector-vix:${ctx.slot}`
            : isStrategySnapshot || isProductStatus
              ? `${sample.kind}:${sample.instrument}:${input.id}`
              : sampleKey(sample, input.id),
          fetchId: input.id, source: sample.source, instrument: sample.instrument, kind: sample.kind,
          currency: sample.currency ?? null, isin: sample.isin ?? null, contract: sample.contract ?? null,
          sourceAt: sample.sourceAt ? new Date(sample.sourceAt) : null, receivedAt: finishedAt,
          quality: isProductStatus ? 'status_observed' : quality(sample, finishedAt),
          last: sample.last ?? null, bid: sample.bid ?? null, ask: sample.ask ?? null,
          open: sample.open ?? null, high: sample.high ?? null, low: sample.low ?? null,
          close: sample.close ?? null, volume: sample.volume ?? null,
          metadata: { ...sample.metadata, ...(ctx?.origin === 'collector' && ctx.slot ? { archiveSlot: ctx.slot } : {}) },
        });
      }
      const inserted = retained.length ? (await tx.marketObservation.createMany({ data: retained, skipDuplicates: true })).count : 0;
      await tx.marketFetch.create({data:{id:input.id,runId:ctx?.runId ?? null,source:input.source,operation:input.operation,instrument:input.instrument,
        origin:ctx?.origin ?? 'app',measurement:input.measurement,startedAt:input.startedAt,finishedAt,
        durationMs:Math.min(2147483647,Math.max(0,finishedAt.getTime()-input.startedAt.getTime())),success:input.success,
        httpStatus:input.httpStatus ?? null,responseBytes:input.responseBytes ?? null,returnedPoints:input.samples.filter(s => s.kind !== 'strategy_product_status' || s.metadata?.status !== 'unavailable').length,insertedPoints:inserted,errorCode:input.errorCode ?? null}});
    },{timeout:20000});
  } catch {
    lastPersistenceError = new Date().toISOString();
    if (ctx) ctx.persistenceFailure = lastPersistenceError;
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
export async function trackedVontobel(url: string, options?: RequestInit, target?: ArchiveTarget): Promise<Response> {
  const id=crypto.randomUUID(),startedAt=new Date();
  const isin=url.match(/\/([A-Z]{2}[A-Z0-9]{10})(?:[/?]|$)/)?.[1] ?? 'unknown';
  const type=url.includes('/api/') ? 'chart' : 'page';
  const selected = type === 'page' && target?.isin === isin && eligibleArchiveTarget(target) ? target : null;
  const unavailable = () => selected ? strategyIssuerSamples(selected, null) : [];
  let response: Response;
  try { response=await fetch(url,{...options,cache:'no-store'}); }
  catch(e) { await persistFetch({id,source:'vontobel',operation:type,instrument:`ISIN:${isin}`,startedAt,success:false,measurement:'http_request',errorCode:'network_error',samples:unavailable()});throw e; }
  let samples:Sample[]=[],bytes:number|undefined,errorCode:string|undefined;
  try {
    const text = await response.clone().text();
    bytes = Buffer.byteLength(text, 'utf8');
    samples = !response.ok ? unavailable() : selected ? strategyIssuerPageSamples(text, selected) : vontobelSamples(text, isin, type);
    if (selected && samples[0]?.metadata?.status === 'unavailable') errorCode = 'issuer_status_unavailable';
  } catch {
    errorCode = 'payload_parse_error';
    samples = unavailable();
  }
  if(!response.ok)errorCode=`http_${response.status}`;
  else if(!samples.length&&!errorCode)errorCode='no_supported_points';
  await persistFetch({id,source:'vontobel',operation:type,instrument:`ISIN:${isin}`,startedAt,success:response.ok && !errorCode,measurement:'http_request',httpStatus:response.status,responseBytes:bytes,samples,errorCode});
  return response;
}
