import { disabledFeatures, parseFeatureFlags, type FeatureName, type FeatureFlags } from '../domain/feature-flags';
let flags = disabledFeatures();
let expiresAt = 0;
let pending: Promise<void> | undefined;
const listeners = new Set<() => void>();
export const subscribeFeatureFlags = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function isFeatureEnabled(name: FeatureName): boolean { return expiresAt > Date.now() && flags[name]; }
export function getFeatureFlags(): FeatureFlags { return expiresAt > Date.now() ? flags : disabledFeatures(); }
function publish(next: FeatureFlags, until: number) { flags = next; expiresAt = until; for (const listener of listeners) listener(); }
/** No user ID, cookies, profile, or device details are sent to the public config endpoint. */
export function refreshFeatureFlags(transport: typeof fetch = fetch): Promise<void> {
  if (pending) return pending;
  pending = (async () => {
    try {
      const response = await transport('/api/v1/features', { credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error('FEATURE_CONFIG_UNAVAILABLE');
      const value = await response.json() as { version?: unknown; flags?: unknown; expiresAt?: unknown };
      if (value.version !== 1 || typeof value.expiresAt !== 'number' || !Number.isFinite(value.expiresAt) || value.expiresAt <= Date.now()) throw new Error('FEATURE_CONFIG_INVALID');
      publish(parseFeatureFlags(value.flags), Math.min(value.expiresAt, Date.now() + 60_000));
    } catch { publish(disabledFeatures(), 0); }
  })().finally(() => { pending = undefined; });
  return pending;
}
/** Poll only while visible; visibility and reconnect refresh also apply remote disable. */
export function startFeatureFlags(): () => void {
  const refresh = () => { if (document.visibilityState === 'visible') void refreshFeatureFlags(); };
  refresh();
  const timer = setInterval(refresh, 30_000);
  document.addEventListener('visibilitychange', refresh); window.addEventListener('online', refresh);
  return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('online', refresh); };
}
