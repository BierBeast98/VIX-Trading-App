import { z } from 'zod';
export function archiveRange(params:URLSearchParams){
 const now=new Date();const from=params.get('from')??new Date(now.getTime()-30*86400000).toISOString();const to=params.get('to')??now.toISOString();
 const parsed=z.object({from:z.iso.datetime({offset:true}),to:z.iso.datetime({offset:true}),instrument:z.string().max(150),source:z.enum(['','yahoo','vontobel','massive'])}).parse({from,to,instrument:params.get('instrument')??'',source:params.get('source')??''});
 const start=new Date(parsed.from),end=new Date(parsed.to);if(start>end)throw new Error('Zeitraum ungültig');
 return {from:start,to:end,instrument:parsed.instrument,source:parsed.source};
}
