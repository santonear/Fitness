import { disabledFeatures, featureNames, parseFeatureFlags, type FeatureFlags } from '../domain/feature-flags';
export interface FeatureConfigEnv {
  FITNESS_FEATURE_FLAGS?: string;
  FITNESS_FEATURE_CONFIG?: { get(key: string): Promise<string | null> };
}
export async function readFeatureFlags(env: FeatureConfigEnv, reportUnavailable = false): Promise<FeatureFlags> {
  try {
    const raw = env.FITNESS_FEATURE_CONFIG ? await env.FITNESS_FEATURE_CONFIG.get('features') : env.FITNESS_FEATURE_FLAGS;
    if (reportUnavailable && (env.FITNESS_FEATURE_CONFIG || raw !== undefined)) {
      const value: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!value || typeof value !== 'object' || Array.isArray(value) || featureNames.some(name => Object.hasOwn(value, name) && typeof (value as Record<string, unknown>)[name] !== 'boolean')) throw new Error('FEATURE_CONFIG_UNAVAILABLE');
    }
    return parseFeatureFlags(raw);
  } catch (error) { if (reportUnavailable) throw error; return disabledFeatures(); }
}
