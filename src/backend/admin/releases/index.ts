import { adminJson, AdminError, requireFreshContext, type AdminContext } from '../core/contracts';
import { flagChangeSchema,promptChangeSchema,rollbackSchema,sensitiveFeatures,type ReleasesEnv } from './model';
import { releaseOverview,saveFlag,savePrompt } from './store';
import { registeredReleases,rollbackRelease } from './deployment';

export async function handleReleases(request:Request,context:AdminContext<ReleasesEnv>):Promise<Response|undefined> {
  const path=new URL(request.url).pathname.replace('/api/v1/management/console/releases','');
  if(!new URL(request.url).pathname.startsWith('/api/v1/management/console/releases'))return undefined;
  if(request.method==='GET' && (path===''||path==='/'))return adminJson({...await releaseOverview(context),registered:registeredReleases(context.env),adapterAvailable:!!context.env.ADMIN_RELEASE_ADAPTER});
  if(request.method!=='POST')throw new AdminError('METHOD_NOT_ALLOWED',405);
  const raw:unknown=await request.json().catch(()=>null);
  if(path==='/flags') {
    const parsed=flagChangeSchema.safeParse(raw);if(!parsed.success)throw new AdminError('INVALID_FLAG_CHANGE');
    const value=parsed.data;const sensitive=value.enabled&&value.environment==='production'&&sensitiveFeatures.has(value.name);
    if(sensitive&&!value.confirmed) {await saveFlag(context,value,true);await context.audit('flag_pending',value.name,'pending');return adminJson({status:'pending_confirmation'},202);}
    if(sensitive)requireFreshContext(context);
    await saveFlag(context,value);await context.audit('flag_change',value.name,'success');return adminJson({status:'applied',effectiveWithinSeconds:60});
  }
  if(path==='/prompts') {
    const parsed=promptChangeSchema.safeParse(raw);if(!parsed.success)throw new AdminError('INVALID_PROMPT_CHANGE');
    requireFreshContext(context);await savePrompt(context,parsed.data);await context.audit('prompt_change',parsed.data.task,'success');return adminJson({status:'applied'});
  }
  if(path==='/rollback') {
    const parsed=rollbackSchema.safeParse(raw);if(!parsed.success)throw new AdminError('INVALID_ROLLBACK');
    requireFreshContext(context);const result=await rollbackRelease(context,parsed.data);await context.audit('release_rollback',parsed.data.target,'success');return adminJson(result);
  }
  return undefined;
}
