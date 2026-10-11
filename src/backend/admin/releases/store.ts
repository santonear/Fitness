import { featureNames } from '../../../domain/feature-flags';
import {readFeatureFlags} from '../../feature-config';
import { AdminError, requireAdminDb, type AdminContext } from '../core/contracts';
import { promptTasks, registeredPromptVersions, sensitiveFeatures, type FlagRow, type ReleasesEnv, type ReleaseEnvironment } from './model';

export async function releaseOverview(context: AdminContext<ReleasesEnv>) {
  const db = requireAdminDb(context);
  const environment=context.env.ADMIN_ENVIRONMENT;
  if(!environment)throw new AdminError('RELEASE_ENVIRONMENT_UNAVAILABLE',503);
  const [flags, history, prompts, releases, smoke, effectiveFlags] = await Promise.all([
    db.prepare('SELECT name,environment,enabled,pending,changed_by,changed_at FROM admin_feature_flags WHERE environment=?').bind(environment).all<FlagRow>(),
    db.prepare('SELECT request_id,environment,kind,object_id,before_value,after_value,actor,created_at FROM admin_release_history WHERE environment=? ORDER BY created_at DESC LIMIT 100').bind(environment).all(),
    db.prepare('SELECT environment,task,version,changed_by,changed_at FROM admin_prompt_selection WHERE environment=?').bind(environment).all(),
    db.prepare('SELECT environment,current_id,previous_id,changed_at,operation_id FROM admin_release_state WHERE environment=?').bind(environment).all(),
    db.prepare('SELECT environment,release_id,check_id,status,checked_at FROM admin_release_smoke WHERE environment=?').bind(environment).all(),
    readFeatureFlags(context.env),
  ]);
  return { features: featureNames.map(name => ({ name, sensitive: sensitiveFeatures.has(name), states: (['preview','production'] as const).map(environment => {
    const row = flags.results.find(item => item.name === name && item.environment === environment);
    return {environment,enabled:environment===context.env.ADMIN_ENVIRONMENT ? effectiveFlags[name] : null,pending:row?.pending === 1,changedBy:row?.changed_by ?? null,changedAt:row?.changed_at ?? null};
  }) })), environment, history:history.results, prompts:prompts.results, promptTasks, registeredPromptVersions, releases:releases.results, smoke:smoke.results };
}
export async function saveFlag(context:AdminContext<ReleasesEnv>, value:{name:string;environment:ReleaseEnvironment;enabled:boolean}, pending=false) {
  const db=requireAdminDb(context); const time=new Date(context.now).toISOString();
  const enabled=pending ? 0 : Number(value.enabled);const kind=pending?'flag_pending':'flag';const after=pending?'pending':String(enabled);
  if(await alreadyCommitted(context,value.environment,kind,value.name,after))return;
  await db.batch([
    db.prepare('INSERT INTO admin_release_history(request_id,environment,kind,object_id,before_value,after_value,actor,created_at) VALUES(?,?,?,?,(SELECT CAST(enabled AS TEXT) FROM admin_feature_flags WHERE environment=? AND name=?),?,?,?)').bind(context.requestId,value.environment,kind,value.name,value.environment,value.name,after,context.actor,time),
    db.prepare('INSERT INTO admin_feature_flags(environment,name,enabled,pending,changed_by,changed_at) VALUES(?,?,?,?,?,?) ON CONFLICT(environment,name) DO UPDATE SET enabled=CASE WHEN excluded.pending=1 THEN admin_feature_flags.enabled ELSE excluded.enabled END,pending=excluded.pending,changed_by=excluded.changed_by,changed_at=excluded.changed_at').bind(value.environment,value.name,enabled,Number(pending),context.actor,time),
  ]);
}
export async function savePrompt(context:AdminContext<ReleasesEnv>, value:{task:string;environment:ReleaseEnvironment;version:string}) {
  if (!registeredPromptVersions.includes(value.version as typeof registeredPromptVersions[number])) throw new AdminError('UNREGISTERED_PROMPT');
  const db=requireAdminDb(context); const time=new Date(context.now).toISOString();
  if(await alreadyCommitted(context,value.environment,'prompt',value.task,value.version))return;
  await db.batch([
    db.prepare('INSERT INTO admin_release_history(request_id,environment,kind,object_id,before_value,after_value,actor,created_at) VALUES(?,?,?,?,COALESCE((SELECT version FROM admin_prompt_selection WHERE environment=? AND task=?),?),?,?,?)').bind(context.requestId,value.environment,'prompt',value.task,value.environment,value.task,registeredPromptVersions[0],value.version,context.actor,time),
    db.prepare('INSERT INTO admin_prompt_selection(environment,task,version,changed_by,changed_at) VALUES(?,?,?,?,?) ON CONFLICT(environment,task) DO UPDATE SET version=excluded.version,changed_by=excluded.changed_by,changed_at=excluded.changed_at').bind(value.environment,value.task,value.version,context.actor,time),
  ]);
}
async function alreadyCommitted(context:AdminContext<ReleasesEnv>,environment:string,kind:string,object:string,after:string) {
  const row=await requireAdminDb(context).prepare('SELECT environment,kind,object_id,after_value,actor FROM admin_release_history WHERE request_id=?').bind(context.requestId).first<{environment:string;kind:string;object_id:string;after_value:string;actor:string}>();
  if(!row)return false;
  if(row.environment!==environment||row.kind!==kind||row.object_id!==object||row.after_value!==after||row.actor!==context.actor)throw new AdminError('REQUEST_ID_CONFLICT',409);
  return true;
}
