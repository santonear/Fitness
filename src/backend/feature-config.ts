import { disabledFeatures, featureNames, parseFeatureFlags, type FeatureFlags } from '../domain/feature-flags';
import { readManagedFeatureFlags } from './admin/releases/runtime';
import type { AdminEnvironment } from './admin/core/contracts';
export interface FeatureConfigEnv extends AdminEnvironment {
  FITNESS_FEATURE_FLAGS?: string;
  FITNESS_FEATURE_CONFIG?: { get(key: string): Promise<string | null> };
}
/** Internal security gates keep their conservative unavailable behavior. */
export async function readFeatureFlags(env: FeatureConfigEnv): Promise<FeatureFlags> {
  try { return {...parseFeatureFlags(env.FITNESS_FEATURE_CONFIG ? await env.FITNESS_FEATURE_CONFIG.get('features') : env.FITNESS_FEATURE_FLAGS),adminConsole:env.ADMIN_CONSOLE_ENABLED==='true',...await readManagedFeatureFlags(env)}; }
  catch { return disabledFeatures(); }
}
/** Public updates preserve omission: a missing key is not an explicit kill switch. */
export async function readPublicFeatureFlags(env: FeatureConfigEnv): Promise<Partial<FeatureFlags>> {
  const raw = env.FITNESS_FEATURE_CONFIG ? await env.FITNESS_FEATURE_CONFIG.get('features') : env.FITNESS_FEATURE_FLAGS;
  const value: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('FEATURE_CONFIG_UNAVAILABLE');
  const result: Partial<FeatureFlags> = {};
  for (const name of featureNames) {
    if (!Object.hasOwn(value, name)) continue;
    const setting = (value as Record<string,unknown>)[name];
    if (typeof setting !== 'boolean') throw new Error('FEATURE_CONFIG_UNAVAILABLE');
    result[name] = setting;
  }
  return {...result,...await readManagedFeatureFlags(env)};
}
