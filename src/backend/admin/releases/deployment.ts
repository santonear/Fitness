import { z } from 'zod';
import { AdminError, requireAdminDb, type AdminContext } from '../core/contracts';
import { smokeChecks, type ReleasesEnv, type ReleaseEnvironment, type ReleaseRegistration, type SmokeCheck } from './model';

const release = z.object({id:z.string().regex(/^[\w.-]{1,80}$/),deploymentId:z.string().uuid(),publishedAt:z.string().datetime(),compatibleDataVersion:z.number().int().nonnegative(),smokeOrigin:z.string().url().refine(value=>new URL(value).protocol==='https:' && new URL(value).origin===value)}).strict();
const registry = z.array(z.object({environment:z.enum(['preview','production']),dataVersion:z.number().int().nonnegative(),current:release,previous:release.optional()}).strict());
export function registeredReleases(env:ReleasesEnv) {
  try {const parsed=registry.parse(JSON.parse(env.ADMIN_RELEASE_REGISTRY ?? '[]'));if(new Set(parsed.map(item=>item.environment)).size!==parsed.length)throw new Error();return parsed;}
  catch {throw new AdminError('RELEASE_REGISTRY_UNAVAILABLE',503);}
}
export async function checkCurrentRelease(context:AdminContext<ReleasesEnv>,environment:ReleaseEnvironment,releaseId:string) {
  const entry=registeredReleases(context.env).find(item=>item.environment===environment);
  if(!entry)throw new AdminError('UNREGISTERED_RELEASE',409);
  const db=requireAdminDb(context);
  const state=await db.prepare('SELECT current_id,operation_id FROM admin_release_state WHERE environment=?').bind(environment).first<{current_id:string;operation_id:string|null}>();
  if(state?.operation_id)throw new AdminError('RELEASE_CHANGED_OR_BUSY',409);
  if((state?.current_id??entry.current.id)!==releaseId)throw new AdminError('RELEASE_CHANGED_OR_BUSY',409);
  const target=[entry.current,entry.previous].find(item=>item?.id===releaseId);
  if(!target)throw new AdminError('UNREGISTERED_RELEASE',409);
  await db.prepare('INSERT OR IGNORE INTO admin_release_state(environment,current_id,previous_id,changed_at,operation_id) VALUES(?,?,?,?,NULL)').bind(environment,entry.current.id,entry.previous?.id??null,entry.current.publishedAt).run();
  return runReleaseSmoke(context,environment,target);
}
export async function runReleaseSmoke(context:AdminContext<ReleasesEnv>, environment:ReleaseEnvironment, target:ReleaseRegistration, transport:typeof fetch=fetch) {
  const paths={application:'/',features:'/api/v1/features',managementAccess:'/api/v1/management/console/releases'};
  const results:SmokeCheck[]=await Promise.all(smokeChecks.map(async check=>{
    let status:SmokeCheck['status']='unavailable';
    try {
      const response=await transport(new Request(target.smokeOrigin+paths[check],{redirect:'manual',signal:AbortSignal.timeout(10000),headers:{'Cache-Control':'no-cache'}}));
      status=(check==='managementAccess' ? [302,401,403].includes(response.status) : response.ok) ? 'passed':'failed';
      if(check==='features' && response.ok) {const body:unknown=await response.json();if(!body||typeof body!=='object'||!('flags' in body))status='failed';}
    }catch{ /* Transport errors are unavailable, never success; response bodies are not persisted. */ }
    return {check,status,checkedAt:new Date(context.now).toISOString()};
  }));
  await requireAdminDb(context).batch(results.map(item=>requireAdminDb(context).prepare('INSERT INTO admin_release_smoke(environment,release_id,check_id,status,checked_at) VALUES(?,?,?,?,?) ON CONFLICT(environment,release_id,check_id) DO UPDATE SET status=excluded.status,checked_at=excluded.checked_at').bind(environment,target.id,item.check,item.status,item.checkedAt)));
  return results;
}
/** Secret-bound server adapter owns deployment credentials; browser supplies only registered IDs. */
export async function rollbackRelease(context:AdminContext<ReleasesEnv>, input:{environment:ReleaseEnvironment;expectedCurrent:string;target:string}) {
  const entry=registeredReleases(context.env).find(item=>item.environment===input.environment);
  if(!entry?.previous || entry.current.id!==input.expectedCurrent || entry.previous.id!==input.target)throw new AdminError('UNREGISTERED_PREVIOUS_RELEASE',409);
  if(entry.previous.compatibleDataVersion!==entry.dataVersion)throw new AdminError('PREVIOUS_RELEASE_DATA_INCOMPATIBLE',409);
  if(!context.env.ADMIN_RELEASE_ADAPTER)throw new AdminError('RELEASE_ADAPTER_UNAVAILABLE',503);
  const db=requireAdminDb(context); const time=new Date(context.now).toISOString();
  const completed=await db.prepare('SELECT request_id FROM admin_release_history WHERE request_id=? AND kind=? AND object_id=?').bind(context.requestId,'rollback',entry.previous.id).first<{request_id:string}>();
  if(completed) return {current:entry.previous.id,previous:entry.current.id,smoke:await runReleaseSmoke(context,input.environment,entry.previous)};
  await db.prepare('INSERT OR IGNORE INTO admin_release_state(environment,current_id,previous_id,changed_at,operation_id) VALUES(?,?,?,?,NULL)').bind(input.environment,entry.current.id,entry.previous.id,time).run();
  const claim=await db.prepare('UPDATE admin_release_state SET operation_id=? WHERE environment=? AND current_id=? AND (operation_id IS NULL OR operation_id=?)').bind(context.requestId,input.environment,input.expectedCurrent,context.requestId).run();
  if(claim.meta.changes!==1)throw new AdminError('RELEASE_CHANGED_OR_BUSY',409);
  let response:Response;
  try {response=await context.env.ADMIN_RELEASE_ADAPTER.fetch(new Request('https://release-adapter/rollback',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':context.requestId},body:JSON.stringify({environment:input.environment,expectedDeployment:entry.current.deploymentId,targetDeployment:entry.previous.deploymentId})}));}
  catch {throw new AdminError('OPERATION_RESULT_UNKNOWN',503);}
  if(!response.ok)throw new AdminError('OPERATION_RESULT_UNKNOWN',503);
  const verified=z.object({deploymentId:z.string(),requestId:z.string()}).strict().safeParse(await response.json().catch(()=>null));
  if(!verified.success || verified.data.deploymentId!==entry.previous.deploymentId || verified.data.requestId!==context.requestId)throw new AdminError('OPERATION_RESULT_UNKNOWN',503);
  await db.batch([
    db.prepare('UPDATE admin_release_state SET current_id=?,previous_id=?,changed_at=?,operation_id=NULL WHERE environment=? AND operation_id=?').bind(entry.previous.id,entry.current.id,time,input.environment,context.requestId),
    db.prepare('INSERT INTO admin_release_history(request_id,environment,kind,object_id,before_value,after_value,actor,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(context.requestId,input.environment,'rollback',entry.previous.id,entry.current.id,entry.previous.id,context.actor,time),
  ]);
  const smoke=await runReleaseSmoke(context,input.environment,entry.previous);
  return {current:entry.previous.id,previous:entry.current.id,smoke};
}
