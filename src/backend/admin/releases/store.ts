import { featureNames } from '../../../domain/feature-flags';
import { AdminError, requireAdminDb, type AdminContext } from '../core/contracts';
import { promptTasks, registeredPromptVersions, sensitiveFeatures, type FlagRow, type ReleasesEnv, type ReleaseEnvironment } from './model';

export async function releaseOverview(context: AdminContext<ReleasesEnv>) {
  const db = requireAdminDb(context);
  const environment=context.env.ADMIN_ENVIRONMENT;
  if(!environment)throw new AdminError('RELEASE_ENVIRONMENT_UNAVAILABLE',503);
  const [flags, history, prompts, releases, smoke] = await Promise.all([
    db.prepare('SELECT name,environment,enabled,pending,changed_by,changed_at FROM admin_feature_flags WHERE environment=?').bind(environment).all<FlagRow>(),
    db.prepare('SELECT request_id,environment,kind,object_id,before_value,after_value,actor,created_at FROM admin_release_history WHERE environment=? ORDER BY created_at DESC LIMIT 100').bind(environment).all(),
    db.prepare('SELECT environment,task,version,changed_by,changed_at FROM admin_prompt_selection WHERE environment=?').bind(environment).all(),
    db.prepare('SELECT environment,current_id,previous_id,changed_at,operation_id FROM admin_release_state WHERE environment=?').bind(environment).all(),
    db.prepare('SELECT environment,release_id,check_id,status,checked_at FROM admin_release_smoke WHERE environment=?').bind(environment).all(),
  ]);
  return { features: featureNames.map(name => ({ name, sensitive: sensitiveFeatures.has(name), states: (['preview','production'] as const).map(environment => {
    const row = flags.results.find(item => item.name === name && item.environment === environment);
    return {environment,enabled:row ? row.enabled === 1 : null,pending:row?.pending === 1,changedBy:row?.changed_by ?? null,changedAt:row?.changed_at ?? null};
  }) })), environment, history:history.results, prompts:prompts.results, promptTasks, registeredPromptVersions, releases:releases.results, smoke:smoke.results };
}
export async function saveFlag(context:AdminContext<ReleasesEnv>, value:{name:string;environment:ReleaseEnvironment;enabled:boolean}, pending=false) {
  const db=requireAdminDb(context); const time=new Date(context.now).toISOString();
  const old=await db.prepare('SELECT enabled FROM admin_feature_flags WHERE environment=? AND name=?').bind(value.environment,value.name).first<{enabled:number}>();
  const enabled=pending ? old?.enabled ?? 0 : Number(value.enabled);
  await db.batch([
    db.prepare('INSERT INTO admin_feature_flags(environment,name,enabled,pending,changed_by,changed_at) VALUES(?,?,?,?,?,?) ON CONFLICT(environment,name) DO UPDATE SET enabled=CASE WHEN excluded.pending=1 THEN admin_feature_flags.enabled ELSE excluded.enabled END,pending=excluded.pending,changed_by=excluded.changed_by,changed_at=excluded.changed_at').bind(value.environment,value.name,enabled,Number(pending),context.actor,time),
    db.prepare('INSERT INTO admin_release_history(request_id,environment,kind,object_id,before_value,after_value,actor,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(context.requestId,value.environment,pending?'flag_pending':'flag',value.name,old ? String(old.enabled):null,pending?'pending':String(enabled),context.actor,time),
  ]);
}
export async function savePrompt(context:AdminContext<ReleasesEnv>, value:{task:string;environment:ReleaseEnvironment;version:string}) {
  if (!registeredPromptVersions.includes(value.version as typeof registeredPromptVersions[number])) throw new AdminError('UNREGISTERED_PROMPT');
  const db=requireAdminDb(context); const time=new Date(context.now).toISOString();
  const old=await db.prepare('SELECT version FROM admin_prompt_selection WHERE environment=? AND task=?').bind(value.environment,value.task).first<{version:string}>();
  await db.batch([
    db.prepare('INSERT INTO admin_prompt_selection(environment,task,version,changed_by,changed_at) VALUES(?,?,?,?,?) ON CONFLICT(environment,task) DO UPDATE SET version=excluded.version,changed_by=excluded.changed_by,changed_at=excluded.changed_at').bind(value.environment,value.task,value.version,context.actor,time),
    db.prepare('INSERT INTO admin_release_history(request_id,environment,kind,object_id,before_value,after_value,actor,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(context.requestId,value.environment,'prompt',value.task,old?.version ?? registeredPromptVersions[0],value.version,context.actor,time),
  ]);
}
