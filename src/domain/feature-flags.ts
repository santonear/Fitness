export const featureNames = ['themeDiscovery', 'fontSubset', 'exercisePanel', 'pwaOffline', 'systemNotifications', 'aiOperations', 'errorReports', 'anonymousUsage', 'nutrition', 'activityImport'] as const;
export type FeatureName = typeof featureNames[number];
export type FeatureFlags = Record<FeatureName, boolean>;
export const disabledFeatures = (): FeatureFlags => Object.fromEntries(featureNames.map(name => [name, false])) as FeatureFlags;
/** Only literal booleans for known keys can enable a feature. Never spread remote input. */
export function parseFeatureFlags(value: unknown): FeatureFlags {
  if (typeof value === 'string') { try { value = JSON.parse(value); } catch { return disabledFeatures(); } }
  const flags = disabledFeatures();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return flags;
  for (const name of featureNames) flags[name] = Object.hasOwn(value, name) && (value as Record<string, unknown>)[name] === true;
  return flags;
}
export interface FeatureConfig { version: 1; flags: FeatureFlags; expiresAt: number }
