import { z } from 'zod';
import { AdminError, requireAdminDb, type AdminContext } from '../core/contracts';
import { smokeChecks, type ReleasesEnv, type ReleaseEnvironment, type ReleaseRegistration, type SmokeCheck } from './model';

const release = z.object({id:z.string().regex(/^[\w.-]{1,80}$/),deploymentId:z.string().uuid(),publishedAt:z.string().datetime(),compatibleDataVersion:z.number().int().nonnegative(),smokeOrigin:z.string().url().refine(value=>new URL(value).protocol==='https:' && new URL(value).origin===value)}).strict();
const registry = z.array(z.object({environment:z.enum(['preview','production']),dataVersion:z.number().int().nonnegative(),current:release,previous:release.optional()}).strict());
export function registeredReleases(env:ReleasesEnv) {
  try {const parsed=registry.parse(JSON.parse(env.ADMIN_RELEASE_REGISTRY ?? '[]'));if(new Set(parsed.map(item=>item.environment)).size!==parsed.length)throw new Error();if(env.ADMIN_ENVIRONMENT==='preview'&&env.CF_VERSION_METADATA){const actual=z.string().uuid().parse(env.CF_VERSION_METADATA.id);for(const item of parsed)if(item.environment==='preview')item.current.deploymentId=actual;}return parsed;}
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
/** Only recognized Access login destinations count as protected redirects. Never follow them. */
export function isAccessLoginRedirect(response:Response,origin:string,issuer?:string){
 if(![301,302,303,307,308].includes(response.status))return false;
 const location=response.headers.get('Location');if(!location)return false;
 try{const url=new URL(location,origin);if(url.protocol!=='https:'||url.username||url.password)return false;
 const trusted=issuer?url.origin===new URL(issuer).origin:/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(url.hostname);
 return (trusted||url.origin===origin)&&/^\/cdn-cgi\/access\/(?:login|authorize)(?:\/|$)/.test(url.pathname);
 }catch{return false;}
}
export async function runReleaseSmoke(context:AdminContext<ReleasesEnv>, environment:ReleaseEnvironment, target:ReleaseRegistration, transport:typeof fetch=fetch) {
 const paths={application:'/',features:'/api/v1/features',managementAccess:'/api/v1/management/console/releases'};
 // Preview probes run in the independent private worker to avoid self-fetch restrictions.
 const probe=async(request:Request)=>{
  if(context.env.ADMIN_ENVIRONMENT!=='preview'||!context.env.ADMIN_PREVIEW_SIMULATION)return transport(request);
  const result=await context.env.ADMIN_PREVIEW_SIMULATION.fetch(new Request('https://preview-simulation/probe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:request.url})}));
  if(!result.ok)throw new Error('PROBE_UNAVAILABLE');
  const value=z.object({status:z.number().int().min(200).max(599),location:z.string().url().optional(),featuresValid:z.boolean()}).strict().parse(await result.json());
  return new Response([204,205,304].includes(value.status)?null:JSON.stringify(value.featuresValid?{flags:{}}:null),{status:value.status,headers:value.location?{Location:value.location}:{}});
 };

 const results:SmokeCheck[]=await Promise.all(smokeChecks.map(async check=>{
  let status:SmokeCheck['status']='unavailable',reason='transport_unavailable';let httpStatus:number|undefined;
  try{
   const response=await probe(new Request(target.smokeOrigin+paths[check],{redirect:'manual',credentials:'omit',signal:AbortSignal.timeout(10000),headers:{'Cache-Control':'no-cache'}}));httpStatus=response.status;
   if(isAccessLoginRedirect(response,target.smokeOrigin,context.env.ADMIN_ACCESS_ISSUER)){status=check==='managementAccess'?'passed':'unavailable';reason=check==='managementAccess'?'access_protected':'access_login_required';}
   else if(check==='managementAccess'){status=[401,403].includes(response.status)?'passed':'failed';reason=status==='passed'?'anonymous_denied':response.ok?'anonymous_access_allowed':'unexpected_response';}
   else if(!response.ok){status='failed';reason=response.status>=300&&response.status<400?'unexpected_redirect':'http_error';}
   else if(check==='features'){let body:unknown;try{body=await response.json()}catch{}const flags=body&&typeof body==='object'&&!Array.isArray(body)&&'flags' in body?(body as {flags:unknown}).flags:undefined;status=flags&&typeof flags==='object'&&!Array.isArray(flags)?'passed':'failed';reason=status==='passed'?'content_available':'invalid_features';}
   else{status='passed';reason='content_available';}
  }catch{ /* No credentials, response body, Location or token is persisted. */ }
  return {check,status,reason,...(httpStatus===undefined?{}:{httpStatus}),checkedAt:new Date(context.now).toISOString()};
 }));
 const db=requireAdminDb(context);await db.batch(results.flatMap(item=>[
  db.prepare('INSERT INTO admin_release_smoke(environment,release_id,check_id,status,checked_at) VALUES(?,?,?,?,?) ON CONFLICT(environment,release_id,check_id) DO UPDATE SET status=excluded.status,checked_at=excluded.checked_at').bind(environment,target.id,item.check,item.status,item.checkedAt),
  db.prepare('INSERT INTO admin_release_smoke_reason(environment,release_id,check_id,reason,http_status) VALUES(?,?,?,?,?) ON CONFLICT(environment,release_id,check_id) DO UPDATE SET reason=excluded.reason,http_status=excluded.http_status').bind(environment,target.id,item.check,item.reason??null,item.httpStatus??null),
 ]));return results;
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
