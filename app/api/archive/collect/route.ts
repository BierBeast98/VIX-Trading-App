import { createHash,timingSafeEqual } from 'node:crypto';
import { NextRequest,NextResponse } from 'next/server';
import { archiveConfig } from '@/lib/archive/config';
import { collectMarketData } from '@/lib/archive/collector';
import { allowed,sameOrigin } from '@/lib/signals/auth';
export const dynamic='force-dynamic';
export const maxDuration=90;
export async function POST(req:NextRequest){
 try{
  const config=await archiveConfig();const token=(req.headers.get('authorization')??'').replace(/^Bearer /,'');
  const hash=createHash('sha256').update(token).digest('hex');
  const cron=token.length>=32&&typeof config.tokenHash==='string'&&/^[a-f0-9]{64}$/.test(config.tokenHash)&&timingSafeEqual(Buffer.from(hash,'hex'),Buffer.from(config.tokenHash,'hex'));
  if(!cron&&(!allowed(req)||!sameOrigin(req)))return NextResponse.json({error:'Unauthorized'},{status:401});
  return NextResponse.json(await collectMarketData());
 }catch{return NextResponse.json({error:'Datensammlung fehlgeschlagen'},{status:503});}
}
