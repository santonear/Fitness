import { createDeepSeekWorker, type DeepSeekWorkerEnv } from './deepseek-worker';
import { verifyAdministrator, type ManagementEnv } from './management-auth';
export interface FitnessWorkerEnv extends DeepSeekWorkerEnv, ManagementEnv {
  ASSETS?: { fetch(request: Request): Promise<Response> };
}
/** API routing is explicit: missing API configuration must never become the SPA HTML. */
export function createFitnessWorker(control = createDeepSeekWorker(), authenticate = verifyAdministrator) {
  return { async fetch(request: Request, env: FitnessWorkerEnv): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === '/admin' || path.startsWith('/admin/') || path.startsWith('/api/v1/management/')) {
      if (!await authenticate(request, env)) return new Response(JSON.stringify({ error: 'ADMIN_REQUIRED' }), { status: 403, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
      if (path.startsWith('/api/v1/management/')) {
        const operation = path.slice('/api/v1/management/'.length);
        if (!['applications', 'application-review', 'application-activate', 'subject-delete', 'reissue', 'application-retention', 'invites', 'invites/revoke', 'revoke', 'settle', 'quota-restore'].includes(operation)) return new Response(null, { status: 404 });
        if (request.method !== 'POST' || request.headers.get('origin') !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') return new Response(null, { status: 403 });
        if (!env.CONTROL_ADMIN_SECRET) return new Response(null, { status: 503 });
        const url = new URL(request.url); url.pathname = `/api/v1/admin/${operation}`;
        const forwarded = new Request(url, request); forwarded.headers.set('authorization', `Bearer ${env.CONTROL_ADMIN_SECRET}`);
        return control.fetch(forwarded, env);
      }
    }
    if (path === '/api' || path.startsWith('/api/')) return control.fetch(request, env);
    if (!env.ASSETS) return new Response('Application assets are unavailable', { status: 503 });
    return env.ASSETS.fetch(request);
  } };
}
export default createFitnessWorker();
