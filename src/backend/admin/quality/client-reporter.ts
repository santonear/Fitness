/** No raw exception, user agent, query string, identifier, or user content crosses this boundary. */
export function installAdminErrorReporter(options: { enabled: boolean; version: string; endpoint?: string }) {
  if (!options.enabled) return () => {};
  let last = 0;
  const report = () => {
    if (Date.now() - last < 60000) return;
    last = Date.now();
    const ua = navigator.userAgent;
    const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Other';
    const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Other';
    const routes = ['/', '/today', '/plan', '/workout', '/history', '/review', '/settings', '/admin'];
    const route = routes.includes(location.pathname) ? location.pathname : 'other';
    void fetch(options.endpoint ?? '/api/v1/telemetry/errors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit', body: JSON.stringify({ type: 'unexpected', route, version: options.version, browser, os, time: last }) }).catch(() => {});
  };
  window.addEventListener('error', report);
  window.addEventListener('unhandledrejection', report);
  return () => { window.removeEventListener('error', report); window.removeEventListener('unhandledrejection', report); };
}
