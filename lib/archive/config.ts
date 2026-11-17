import { prisma } from '@/lib/prisma';
export const ARCHIVE_CONFIG_ID='market_archive_config_v1';
export type ArchiveConfig={enabled:boolean;intervalMinutes:number;isins:string[];opensAt:string;closesAt:string;closedDates:string[];tokenHash?:string};
export const archiveDefaults:ArchiveConfig={enabled:false,intervalMinutes:5,isins:['DE000BD11R44'],opensAt:'08:00',closesAt:'22:00',closedDates:[]};
export async function archiveConfig():Promise<ArchiveConfig>{const r=await prisma.vixCache.findUnique({where:{id:ARCHIVE_CONFIG_ID}});return {...archiveDefaults,...(r?.data as Partial<ArchiveConfig> ?? {})};}
export function collectingNow(c:ArchiveConfig,now:Date){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',weekday:'short',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);const part=(s:string)=>parts.find(p=>p.type===s)?.value??'';const date=`${part('year')}-${part('month')}-${part('day')}`,time=`${part('hour')}:${part('minute')}`;return c.enabled&&!['Sat','Sun'].includes(part('weekday'))&&!c.closedDates.includes(date)&&time>=c.opensAt&&time<c.closesAt;}
