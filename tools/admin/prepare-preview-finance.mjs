import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const hash=value=>createHash('sha256').update(value).digest('hex');
const quote=value=>`'${String(value).replaceAll("'","''")}'`;
const json=value=>`json(${quote(JSON.stringify(value))})`;
const uuid=value=>{const h=hash(value);return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`};
/** Generates SQL, never executes it. Snapshot is required to avoid guessing existing preview costs. */
export function buildPreviewFinanceSeed(config,snapshot,now=Date.now()){
 const ids={CONTROL_DB:'56ac8260-e90d-488e-882b-0062206e1a5d',ADMIN_DB:'91e3eb6e-050e-4170-85f7-351819f959c2'};
 if(config.name!=='fitness-admin-preview'||config.vars?.ADMIN_ENVIRONMENT!=='preview'||Object.entries(ids).some(([binding,id])=>!config.d1_databases?.some(d=>d.binding===binding&&d.database_id===id)))throw new Error('DEDICATED_PREVIEW_REQUIRED');
 const {revision,state}=snapshot.control??{},limit=snapshot.runtimeBudgetFen;
 if(!Number.isSafeInteger(revision)||revision<0||!state?.requests||!state?.budgets||!Number.isSafeInteger(limit)||limit<100)throw new Error('VALID_CONTROL_SNAPSHOT_AND_RUNTIME_BUDGET_REQUIRED');
 const policy=JSON.parse(config.vars.CONTROL_POLICY),parts=new Intl.DateTimeFormat('en',{timeZone:policy.timeZone,year:'numeric',month:'2-digit'}).formatToParts(now),month=`${parts.find(p=>p.type==='year').value}-${parts.find(p=>p.type==='month').value}`;
 const subjectId=uuid(`admin-preview-finance:${month}`),keys=Array.from({length:12},(_,i)=>`${subjectId}:${uuid(`admin-preview-finance:${month}:${i}`)}`),existing=keys.map(k=>state.requests[k]);
 if(existing.some(Boolean)&&!existing.every(Boolean))throw new Error('PARTIAL_SEED_REQUIRES_REVIEW');
 const budget=state.budgets[month]??{spent:0,reserved:0},used=budget.spent+budget.reserved;
 if(!Number.isSafeInteger(used)||used<0)throw new Error('INVALID_LEDGER_BUDGET');
 const delta=existing.every(Boolean)?0:Math.max(Math.ceil(limit*.6),used+12)-used;
 if(!existing.every(Boolean)&&(state.subjects?.[subjectId]||state.usages?.[`${subjectId}:${month}`]))throw new Error('SYNTHETIC_ID_COLLISION');
 if(Math.ceil(delta/12)>policy.maximumRequestCost)throw new Error('SEED_EXCEEDS_CONFIGURED_PER_CALL_BOUND');
 if((used+delta)/limit<=.5||(used+delta)/limit>=.8)throw new Error('CANNOT_SEED_WITHOUT_EXCEEDING_BUDGET_WINDOW');
 const tasks=['ONBOARD_PLAN','ADJUST_TODAY','MODIFY_PLAN','PERIOD_REVIEW'],taskLabels=['generate','adjust','modify','review'];
 const entries=existing.every(Boolean)?existing:keys.map((key,i)=>{const at=Math.max(Date.parse(`${month}-01T00:00:00Z`),now-(i%3)*86400000-60000);return{subjectId,requestId:key.slice(subjectId.length+1),inputDigest:hash(`synthetic:${key}`),operation:'generate',period:month,bound:Math.floor(delta/12)+(i<delta%12?1:0),actualCost:Math.floor(delta/12)+(i<delta%12?1:0),status:'settled',cancelled:false,createdAt:at,coachContract:{task:tasks[Math.floor(i/3)],promptVersion:'preview-synthetic',schemaVersion:'preview-synthetic',catalogVersion:1}}});
 let controlSql='-- Already seeded; no control mutation.\n';
 if(!existing.every(Boolean)){
  const insert=entries.flatMap((e,i)=>[quote(`$.requests."${keys[i]}"`),json(e)]).join(',');
  const audit={at:now,event:'preview-synthetic-finance',subjectId};
  const usageKey=`${subjectId}:${month}`;
  const additions=`json_insert(state,${insert},${quote(`$.subjects."${subjectId}"`)},${json({expiresAt:now,revoked:true})},${quote(`$.usages."${usageKey}"`)},${json({understand:0,generate:12})},'$.audit[#]',${json(audit)})`;
  controlSql=`-- Additive, revision-guarded. Require exactly one changed row before applying admin SQL.\nUPDATE control_ledger SET state=json_set(${additions},${quote(`$.budgets."${month}"`)},${json({spent:budget.spent+delta,reserved:budget.reserved})}),revision=revision+1 WHERE id=1 AND revision=${revision} AND json_type(state,${quote(`$.requests."${keys[0]}"`)}) IS NULL;\n`;
 }
 const adminSql=entries.map((e,i)=>`INSERT OR IGNORE INTO admin_finance_events(event_key,day,task,status,cost_fen,reserved_fen,at) VALUES(${quote(hash(`${e.subjectId}:${e.requestId}`))},${quote(new Date(e.createdAt).toISOString().slice(0,10))},${quote(taskLabels[Math.floor(i/3)])},'settled',${e.actualCost},0,${e.createdAt});`).join('\n')+'\n';
 return {controlSql,adminSql,manifest:{environment:'preview',month,synthetic:true,requests:12,settledAddedFen:delta,budgetFen:limit,projectedUsageFen:used+delta,expectedRevision:revision,databases:ids,instruction:'Apply control SQL to the dedicated preview CONTROL_DB; require changes=1 (or verify all 12 IDs already exist). Only then apply admin SQL to preview ADMIN_DB. On revision conflict, refresh snapshot and regenerate. No production execution.'}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(!process.argv[2])throw new Error('Usage: node tools/admin/prepare-preview-finance.mjs LOCAL_SNAPSHOT.json');
 const result=buildPreviewFinanceSeed(JSON.parse(readFileSync('wrangler.admin-preview.jsonc','utf8')),JSON.parse(readFileSync(process.argv[2],'utf8')));
 mkdirSync('.cache',{recursive:true});for(const[key,value]of Object.entries({control:result.controlSql,admin:result.adminSql,manifest:JSON.stringify(result.manifest,null,2)}))writeFileSync(`.cache/admin-preview-finance-${key}.${key==='manifest'?'json':'sql'}`,value);
 console.log('Prepared preview-only synthetic finance SQL. No database was changed. Review the manifest before use.');
}
