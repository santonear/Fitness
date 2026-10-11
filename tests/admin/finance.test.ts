import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { afterEach,expect,it } from 'vitest';
import type { AdminDatabase,AdminStatement } from '../../src/backend/admin/core/contracts';
import { FinanceStore, handleFinance, resolveRuntimeEnv, activeAnnouncement, recordFinanceEvent, dailyCosts, ledgerProjection, ledgerCsv, financeTodos, environmentDefaults, reconciliationTodos, recentCosts } from '../../src/backend/admin/finance';
import { initialState } from '../../src/backend/store';
const databases:DatabaseSync[]=[];
afterEach(()=>databases.splice(0).forEach(d=>d.close()));
function setup(){
 const sql=new DatabaseSync(':memory:');databases.push(sql);sql.exec(readFileSync('migrations/admin/3_finance.sql','utf8'));
 sql.exec(readFileSync('migrations/admin/3_finance.sql','utf8'));
 const db:AdminDatabase={prepare(query:string){let values:unknown[]=[];const stmt:AdminStatement={bind(...v){values=v;return stmt},async first<T>(){return sql.prepare(query).get(...values as never[]) as T??null},async all<T>(){return {results:sql.prepare(query).all(...values as never[]) as T[]}},async run(){const r=sql.prepare(query).run(...values as never[]);return {success:true,meta:{changes:Number(r.changes)}}}};return stmt},async batch(){throw new Error('unused')}};
 const env={ADMIN_DB:db,CONTROL_POLICY:JSON.stringify({budgetLimit:3000,maximumRequestCost:300,requestBounds:{generate:300,understand:300},quotas:{generate:3,understand:3},maxConcurrent:1,planningBudgetDisabled:true,allowUncertainPlanningPending:true})};
 const context={env,actor:'admin@example.test',now:Date.UTC(2026,9,11),fresh:true,requestId:'request-1',audit:async()=>{}};
 const post=(route:string,body:unknown)=>new Request('https://fitness.test/api/v1/management/console/finance/'+route,{method:'POST',body:JSON.stringify(body)});
 return {db,env,context,post};
}
const config={quotaUnderstand:5,quotaGenerate:8,quotaSummary:3,monthlyBudgetFen:5000,reservationFen:200,maxConcurrent:2,retentionDays:20};
it('config CAS, repeat idempotency, immutable history and fresh Access',async()=>{
 const {db,context,post}=setup();const req=()=>post('config',{expectedVersion:0,config});
 await expect(handleFinance(req(),{...context,fresh:false})).rejects.toMatchObject({code:'FRESH_ACCESS_REQUIRED'});
 await handleFinance(req(),context);await handleFinance(req(),context);
 expect((await new FinanceStore(db).read()).versions).toHaveLength(1);
 await expect(handleFinance(post('config',{expectedVersion:0,config:{...config,maxConcurrent:3}}),context)).rejects.toMatchObject({code:'IDEMPOTENCY_CONFLICT'});
 await expect(handleFinance(req(),{...context,requestId:'2'})).rejects.toMatchObject({code:'CONFIG_VERSION_CONFLICT'});
 await handleFinance(post('config',{expectedVersion:1,restoreVersion:0}),{...context,requestId:'3'});
 const versions=(await new FinanceStore(db).read()).versions;expect(versions[0].config).toEqual(config);expect(versions[1].config.monthlyBudgetFen).toBe(3000);
});
it('runtime snapshots preserve approved unlimited admission and old requests',async()=>{
 const {env,context,post}=setup();const before=await resolveRuntimeEnv(env);await handleFinance(post('config',{expectedVersion:0,config}),context);
 const after=await resolveRuntimeEnv(env),p=JSON.parse(after.CONTROL_POLICY!);expect(p.planningBudgetDisabled).toBe(true);expect(p.allowUncertainPlanningPending).toBe(true);expect(p.budgetLimit).toBe(5000);expect(JSON.parse(before.CONTROL_POLICY!).budgetLimit).toBe(3000);
});
it('migration is repeatable and stale concurrent writers cannot partially append versions',async()=>{
 const {db,context,post}=setup();
 const results=await Promise.allSettled([handleFinance(post('config',{expectedVersion:0,config}),context),handleFinance(post('config',{expectedVersion:0,config:{...config,maxConcurrent:4}}),{...context,requestId:'concurrent'})]);
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
 const state=await new FinanceStore(db).read();expect(state.versions).toHaveLength(1);expect(Object.keys(state.receipts)).toHaveLength(1);
});
it('announcement enforces tone, single line and seven-day limit; expires',async()=>{
 const {env,context,post}=setup(),a={text:'芽芽暂时休息，训练和记录不受影响。',start:context.now,end:context.now+1000};
 await expect(handleFinance(post('announcement',{announcement:{...a,text:'你必须坚持'}}),context)).rejects.toThrow();
 await expect(handleFinance(post('announcement',{announcement:{...a,end:context.now+8*86400000}}),context)).rejects.toThrow();
 await handleFinance(post('announcement',{announcement:a}),context);expect(await activeAnnouncement(env,context.now)).toEqual(a);expect(await activeAnnouncement(env,a.end)).toBeNull();
});
it('metadata event dedupe and pending settlement are atomic and private',async()=>{
 const {db}=setup();const e={eventKey:'a'.repeat(64),day:'2026-10-11',task:'generate' as const,status:'pending' as const,costFen:0,reservedFen:300,at:100};
 await recordFinanceEvent(db,e);await recordFinanceEvent(db,e);await recordFinanceEvent(db,{...e,status:'settled',costFen:10,reservedFen:0});await recordFinanceEvent(db,e);
 expect(await dailyCosts(db,'2026-10')).toMatchObject([{calls:1,settledFen:10,pendingFen:0}]);
 await expect(recordFinanceEvent(db,{...e,goalText:'private'} as never)).rejects.toThrow();
});
it('ledger explicitly projects short identifiers without content; CSV BOM and budget thresholds',()=>{
 const s=initialState();s.budgets['2026-10']={spent:15,reserved:300};s.requests.x={subjectId:'12345678-secret',requestId:'abcdefgh-secret',inputDigest:'PRIVATE',operation:'generate',period:'2026-10',bound:300,status:'pending',cancelled:false,coachContract:{task:'PRIVATE',promptVersion:'x',schemaVersion:'x',catalogVersion:1}};
 const p=ledgerProjection(s,'2026-10');expect(JSON.stringify(p)).not.toMatch(/PRIVATE|secret|inputDigest/);expect(p.unattributedFen).toBe(15);expect(ledgerCsv(p).startsWith('\uFEFF')).toBe(true);
 expect(financeTodos(40,10,100,'2026-10')[0].level).toBe('info');expect(financeTodos(80,0,100,'2026-10')[0].level).toBe('warn');expect(financeTodos(100,0,100,'2026-10')[0].level).toBe('alert');
});
it('unconfigured summary capability remains absent after unrelated edits and default restore',async()=>{
 const {env,context,post}=setup();const defaults=environmentDefaults(env);expect(defaults.quotaSummary).toBeUndefined();
 await handleFinance(post('config',{expectedVersion:0,config:{...defaults,maxConcurrent:2}}),context);
 let p=JSON.parse((await resolveRuntimeEnv(env)).CONTROL_POLICY!);expect(p.quotas.summary).toBeUndefined();expect(p.requestBounds.summary).toBeUndefined();
 await handleFinance(post('config',{expectedVersion:1,config}),{...context,requestId:'summary-explicit'});p=JSON.parse((await resolveRuntimeEnv(env)).CONTROL_POLICY!);expect(p.quotas.summary).toBe(3);
 await handleFinance(post('config',{expectedVersion:2,restoreVersion:0}),{...context,requestId:'restore-defaults'});p=JSON.parse((await resolveRuntimeEnv(env)).CONTROL_POLICY!);expect(p.quotas.summary).toBeUndefined();
});
it('reconciliation todo reports pending count without inventing a pause or historical dates',()=>{
 const state=initialState();state.requests.x={subjectId:'private',requestId:'private',inputDigest:'private',operation:'generate',period:'2026-09',bound:100,status:'pending',cancelled:false};
 const todo=reconciliationTodos(state);expect(todo).toHaveLength(1);expect(todo[0].text).toContain('1 笔');expect(JSON.stringify(todo)).not.toMatch(/private|暂停/);
 state.requests.x.status='settled';state.requests.x.actualCost=10;expect(reconciliationTodos(state)).toEqual([]);
 state.recoveryRequired=true;expect(reconciliationTodos(state)).toHaveLength(1);
});
it('recent costs span month boundaries and exclude old events without fabricating zero days',async()=>{
 const {db}=setup();const event={task:'review' as const,status:'settled' as const,costFen:10,reservedFen:0,at:1};
 await recordFinanceEvent(db,{...event,eventKey:'a'.repeat(64),day:'2026-09-30'});await recordFinanceEvent(db,{...event,eventKey:'b'.repeat(64),day:'2026-10-02'});await recordFinanceEvent(db,{...event,eventKey:'c'.repeat(64),day:'2026-09-20'});
 const data=await recentCosts(db,Date.UTC(2026,9,3));expect(data.start).toBe('2026-09-27');expect(data.rows.map(r=>r.day)).toEqual(['2026-09-30','2026-10-02']);expect(data.historicalDailyCoverage).toBe('unavailable');
});
it('audit outage then same-request retry does not append a second configuration version',async()=>{
 const {db,context,post}=setup(),request=()=>post('config',{expectedVersion:0,config});
 await expect(handleFinance(request(),{...context,audit:async()=>{throw new Error('audit outage')}})).rejects.toThrow('audit outage');
 await handleFinance(request(),context);expect((await new FinanceStore(db).read()).versions).toHaveLength(1);
});
