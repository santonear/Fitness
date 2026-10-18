import { adminJson, AdminError, requireFreshContext, type AdminContext } from '../core/contracts';
import {z} from 'zod';
import { flagChangeSchema,promptChangeSchema,rollbackSchema,sensitiveFeatures,type ReleasesEnv } from './model';
import { releaseOverview,saveFlag,savePrompt } from './store';
import { checkCurrentRelease,reconcileReleaseState,registeredReleases,rollbackRelease } from './deployment';
import {readPreviewSimulation,simulateRollback} from './simulation';

export async function handleReleases(request:Request,context:AdminContext<ReleasesEnv>):Promise<Response|undefined> {
  const path=new URL(request.url).pathname.replace('/api/v1/management/console/releases','');
  if(!new URL(request.url).pathname.startsWith('/api/v1/management/console/releases'))return undefined;
  if(!context.env.ADMIN_ENVIRONMENT)throw new AdminError('RELEASE_ENVIRONMENT_UNAVAILABLE',503);
  if(request.method==='GET' && (path===''||path==='/')){const registered=registeredReleases(context.env).filter(item=>item.environment===context.env.ADMIN_ENVIRONMENT);for(const entry of registered)await reconcileReleaseState(context,entry);return adminJson({...await releaseOverview(context),registered,adapterAvailable:!!context.env.ADMIN_RELEASE_ADAPTER,previewSimulation:await readPreviewSimulation(context.env)});}
  if(request.method!=='POST')throw new AdminError('METHOD_NOT_ALLOWED',405);
  const raw:unknown=await request.json().catch(()=>null);
  if(path==='/simulate-rollback') {const parsed=rollbackSchema.safeParse(raw);if(!parsed.success)throw new AdminError('INVALID_ROLLBACK');requireFreshContext(context);return adminJson(await simulateRollback(context,parsed.data));}
  if(path==='/smoke') {
    const parsed=z.object({environment:z.enum(['preview','production']),releaseId:z.string().regex(/^[\w.-]{1,80}$/)}).strict().safeParse(raw);
    if(!parsed.success)throw new AdminError('INVALID_SMOKE_CHECK');
    if(parsed.data.environment!==context.env.ADMIN_ENVIRONMENT)throw new AdminError('ENVIRONMENT_NOT_CONNECTED',409);
    const smoke=await checkCurrentRelease(context,parsed.data.environment,parsed.data.releaseId);
    await context.audit('release_smoke',parsed.data.releaseId,smoke.every(item=>item.status==='passed')?'success':'needs_attention');return adminJson({smoke});
  }
  if(path==='/flags') {
    const parsed=flagChangeSchema.safeParse(raw);if(!parsed.success)throw new AdminError('INVALID_FLAG_CHANGE');
    const value=parsed.data;const sensitive=value.enabled&&value.environment==='production'&&sensitiveFeatures.has(value.name);
    if(value.environment!==context.env.ADMIN_ENVIRONMENT)throw new AdminError('ENVIRONMENT_NOT_CONNECTED',409);
    if(sensitive&&!value.confirmed) {await saveFlag(context,value,true);await context.audit('flag_pending',value.name,'pending');return adminJson({status:'pending_confirmation'},202);}
    if(sensitive)requireFreshContext(context);
    await saveFlag(context,value);await context.audit('flag_change',value.name,'success');return adminJson({status:'applied',effectiveWithinSeconds:60});
  }
  if(path==='/prompts') {
    const parsed=promptChangeSchema.safeParse(raw);if(!parsed.success)throw new AdminError('INVALID_PROMPT_CHANGE');
    if(parsed.data.environment!==context.env.ADMIN_ENVIRONMENT)throw new AdminError('ENVIRONMENT_NOT_CONNECTED',409);
    requireFreshContext(context);await savePrompt(context,parsed.data);await context.audit('prompt_change',parsed.data.task,'success');return adminJson({status:'applied'});
  }
  if(path==='/rollback') {
    const parsed=rollbackSchema.safeParse(raw);if(!parsed.success)throw new AdminError('INVALID_ROLLBACK');
    if(parsed.data.environment!==context.env.ADMIN_ENVIRONMENT)throw new AdminError('ENVIRONMENT_NOT_CONNECTED',409);
    requireFreshContext(context);const result=await rollbackRelease(context,parsed.data);await context.audit('release_rollback',parsed.data.target,'success');return adminJson(result);
  }
  return undefined;
}
