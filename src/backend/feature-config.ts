import { disabledFeatures, parseFeatureFlags, type FeatureFlags } from '../domain/feature-flags';
export interface FeatureConfigEnv {
  FITNESS_FEATURE_FLAGS?: string;
  FITNESS_FEATURE_CONFIG?: { get(key: string): Promise<string | null> };
}
export async function readFeatureFlags(env: FeatureConfigEnv): Promise<FeatureFlags> {
  try {
    return parseFeatureFlags(env.FITNESS_FEATURE_CONFIG ? await env.FITNESS_FEATURE_CONFIG.get('features') : env.FITNESS_FEATURE_FLAGS);
  } catch { return disabledFeatures(); }
}
