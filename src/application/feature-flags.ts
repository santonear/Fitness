import { disabledFeatures, featureNames, type FeatureName, type FeatureFlags } from '../domain/feature-flags';
const cacheKey = 'fitness.feature-flags.v1';
let flags = disabledFeatures();
let confirmed = false;
let loaded = false;
let pending: Promise<void> | undefined;
let stopPolling: (() => void) | undefined;
let consumers = 0;
const listeners = new Set<() => void>();
export const subscribeFeatureFlags = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
function mergeFlags(value: unknown): FeatureFlags {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('FEATURE_CONFIG_INVALID');
  const next = { ...flags };
  for (const name of featureNames) {
    if (!Object.hasOwn(value, name)) continue;
    const setting = (value as Record<string, unknown>)[name];
    if (typeof setting !== 'boolean') throw new Error('FEATURE_CONFIG_INVALID');
    next[name] = setting;
  }
  return next;
}
function loadCache() {
  if (loaded) return;
  loaded = true;
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey) ?? 'null');
    if (cached?.version === 1) { flags = mergeFlags(cached.flags); confirmed = true; }
  } catch { /* Missing or unavailable cache leaves first-use defaults unchanged. */ }
}
export function isFeatureEnabled(name: FeatureName): boolean { loadCache(); return flags[name]; }
export function getFeatureFlags(): FeatureFlags { loadCache(); return { ...flags }; }
/** Last validated configuration, not a grant of AI access or external-data consent. */
export const hasValidRemoteConfig = () => { loadCache(); return confirmed; };
function publish(next: FeatureFlags) {
  flags = next; confirmed = true;
  try { localStorage.setItem(cacheKey, JSON.stringify({ version: 1, flags })); } catch { /* Keep in-memory state if storage is unavailable. */ }
  for (const listener of listeners) listener();
}
/** No user ID, cookies, profile, or device details are sent to the public config endpoint. */
export function refreshFeatureFlags(transport: typeof fetch = fetch): Promise<void> {
  loadCache();
  if (pending) return pending;
  pending = (async () => {
    try {
      const response = await transport('/api/v1/features', { credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error('FEATURE_CONFIG_UNAVAILABLE');
      const value = await response.json() as { version?: unknown; flags?: unknown; expiresAt?: unknown };
      if (value.version !== 1 || typeof value.expiresAt !== 'number' || !Number.isFinite(value.expiresAt) || value.expiresAt <= Date.now()) throw new Error('FEATURE_CONFIG_INVALID');
      publish(mergeFlags(value.flags));
    } catch { /* Offline, stale and failed responses cannot revoke a confirmed setting. */ }
  })().finally(() => { pending = undefined; });
  return pending;
}
/** One shared poller; background/offline tabs retain state without sending requests. */
export function startFeatureFlags(): () => void {
  consumers++;
  if (!stopPolling) {
    loadCache();
    if (confirmed) for (const listener of listeners) listener();
    let lastAttempt = -Infinity;
    const refresh = () => {
      if (document.visibilityState !== 'visible' || navigator.onLine === false || Date.now() - lastAttempt < 1000) return;
      lastAttempt = Date.now(); void refreshFeatureFlags();
    };
    // Startup always tries once, including hidden/offline tabs; failures retain cache.
    lastAttempt = Date.now();
    void refreshFeatureFlags();
    const timer = setInterval(refresh, 30_000);
    document.addEventListener('visibilitychange', refresh); window.addEventListener('online', refresh);
    stopPolling = () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('online', refresh); };
  }
  let stopped = false;
  return () => { if (stopped) return; stopped = true; if (--consumers === 0) { stopPolling?.(); stopPolling = undefined; } };
}
