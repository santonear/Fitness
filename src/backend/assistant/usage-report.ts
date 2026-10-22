import type { AdminDatabase } from '../admin/core/contracts';
import type { ControlState } from '../store';
import {localDay} from './admission';
interface UsageRow {at:number;subject_short_id:string;task:string;stage:string;input_tokens:number|null;output_tokens:number|null;estimated_fen:number|null;result:string;pricing_version:string}
/** Sidecar archive: never rewrites historic status, spent cost or reservations. */
export async function archiveLegacyUsage(db:AdminDatabase,state:ControlState,now:number){
 const entries=Object.entries(state.requests).filter(([,r])=>['reserved','submitted','pending'].includes(r.status));
 for(let i=0;i<entries.length;i+=50)await db.batch(entries.slice(i,i+50).map(([key])=>db.prepare("INSERT OR IGNORE INTO assistant_legacy_archive(request_key,archived_at,label) VALUES(?,?,'archived_unaccounted')").bind(key,now)));
}
export async function assistantUsageReport(db:AdminDatabase,month:string,timeZone:string){
 const start=Date.parse(month+'-01T00:00:00Z')-86400000,end=start+34*86400000;
 const all=(await db.prepare('SELECT at,subject_short_id,task,stage,input_tokens,output_tokens,estimated_fen,result,pricing_version FROM assistant_usage WHERE at>=? AND at<? ORDER BY at DESC').bind(start,end).all<UsageRow>()).results;
 const rows=all.map(r=>({...r,day:localDay(r.at,timeZone)})).filter(r=>r.day.startsWith(month));
 const archived=(await db.prepare('SELECT COUNT(*) AS count FROM assistant_legacy_archive').first<{count:number}>())?.count??0;
 return {month,timeZone,rows,archived};
}
export function assistantUsageCsv(rows:(UsageRow&{day:string})[]){const safe=(v:unknown)=>'"'+String(v??'').replaceAll('"','""')+'"';return '\ufeff'+[['day','time','user','task','stage','input_tokens','output_tokens','estimated_CNY','result'],...rows.map(r=>[r.day,new Date(r.at).toISOString(),r.subject_short_id,r.task,r.stage,r.input_tokens,r.output_tokens,r.estimated_fen===null?'unknown':(r.estimated_fen/100).toFixed(6),r.result])].map(r=>r.map(safe).join(',')).join('\r\n')}
