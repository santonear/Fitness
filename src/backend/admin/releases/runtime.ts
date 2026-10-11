import { featureNames, type FeatureFlags } from '../../../domain/feature-flags';
import { COACH_V8_PROMPT_VERSION, type CoachPromptRelease } from '../../coach-v8-version';
import { AdminError } from '../core/contracts';
import { promptTasks, registeredPromptVersions, type ReleasesEnv } from './model';

/** Read on each request. No KV eventual-consistency/cache delay for kill switches. */
export async function readManagedFeatureFlags(env: ReleasesEnv): Promise<Partial<FeatureFlags>> {
  if (!env.ADMIN_DB) return {};
  if (!env.ADMIN_ENVIRONMENT) throw new AdminError('RELEASE_ENVIRONMENT_UNAVAILABLE', 503);
  const rows = await env.ADMIN_DB.prepare('SELECT name,enabled FROM admin_feature_flags WHERE environment=?').bind(env.ADMIN_ENVIRONMENT).all<{name:string;enabled:number}>();
  return Object.fromEntries(rows.results.filter(row => featureNames.includes(row.name as typeof featureNames[number])).map(row => [row.name,row.enabled === 1]));
}
export async function readSelectedPromptVersion(env: ReleasesEnv, task: typeof promptTasks[number]): Promise<CoachPromptRelease> {
  if (!env.ADMIN_DB) return COACH_V8_PROMPT_VERSION;
  if (!env.ADMIN_ENVIRONMENT) throw new AdminError('RELEASE_ENVIRONMENT_UNAVAILABLE',503);
  const row = await env.ADMIN_DB.prepare('SELECT version FROM admin_prompt_selection WHERE environment=? AND task=?').bind(env.ADMIN_ENVIRONMENT,task).first<{version:string}>();
  if (!row) return COACH_V8_PROMPT_VERSION;
  if (!registeredPromptVersions.includes(row.version as CoachPromptRelease)) throw new AdminError('PROMPT_VERSION_UNAVAILABLE',503);
  return row.version as CoachPromptRelease;
}
