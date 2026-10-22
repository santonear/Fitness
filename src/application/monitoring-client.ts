import { isFeatureEnabled } from './feature-flags';
import { monitoringError, type AnonymousEvent, type SafeErrorEvent } from './monitoring';
import { version as packageVersion } from '../../package.json';
const optKey = 'fitness.anonymous-usage';
let counts: Partial<Record<AnonymousEvent, number>> = {};
const reported = new Set<string>();
export const anonymousUsageEnabled = () => {
  try {
    return localStorage.getItem(optKey) === 'true';
  } catch {
    return false;
  }
};
export function setAnonymousUsage(enabled: boolean) {
  localStorage.setItem(optKey, String(enabled));
  if (!enabled) counts = {};
}
export function countUsage(event: AnonymousEvent, count = 1) {
  if (!isFeatureEnabled('anonymousUsage') || !anonymousUsageEnabled() || !Number.isSafeInteger(count) || count < 1)
    return;
  counts[event] = Math.min(1000, (counts[event] ?? 0) + count);
}
export async function flushUsage() {
  if (!isFeatureEnabled('anonymousUsage') || !anonymousUsageEnabled()) {
    counts = {};
    return;
  }
  const batch = counts;
  counts = {};
  for (const [event, count] of Object.entries(batch)) {
    if (!isFeatureEnabled('anonymousUsage') || !anonymousUsageEnabled()) return;
    // No persistent queue/identifier and no automatic retry: a lost count is preferable to duplication.
    try {
      await fetch('/api/v1/telemetry/counts', {
        method: 'POST',
        credentials: 'omit',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optedIn: true, event, count }),
        keepalive: true,
      });
    } catch {
      /* optional aggregate */
    }
  }
}
export function reportSafeError(type: SafeErrorEvent['type']) {
  if (!isFeatureEnabled('errorReports')) return;
  const path = location.pathname,
    page: SafeErrorEvent['page'] =
      path === '/onboarding'
        ? 'onboarding'
        : path.startsWith('/workout')
          ? 'training'
          : path.startsWith('/plans')
            ? 'plan'
            : path === '/review'
              ? 'review'
              : path.startsWith('/settings')
                ? 'settings'
                : 'other';
  const agent = navigator.userAgent,
    browser: SafeErrorEvent['browser'] = /Firefox/.test(agent)
      ? 'firefox'
      : /Chrome|Chromium|Edg/.test(agent)
        ? 'chromium'
        : /Safari/.test(agent)
          ? 'safari'
          : 'other';
  const event = monitoringError({ type, page, version: 'v8', browser }, true);
  const admin = isFeatureEnabled('adminConsole');
  const key = `${admin ? 'admin' : 'legacy'}:${type}:${page}`;
  if (!event || reported.has(key) || reported.size >= 10) return;
  // Neither URLs nor user-agent strings are transmitted; dynamic routes become fixed names.
  const route =
    path === '/'
      ? '/'
      : path === '/today'
        ? '/today'
        : path === '/plans' || path.startsWith('/plans/')
          ? '/plan'
          : path === '/workout' || path.startsWith('/workout/')
            ? '/workout'
            : path === '/history' || path.startsWith('/history/')
              ? '/history'
              : path === '/review' || path.startsWith('/review/')
                ? '/review'
                : path === '/settings' || path.startsWith('/settings/')
                  ? '/settings'
                  : path === '/admin' || path.startsWith('/admin/')
                    ? '/admin'
                    : 'other';
  const family = /Edg\//.test(agent)
    ? 'Edge'
    : /Firefox\//.test(agent)
      ? 'Firefox'
      : /Chrome|Chromium/.test(agent)
        ? 'Chrome'
        : /Safari\//.test(agent)
          ? 'Safari'
          : 'Other';
  const os = /iPhone|iPad/.test(agent)
    ? 'iOS'
    : /Android/.test(agent)
      ? 'Android'
      : /Windows/.test(agent)
        ? 'Windows'
        : /Mac OS/.test(agent)
          ? 'macOS'
          : /Linux/.test(agent)
            ? 'Linux'
            : 'Other';
  const version = import.meta.env.VITE_APP_VERSION ?? packageVersion;
  if (admin && !/^(?:[a-f0-9]{7,40}|\d+\.\d+\.\d+(?:-[a-z0-9.]{1,20})?)$/.test(version)) return;
  const payload = admin
    ? { type: type === 'validation' ? 'unexpected' : type, route, version, browser: family, os, time: Date.now() }
    : event;
  if (!isFeatureEnabled('errorReports')) return;
  reported.add(key);
  void fetch('/api/v1/telemetry/errors', {
    method: 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {});
}
// Expected "feature off" answers are product states, not failures.
const expectedOff = new Set(['AI_DISABLED', 'PUSH_DISABLED', 'ERROR_COLLECTION_DISABLED']);
/**
 * Count same-origin API failures (5xx or no connection) as a 'network' error
 * category. Only the category, canonical route and environment family leave
 * the device: never the URL, request body, response body or user content.
 */
export function instrumentApiFailures(target: { fetch: typeof fetch } = globalThis) {
  const original = target.fetch;
  const wrapped: typeof fetch = async (input, init) => {
    let tracked = false;
    try {
      const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const url = new URL(raw, location.origin);
      tracked =
        url.origin === location.origin &&
        url.pathname.startsWith('/api/') &&
        !url.pathname.startsWith('/api/v1/telemetry/');
    } catch {
      tracked = false;
    }
    try {
      const response = await original.call(target, input, init);
      if (tracked && response.status >= 500)
        void response
          .clone()
          .json()
          .then(
            (body: unknown) => {
              const code = body && typeof body === 'object' ? (body as { error?: unknown }).error : undefined;
              if (typeof code !== 'string' || !expectedOff.has(code)) reportSafeError('network');
            },
            () => reportSafeError('network'),
          );
      return response;
    } catch (error) {
      if (tracked && !init?.signal?.aborted && !(error instanceof DOMException && error.name === 'AbortError'))
        reportSafeError('network');
      throw error;
    }
  };
  target.fetch = wrapped;
  return () => {
    if (target.fetch === wrapped) target.fetch = original;
  };
}
export function startMonitoring() {
  const restoreFetch = instrumentApiFailures();
  const error = () => reportSafeError('unexpected');
  window.addEventListener('error', error);
  window.addEventListener('unhandledrejection', error);
  const timer = setInterval(() => void flushUsage(), 60_000);
  return () => {
    restoreFetch();
    clearInterval(timer);
    window.removeEventListener('error', error);
    window.removeEventListener('unhandledrejection', error);
  };
}
