import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AdminContext, AdminDatabase, AdminStatement } from '../../src/backend/admin/core/contracts';
import type { ReleasesEnv } from '../../src/backend/admin/releases/model';
import { handleReleases } from '../../src/backend/admin/releases';
import { readManagedFeatureFlags, readSelectedPromptVersion } from '../../src/backend/admin/releases/runtime';
import { releaseTodoSource } from '../../src/backend/admin/releases/todos';
import { rollbackRelease } from '../../src/backend/admin/releases/deployment';
import { createCloudflareReleaseAdapter } from '../../src/backend/admin/releases/cloudflare-adapter';

const connections:DatabaseSync[]=[];
function fixture() {
  const sqlite=new DatabaseSync(':memory:');connections.push(sqlite);
  const migration=readFileSync(new URL('../../migrations/admin/2_releases.sql',import.meta.url),'utf8');sqlite.exec(migration);sqlite.exec(migration);
  const prepare=(sql:string,values:unknown[]=[]):AdminStatement=>({bind:(...next)=>prepare(sql,next),first:async<T>()=>(sqlite.prepare(sql).get(...values as never[])??null) as T|null,all:async<T>()=>({results:sqlite.prepare(sql).all(...values as never[]) as T[]}),run:async()=>({success:true,meta:{changes:Number(sqlite.prepare(sql).run(...values as never[]).changes)}})});
  const db:AdminDatabase={prepare,batch:async statements=>{sqlite.exec('BEGIN');try{const output=[];for(const statement of statements)output.push(await statement.run());sqlite.exec('COMMIT');return output;}catch(error){sqlite.exec('ROLLBACK');throw error;}}};
  const context:AdminContext<ReleasesEnv>={env:{ADMIN_DB:db,ADMIN_ENVIRONMENT:'preview'},actor:'admin@example.test',now:Date.parse('2026-10-11T10:00:00Z'),fresh:true,requestId:'request-00001',audit:vi.fn(async()=>{})};
  return {sqlite,db,context};
}
function post(path:string,body:unknown){return new Request(`https://example.test/api/v1/management/console/releases/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});}
const current={id:'release-current',deploymentId:'11111111-1111-4111-8111-111111111111',publishedAt:'2026-10-11T10:00:00Z',compatibleDataVersion:11,smokeOrigin:'https://preview.example.test'};
const previous={...current,id:'release-previous',deploymentId:'22222222-2222-4222-8222-222222222222'};
afterEach(()=>{for(const connection of connections.splice(0))connection.close();vi.unstubAllGlobals();});
describe('persistent release controls',()=>{
  it('isolates environments, persists explicit disable immediately and records actor/history',async()=>{
    const {context,sqlite}=fixture();
    await handleReleases(post('flags',{name:'exercisePanel',environment:'preview',enabled:true}),context);
    expect(await readManagedFeatureFlags(context.env)).toEqual({exercisePanel:true});
    expect(await readManagedFeatureFlags({...context.env,ADMIN_ENVIRONMENT:'production'})).toEqual({});
    context.requestId='request-00002';context.fresh=false;
    await handleReleases(post('flags',{name:'exercisePanel',environment:'preview',enabled:false}),context);
    expect(await readManagedFeatureFlags(context.env)).toEqual({exercisePanel:false});
    expect(sqlite.prepare('SELECT actor FROM admin_release_history').all()).toHaveLength(2);
  });
  it('creates pending todo, rejects stale sensitive enable, permits fresh confirmation and removes todo',async()=>{
    const {context}=fixture();context.fresh=false;
    const value={name:'errorReports',environment:'production',enabled:true};
    expect((await handleReleases(post('flags',value),context))?.status).toBe(202);
    expect(await releaseTodoSource.evaluate(context)).toHaveLength(1);
    context.requestId='request-00002';await expect(handleReleases(post('flags',{...value,confirmed:true}),context)).rejects.toMatchObject({code:'FRESH_ACCESS_REQUIRED'});
    expect(await readManagedFeatureFlags({...context.env,ADMIN_ENVIRONMENT:'production'})).toEqual({errorReports:false});
    context.fresh=true;await handleReleases(post('flags',{...value,confirmed:true}),context);
    expect(await releaseTodoSource.evaluate(context)).toHaveLength(0);
  });
  it('strictly rejects unregistered fields, prompt versions, and stale prompt changes',async()=>{
    const {context}=fixture();
    await expect(handleReleases(post('flags',{name:'nutrition',environment:'preview',enabled:true,notes:'private'}),context)).rejects.toMatchObject({code:'INVALID_FLAG_CHANGE'});
    await expect(handleReleases(post('prompts',{task:'ONBOARD_PLAN',environment:'preview',version:'injected',confirmed:true}),context)).rejects.toMatchObject({code:'INVALID_PROMPT_CHANGE'});
    await handleReleases(post('prompts',{task:'ONBOARD_PLAN',environment:'preview',version:'v8.0.0',confirmed:true}),context);
    expect(await readSelectedPromptVersion(context.env,'ONBOARD_PLAN')).toBe('v8.0.0');
    expect(await readSelectedPromptVersion(context.env,'PERIOD_REVIEW')).toBe('v8.1.0');
  });
  it('atomically rejects duplicate history ID without partially changing flag',async()=>{
    const {context}=fixture();await handleReleases(post('flags',{name:'exercisePanel',environment:'preview',enabled:true}),context);
    await expect(handleReleases(post('flags',{name:'exercisePanel',environment:'preview',enabled:false}),context)).rejects.toThrow();
    expect(await readManagedFeatureFlags(context.env)).toEqual({exercisePanel:true});
  });
  it('rejects incompatible rollback before adapter call and absent adapter fails closed',async()=>{
    const {context}=fixture();context.env.ADMIN_RELEASE_REGISTRY=JSON.stringify([{environment:'preview',dataVersion:12,current,previous}]);
    await expect(rollbackRelease(context,{environment:'preview',expectedCurrent:current.id,target:previous.id})).rejects.toMatchObject({code:'PREVIOUS_RELEASE_DATA_INCOMPATIBLE'});
    context.env.ADMIN_RELEASE_REGISTRY=JSON.stringify([{environment:'preview',dataVersion:11,current,previous}]);
    await expect(rollbackRelease(context,{environment:'preview',expectedCurrent:current.id,target:previous.id})).rejects.toMatchObject({code:'RELEASE_ADAPTER_UNAVAILABLE'});
  });
  it('runs smoke after confirmed rollback and creates urgent todo for unavailable checks',async()=>{
    const {context}=fixture();context.env.ADMIN_RELEASE_REGISTRY=JSON.stringify([{environment:'preview',dataVersion:11,current,previous}]);
    context.env.ADMIN_RELEASE_ADAPTER={fetch:vi.fn(async()=>Response.json({deploymentId:previous.deploymentId,requestId:context.requestId}))};
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(null,{status:503})));
    const result=await rollbackRelease(context,{environment:'preview',expectedCurrent:current.id,target:previous.id});
    expect(result.smoke).toHaveLength(3);expect(result.smoke.every(row=>row.status==='failed')).toBe(true);
    expect((await releaseTodoSource.evaluate(context))[0]).toMatchObject({level:'alert'});
  });
  it('keeps unknown rollback locked to same request and can retry it',async()=>{
    const {context}=fixture();context.env.ADMIN_RELEASE_REGISTRY=JSON.stringify([{environment:'preview',dataVersion:11,current,previous}]);
    context.env.ADMIN_RELEASE_ADAPTER={fetch:vi.fn(async()=>{throw new Error('timeout');})};
    const input={environment:'preview' as const,expectedCurrent:current.id,target:previous.id};
    await expect(rollbackRelease(context,input)).rejects.toMatchObject({code:'OPERATION_RESULT_UNKNOWN'});
    context.requestId='request-00002';await expect(rollbackRelease(context,input)).rejects.toMatchObject({code:'RELEASE_CHANGED_OR_BUSY'});
    context.requestId='request-00001';context.env.ADMIN_RELEASE_ADAPTER={fetch:async()=>Response.json({deploymentId:previous.deploymentId,requestId:context.requestId})};
    vi.stubGlobal('fetch',async()=>new Response(null,{status:403}));expect((await rollbackRelease(context,input)).current).toBe(previous.id);
  });
  it('does not expose input or prompt text in overview',async()=>{
    const {context}=fixture();const response=await handleReleases(new Request('https://example.test/api/v1/management/console/releases'),context);
    const output=JSON.stringify(await response!.json());expect(output).not.toMatch(/health|notes|promptText|weight|trainingRecords/);
  });
});
describe('private Cloudflare adapter',()=>{
  it('fails closed without secrets and never calls transport',async()=>{
    const transport=vi.fn();const adapter=createCloudflareReleaseAdapter(transport);
    const request=new Request('https://release-adapter/rollback',{method:'POST',headers:{'Idempotency-Key':'request-00001'},body:JSON.stringify({environment:'preview',expectedDeployment:current.deploymentId,targetDeployment:previous.deploymentId})});
    expect((await adapter.fetch(request,{})).status).toBe(503);expect(transport).not.toHaveBeenCalled();
  });
  it('observes target on retry without repeating deployment',async()=>{
    const transport=vi.fn(async()=>Response.json({success:true,result:{deployments:[{versions:[{version_id:previous.deploymentId,percentage:100}]}]}}));
    const request=new Request('https://release-adapter/rollback',{method:'POST',headers:{'Idempotency-Key':'request-00001'},body:JSON.stringify({environment:'preview',expectedDeployment:current.deploymentId,targetDeployment:previous.deploymentId})});
    const response=await createCloudflareReleaseAdapter(transport).fetch(request,{RELEASE_CLOUDFLARE_TOKEN:'synthetic-token',RELEASE_CLOUDFLARE_ACCOUNT:'test-account',RELEASE_WORKERS:'{"preview":"fitness-preview"}'});
    expect(response.status).toBe(200);expect(transport).toHaveBeenCalledTimes(1);
  });
});
