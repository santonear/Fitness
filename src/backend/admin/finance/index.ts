import { z } from 'zod';
import { D1ControlStore } from '../../d1-store';
import { adminJson, AdminError, requireAdminDb, requireFreshContext, type AdminContext } from '../core/contracts';
import { FinanceStore, environmentDefaults, runtimeSchema, validateAnnouncement, type FinanceEnv } from './runtime';
import { dailyCosts, financeTodos, ledgerCsv, ledgerProjection, reconciliationTodos, recentCosts } from './report';
export * from './runtime';
export * from './report';
export type FinanceContext = AdminContext & { env: AdminContext['env'] & FinanceEnv; settle?: (subjectId:string, requestId:string, actualCost:number)=>Promise<void> };
const monthSchema=z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export async function evaluateFinanceTodos(context:AdminContext) {
  if(!context.env.ADMIN_DB || !context.env.CONTROL_DB) return [];
  const state=await new FinanceStore(context.env.ADMIN_DB).read(), config=state.versions.at(-1)?.config??environmentDefaults(context.env);
  const control=await new D1ControlStore(context.env.CONTROL_DB).read();
  const period=new Date(context.now).toISOString().slice(0,7),budget=control.budgets[period];
  return [...reconciliationTodos(control),...financeTodos(budget?.spent??0,budget?.reserved??0,config.monthlyBudgetFen,period).filter(t=>t.level!=='info'||!state.dismissedBudgetMonths?.includes(period))];
}
async function handleFinanceInternal(request:Request,context:FinanceContext):Promise<Response|undefined> {
  const url=new URL(request.url), prefix='/api/v1/management/console/finance';
  if(!url.pathname.startsWith(prefix+'/'))return undefined;
  const route=url.pathname.slice(prefix.length+1), db=requireAdminDb(context), store=new FinanceStore(db);
  if(request.method==='GET') {
    if(route==='recent-costs')return adminJson(await recentCosts(db,context.now));
    if(route==='config') {const s=await store.read();return adminJson({current:s.versions.at(-1)??{version:0,config:environmentDefaults(context.env)},history:s.versions,defaults:environmentDefaults(context.env)});}
    if(route==='announcement')return adminJson({announcement:(await store.read()).announcement});
    if(['ledger','export','costs'].includes(route)) {
      const month=monthSchema.parse(url.searchParams.get('month')??new Date(context.now).toISOString().slice(0,7));
      if(route==='costs')return adminJson({month,timeZone:'UTC',rows:await dailyCosts(db,month)});
      if(!context.env.CONTROL_DB)throw new AdminError('LEDGER_UNAVAILABLE',503);
      const ledger=ledgerProjection(await new D1ControlStore(context.env.CONTROL_DB).read(),month);
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

