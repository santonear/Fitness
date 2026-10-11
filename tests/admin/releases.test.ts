import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AdminContext, AdminDatabase, AdminStatement } from '../../src/backend/admin/core/contracts';
import type { ReleasesEnv } from '../../src/backend/admin/releases/model';
import { handleReleases } from '../../src/backend/admin/releases';
import { readManagedFeatureFlags, readSelectedPromptVersion } from '../../src/backend/admin/releases/runtime';
import { releaseTodoSource } from '../../src/backend/admin/releases/todos';
import { rollbackRelease,registeredReleases,runReleaseSmoke } from '../../src/backend/admin/releases/deployment';
import { createCloudflareReleaseAdapter } from '../../src/backend/admin/releases/cloudflare-adapter';
import {createPreviewSimulationAdapter} from '../../src/backend/admin/releases/preview-simulation-adapter';
import {readFeatureFlags} from '../../src/backend/feature-config';

const connections:DatabaseSync[]=[];
function fixture() {
  const sqlite=new DatabaseSync(':memory:');connections.push(sqlite);
  const migration=readFileSync(new URL('../../migrations/admin/2_releases.sql',import.meta.url),'utf8');sqlite.exec(migration);sqlite.exec(migration);sqlite.exec(readFileSync(new URL('../../migrations/admin/2_smoke_reason.sql',import.meta.url),'utf8'));
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
  it('shows configured console defaults and managed false overrides its enabled environment setting',async()=>{
    const {context}=fixture();context.env.ADMIN_CONSOLE_ENABLED='true';
    const overview=await handleReleases(new Request('https://example.test/api/v1/management/console/releases'),context);
    expect((await overview!.json()).features.find((row:{name:string})=>row.name==='adminConsole').states[0].enabled).toBe(true);
    context.fresh=false;await handleReleases(post('flags',{name:'adminConsole',environment:'preview',enabled:false}),context);
    expect((await readFeatureFlags(context.env)).adminConsole).toBe(false);
    const updated=await handleReleases(new Request('https://example.test/api/v1/management/console/releases'),context);
    expect((await updated!.json()).features.find((row:{name:string})=>row.name==='adminConsole').states[0].enabled).toBe(false);
  });
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
    const {context}=fixture();context.fresh=false;context.env.ADMIN_ENVIRONMENT='production';
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
  it('retries a committed flag or prompt after audit callback failure without duplicate history',async()=>{
    const {context,sqlite}=fixture();context.audit=vi.fn().mockRejectedValueOnce(new Error('audit unavailable')).mockResolvedValue(undefined);
    const command=()=>post('flags',{name:'exercisePanel',environment:'preview',enabled:true});
    await expect(handleReleases(command(),context)).rejects.toThrow('audit unavailable');
    expect((await handleReleases(command(),context))?.status).toBe(200);
    expect(sqlite.prepare('SELECT * FROM admin_release_history').all()).toHaveLength(1);
    context.requestId='request-00002';context.audit=vi.fn().mockRejectedValueOnce(new Error('audit unavailable')).mockResolvedValue(undefined);
    const prompt=()=>post('prompts',{task:'ONBOARD_PLAN',environment:'preview',version:'v8.0.0',confirmed:true});
    await expect(handleReleases(prompt(),context)).rejects.toThrow('audit unavailable');expect((await handleReleases(prompt(),context))?.status).toBe(200);
    expect(sqlite.prepare('SELECT * FROM admin_release_history').all()).toHaveLength(2);
  });
  it('refuses foreign-environment writes and masks foreign-environment state',async()=>{
    const {context,sqlite}=fixture();
    sqlite.prepare('INSERT INTO admin_feature_flags VALUES(?,?,?,?,?,?)').run('production','nutrition',1,0,'operator','2026-10-11');
    await expect(handleReleases(post('flags',{name:'nutrition',environment:'production',enabled:false}),context)).rejects.toMatchObject({code:'ENVIRONMENT_NOT_CONNECTED'});
    const response=await handleReleases(new Request('https://example.test/api/v1/management/console/releases'),context);
    const body=await response!.json();expect(body.features.find((item:{name:string})=>item.name==='nutrition').states[1].enabled).toBe(null);
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
  it('rechecks the registered current release and clears resolved smoke todo without deploying',async()=>{
    const {context}=fixture();context.env.ADMIN_RELEASE_REGISTRY=JSON.stringify([{environment:'preview',dataVersion:11,current,previous}]);
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(null,{status:503})));
    await handleReleases(post('smoke',{environment:'preview',releaseId:current.id}),context);expect(await releaseTodoSource.evaluate(context)).toHaveLength(1);
    vi.stubGlobal('fetch',vi.fn(async(request:Request)=>new URL(request.url).pathname.includes('management')?new Response(null,{status:403}):new URL(request.url).pathname.endsWith('features')?Response.json({flags:{}}):new Response('Application')));
    context.requestId='request-00002';await handleReleases(post('smoke',{environment:'preview',releaseId:current.id}),context);expect(await releaseTodoSource.evaluate(context)).toHaveLength(0);
    await expect(handleReleases(post('smoke',{environment:'preview',releaseId:'unregistered'}),context)).rejects.toMatchObject({code:'RELEASE_CHANGED_OR_BUSY'});
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


it('isolates preview simulation, persists replay receipt and never changes release state',async()=>{
 const {context,sqlite,db}=fixture();sqlite.exec(readFileSync(new URL('../../migrations/admin/2_preview_simulation.sql',import.meta.url),'utf8'));
 context.requestId='simulation-request-0001';context.env.ADMIN_RELEASE_REGISTRY=JSON.stringify([{environment:'preview',dataVersion:11,current,previous}]);
 const adapter=createPreviewSimulationAdapter();const settings={ADMIN_ENVIRONMENT:'preview',ADMIN_SIMULATION_DB:db,ADMIN_RELEASE_REGISTRY:context.env.ADMIN_RELEASE_REGISTRY};
 context.env.ADMIN_PREVIEW_SIMULATION={fetch:request=>adapter.fetch(request,settings)};
 const command={environment:'preview',expectedCurrent:current.id,target:previous.id,confirmed:true};
 context.fresh=false;await expect(handleReleases(post('simulate-rollback',command),context)).rejects.toMatchObject({code:'FRESH_ACCESS_REQUIRED'});context.fresh=true;
 const first=await (await handleReleases(post('simulate-rollback',command),context))!.json();expect(first).toMatchObject({mode:'preview-simulation',actualDeploymentUnchanged:true,selectedDeploymentId:previous.deploymentId});
 expect(await (await handleReleases(post('simulate-rollback',command),context))!.json()).toEqual(first);
 expect(sqlite.prepare('SELECT * FROM admin_preview_simulation_receipts').all()).toHaveLength(1);
 expect(sqlite.prepare('SELECT * FROM admin_release_state').all()).toHaveLength(0);
 expect(sqlite.prepare('SELECT * FROM admin_release_history').all()).toHaveLength(0);
 expect((await adapter.fetch(new Request('https://private/status'),{...settings,ADMIN_ENVIRONMENT:'production'})).status).toBe(503);
 context.env.ADMIN_ENVIRONMENT='production';await expect(handleReleases(post('simulate-rollback',command),context)).rejects.toMatchObject({code:'PREVIEW_SIMULATION_UNAVAILABLE'});
});


it('uses runtime metadata for preview current only and treats login redirects as failed content checks',async()=>{
 const {context}=fixture();context.env.ADMIN_RELEASE_REGISTRY=JSON.stringify([{environment:'preview',dataVersion:11,current,previous},{environment:'production',dataVersion:11,current,previous}]);context.env.CF_VERSION_METADATA={id:'33333333-3333-4333-8333-333333333333'};
 const entries=registeredReleases(context.env);expect(entries[0].current.deploymentId).toBe(context.env.CF_VERSION_METADATA.id);expect(entries[0].previous!.deploymentId).toBe(previous.deploymentId);expect(entries[1].current.deploymentId).toBe(current.deploymentId);
 context.env.ADMIN_ENVIRONMENT='production';expect(registeredReleases(context.env)[0].current.deploymentId).toBe(current.deploymentId);
 const checks=await runReleaseSmoke(context,'preview',current,async()=>new Response(null,{status:302,headers:{Location:'https://login.example.test'}}));expect(checks.map(c=>[c.check,c.status])).toEqual([['application','failed'],['features','failed'],['managementAccess','failed']]);
});


it('recognizes trusted Access redirects without credentials and persists per-check causes',async()=>{
 const {context,sqlite}=fixture();context.env.ADMIN_ACCESS_ISSUER='https://team.cloudflareaccess.com';
 const requests:Request[]=[];const checks=await runReleaseSmoke(context,'preview',current,async input=>{requests.push(input as Request);return new Response(null,{status:302,headers:{Location:'https://team.cloudflareaccess.com/cdn-cgi/access/login/preview.example.test?token=never-persist'}})});
 expect(checks.map(r=>[r.status,r.reason])).toEqual([['unavailable','access_login_required'],['unavailable','access_login_required'],['passed','access_protected']]);
 expect(requests.every(r=>r.redirect==='manual'&&r.credentials==='omit'&&!r.headers.has('Cookie')&&!r.headers.has('Authorization'))).toBe(true);
 const persisted=sqlite.prepare('SELECT * FROM admin_release_smoke_reason').all();expect(JSON.stringify(persisted)).not.toContain('never-persist');expect(persisted).toHaveLength(3);
 const fault=await runReleaseSmoke(context,'preview',current,async()=>new Response(null,{status:503}));expect(fault.every(r=>r.status==='failed'&&r.httpStatus===503)).toBe(true);
 const unavailable=await runReleaseSmoke(context,'preview',current,async()=>{throw new TypeError('sensitive detail')});expect(unavailable.every(r=>r.reason==='transport_unavailable')).toBe(true);expect(JSON.stringify(unavailable)).not.toContain('sensitive');
});


it('delegates preview probes to the private allowlisted adapter and strips redirect queries',async()=>{
 const {context,db}=fixture();const registry=JSON.stringify([{environment:'preview',dataVersion:11,current,previous}]);context.env.ADMIN_RELEASE_REGISTRY=registry;context.env.ADMIN_ACCESS_ISSUER='https://team.cloudflareaccess.com';
 const adapter=createPreviewSimulationAdapter(),settings={ADMIN_ENVIRONMENT:'preview',ADMIN_SIMULATION_DB:db,ADMIN_RELEASE_REGISTRY:registry};
 const outbound=vi.fn(async(request:Request)=>{expect(request.credentials).toBe('omit');expect(request.redirect).toBe('manual');expect(request.headers.has('Cookie')).toBe(false);return new Response(null,{status:307,headers:{Location:'https://team.cloudflareaccess.com/cdn-cgi/access/login/preview.example.test?token=secret'}})});vi.stubGlobal('fetch',outbound);
 context.env.ADMIN_PREVIEW_SIMULATION={fetch:request=>adapter.fetch(request,settings)};const direct=vi.fn(async()=>{throw new Error('SELF_FETCH_FORBIDDEN')});
 const checks=await runReleaseSmoke(context,'preview',current,direct);expect(direct).not.toHaveBeenCalled();expect(checks[2]).toMatchObject({status:'passed',reason:'access_protected',httpStatus:307});expect(checks[0].reason).toBe('access_login_required');
 const request=(url:string)=>new Request('https://private/probe',{method:'POST',body:JSON.stringify({url})});
 expect((await adapter.fetch(request('https://evil.example/'),settings)).status).toBe(400);expect((await adapter.fetch(request(current.smokeOrigin+'/api/admin'),settings)).status).toBe(400);expect((await adapter.fetch(request(current.smokeOrigin+'/'),{...settings,ADMIN_ENVIRONMENT:'production'})).status).toBe(503);
 const response=await adapter.fetch(request(current.smokeOrigin+'/'),settings);expect(await response.text()).not.toContain('secret');expect(outbound).toHaveBeenCalledTimes(4);
 context.env.ADMIN_ENVIRONMENT='production';await runReleaseSmoke(context,'production',current,direct);expect(direct).toHaveBeenCalledTimes(3);
});
