import { useSyncExternalStore } from 'react';
import { isFeatureEnabled, subscribeFeatureFlags } from '../application/feature-flags';
import type { FeatureName } from '../domain/feature-flags';
export function useFeature(name: FeatureName) { return useSyncExternalStore(subscribeFeatureFlags, () => isFeatureEnabled(name), () => false); }
