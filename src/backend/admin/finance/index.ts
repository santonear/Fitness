import {readFeatureFlags} from '../../feature-config';
import {assistantUsageReport,assistantUsageCsv,archiveLegacyUsage} from '../../assistant/usage-report';
import { ledgerMonth } from './month';
import { z } from 'zod';
import { D1ControlStore } from '../../d1-store';
import { adminJson, AdminError, requireAdminDb, requireFreshContext, type AdminContext } from '../core/contracts';
import { FinanceStore, environmentDefaults, runtimeSchema, validateAnnouncement, type FinanceEnv } from './runtime';
import { ledgerDailyCosts, ledgerRecentCosts, financeLocalDate, financeTodos, ledgerCsv, ledgerProjection, reconciliationTodos } from './report';
export * from './runtime';
export * from './report';
export type FinanceContext = AdminContext & { env: AdminContext['env'] & FinanceEnv; settle?: (subjectId:string, requestId:string, actualCost:number)=>Promise<void> };
const monthSchema=z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export async function evaluateFinanceTodos(context:AdminContext) {
  if(!context.env.ADMIN_DB || !context.env.CONTROL_DB) return [];
  if((await readFeatureFlags(context.env)).aiAssistantV2)return [];
  const state=await new FinanceStore(context.env.ADMIN_DB).read(), config=state.versions.at(-1)?.config??environmentDefaults(context.env);
  const control=await new D1ControlStore(context.env.CONTROL_DB).read();
  const period=ledgerMonth(context.now,context.env.CONTROL_POLICY),budget=control.budgets[period];
  return [...reconciliationTodos(control),...financeTodos(budget?.spent??0,budget?.reserved??0,config.monthlyBudgetFen,period).filter(t=>t.level!=='info'||!state.dismissedBudgetMonths?.includes(period))];
}
async function handleFinanceInternal(request:Request,context:FinanceContext):Promise<Response|undefined> {
  const url=new URL(request.url), prefix='/api/v1/management/console/finance';
  if(!url.pathname.startsWith(prefix+'/'))return undefined;
  const route=url.pathname.slice(prefix.length+1), db=requireAdminDb(context), store=new FinanceStore(db);
  if(route==='usage'||route==='usage-export'){
    if(request.method!=='GET')throw new AdminError('METHOD_NOT_ALLOWED',405);
    if(!(await readFeatureFlags(context.env)).aiAssistantV2)throw new AdminError('NOT_FOUND',404);
    const timeZone=url.searchParams.get('timeZone')??'Asia/Shanghai';try{financeLocalDate(context.now,timeZone)}catch{throw new AdminError('INVALID_TIME_ZONE',400)}
    const month=monthSchema.parse(url.searchParams.get('month')??financeLocalDate(context.now,timeZone).slice(0,7));
    if(context.env.CONTROL_DB)await archiveLegacyUsage(db,await new D1ControlStore(context.env.CONTROL_DB).read(),context.now);
    const report=await assistantUsageReport(db,month,timeZone);
    const user=url.searchParams.get('user'),task=url.searchParams.get('task');
    if(user||task)report.rows=report.rows.filter(r=>(!user||r.subject_short_id===user)&&(!task||r.task===task));
    return route==='usage'?adminJson(report):new Response(assistantUsageCsv(report.rows),{headers:{'Content-Type':'text/csv;charset=utf-8','Content-Disposition':`attachment; filename="usage-${month}.csv"`,'Cache-Control':'no-store'}});
  }
  if(route==='settle'&&(await readFeatureFlags(context.env)).aiAssistantV2)throw new AdminError('LEGACY_READ_ONLY',409);
  if(request.method==='GET') {

    if(route==='config') {const s=await store.read();return adminJson({current:s.versions.at(-1)??{version:0,config:environmentDefaults(context.env)},history:s.versions,dismissedBudgetMonths:s.dismissedBudgetMonths??[],defaults:environmentDefaults(context.env)});}
    if(route==='announcement')return adminJson({announcement:(await store.read()).announcement});
    if(['ledger','export','costs','recent-costs'].includes(route)) {
      const timeZone=url.searchParams.get('timeZone')??'Asia/Shanghai';
      try{financeLocalDate(context.now,timeZone)}catch{throw new AdminError('INVALID_TIME_ZONE',400)}
      if(!context.env.CONTROL_DB)throw new AdminError('LEDGER_UNAVAILABLE',503);
      const control=await new D1ControlStore(context.env.CONTROL_DB).read();
      if(route==='recent-costs'){const events=(await db.prepare("SELECT task,at FROM admin_finance_events WHERE status='fallback' AND at>=?").bind(context.now-8*86400000).all<{task:string;at:number}>()).results;return adminJson(ledgerRecentCosts(control,context.now,timeZone,events));}
      const month=monthSchema.parse(url.searchParams.get('month')??financeLocalDate(context.now,timeZone).slice(0,7));
      if(route==='costs'){const events=(await db.prepare("SELECT task,at FROM admin_finance_events WHERE status='fallback' AND at>=?").bind(Date.parse(month+'-01T00:00:00Z')-86400000).all<{task:string;at:number}>()).results;return adminJson({month,timeZone,rows:ledgerDailyCosts(control,timeZone,events).filter(row=>row.day.startsWith(month))});}
      if(!context.env.CONTROL_DB)throw new AdminError('LEDGER_UNAVAILABLE',503);
      const ledger=ledgerProjection(control,month,timeZone);
      if(route==='export'){await context.audit('finance.export',month,'completed');return new Response(ledgerCsv(ledger),{headers:{'Content-Type':'text/csv;charset=utf-8','Content-Disposition':`attachment; filename="ledger-${month}.csv"`,'Cache-Control':'no-store'}});}
      return adminJson(ledger);
    }
    return undefined;
  }
  if(request.method!=='POST')throw new AdminError('METHOD_NOT_ALLOWED',405);
  if(!context.requestId)throw new AdminError('REQUEST_ID_REQUIRED');
  const body:unknown=await request.json();
  if(route==='settle') {
    const input=z.strictObject({subjectShortId:z.string().length(8),requestShortId:z.string().length(8),actualCost:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)}).parse(body);
    if(!context.settle||!context.env.CONTROL_DB)throw new AdminError('SETTLEMENT_UNAVAILABLE',503);
    const matches=Object.values((await new D1ControlStore(context.env.CONTROL_DB).read()).requests).filter(r=>r.subjectId.startsWith(input.subjectShortId)&&r.requestId.startsWith(input.requestShortId));
    if(matches.length!==1)throw new AdminError('AMBIGUOUS_LEDGER_ROW',409);
    await context.settle(matches[0].subjectId,matches[0].requestId,input.actualCost);
    await context.audit('finance.settle',input.requestShortId,'completed');return adminJson({settled:true});
  }
  if(!['config','announcement','dismiss-budget'].includes(route))return undefined;
  if(route==='config')requireFreshContext(context);
  const receiptKey=`${context.actor}:${context.requestId}`, fingerprint=JSON.stringify({route,body});
  const result=await store.mutate(s=>{
    if(s.receipts[receiptKey]){if(s.receipts[receiptKey]!==fingerprint)throw new AdminError('IDEMPOTENCY_CONFLICT',409);return {saved:true};}
    if(route==='config') {
      const input=z.strictObject({expectedVersion:z.number().int().nonnegative(),config:runtimeSchema.optional(),restoreVersion:z.number().int().nonnegative().optional()}).parse(body);
      if((input.config===undefined)===(input.restoreVersion===undefined))throw new AdminError('CONFIG_CHOICE_REQUIRED');
      if(input.expectedVersion!==(s.versions.at(-1)?.version??0))throw new AdminError('CONFIG_VERSION_CONFLICT',409);
      const config=input.config??(input.restoreVersion===0?environmentDefaults(context.env):s.versions.find(v=>v.version===input.restoreVersion)?.config);
      if(!config)throw new AdminError('CONFIG_VERSION_NOT_FOUND',404);
      s.versions.push({version:input.expectedVersion+1,config:runtimeSchema.parse(config),actor:context.actor,at:context.now,requestId:context.requestId});
    }else if(route==='dismiss-budget'){
      const input=z.strictObject({month:monthSchema}).parse(body);
      s.dismissedBudgetMonths=[...new Set([...(s.dismissedBudgetMonths??[]),input.month])];
    }else{
      const input=z.strictObject({announcement:z.unknown().nullable()}).parse(body);
      s.announcement=input.announcement===null?null:validateAnnouncement(input.announcement);
    }
    s.receipts[receiptKey]=fingerprint;return {saved:true};
  });
  await context.audit(`finance.${route}`,route,'completed');return adminJson(result);
}

export async function handleFinance(request:Request,context:FinanceContext):Promise<Response|undefined> {
  try { return await handleFinanceInternal(request,context); } catch(error) { if(error instanceof z.ZodError) throw new AdminError('INVALID_FINANCE_INPUT',400); throw error; }
}


