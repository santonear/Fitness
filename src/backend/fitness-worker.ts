import { createDeepSeekWorker, type DeepSeekWorkerEnv } from './deepseek-worker';
import { verifyAdministrator, type ManagementEnv } from './management-auth';
import { readFeatureFlags, type FeatureConfigEnv } from './feature-config';
import { monitoringError } from '../application/monitoring';
import { z } from 'zod';
import { DailyUsageStore } from './daily-usage-store';
export interface FitnessWorkerEnv extends DeepSeekWorkerEnv, ManagementEnv, FeatureConfigEnv {
  ASSETS?: { fetch(request: Request): Promise<Response> };
  FITNESS_TELEMETRY?: { send(event: unknown): Promise<void> };
}
/** API routing is explicit: missing API configuration must never become the SPA HTML. */
export function createFitnessWorker(control = createDeepSeekWorker(), authenticate = verifyAdministrator) {
  return { async fetch(request: Request, env: FitnessWorkerEnv): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === '/api/v1/features' && request.method === 'GET') return new Response(JSON.stringify({
      version: 1, flags: await readFeatureFlags(env), expiresAt: Date.now() + 60_000,
    }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    if (path === '/api/v1/telemetry/errors' || path === '/api/v1/telemetry/counts') {
      if (request.method !== 'POST' || new URL(request.url).protocol !== 'https:' || request.headers.get('origin') !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') return new Response(null, {status:403});
      const flags = await readFeatureFlags(env);
      const enabled = path.endsWith('/errors') ? flags.errorReports : flags.anonymousUsage;
      if (!enabled || !env.FITNESS_TELEMETRY) return new Response(null, {status:204});
      try {
        if (!request.headers.get('content-type')?.startsWith('application/json')) return new Response(null,{status:415});
        const reader = request.body?.getReader(); if (!reader) return new Response(null,{status:400});
        let text = ''; const decoder = new TextDecoder(); let bytes = 0;
        try { while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength;
          if (bytes > 1024) { await reader.cancel(); return new Response(null,{status:413}); } text += decoder.decode(part.value,{stream:true});
        } text += decoder.decode(); } finally { reader.releaseLock(); }
        const raw: unknown = JSON.parse(text);
        const count = z.strictObject({ optedIn:z.literal(true), event:z.enum(['plan_confirmed','workout_started','workout_completed','review_opened']) }).safeParse(raw);
        const event = path.endsWith('/errors') ? monitoringError(raw,true) : count.success ? {event:count.data.event,count:1} : undefined;
        if (!event) return new Response(null,{status:400});
        await env.FITNESS_TELEMETRY.send(event);
        return new Response(null,{status:204});
      } catch { return new Response(null,{status:503}); }
    }
    if (path === '/admin' || path.startsWith('/admin/') || path.startsWith('/api/v1/management/')) {
      if (!await authenticate(request, env)) return new Response(JSON.stringify({ error: 'ADMIN_REQUIRED' }), { status: 403, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
      if (path === '/api/v1/management/ops-usage' && request.method === 'GET') {
        if (!(await readFeatureFlags(env)).aiOperations || !env.FITNESS_OPS_DB) return new Response(null,{status:404});
        try { const usage = await new DailyUsageStore(env.FITNESS_OPS_DB).get(new Date().toISOString().slice(0,10));
          return new Response(JSON.stringify({timeZone:'UTC',...usage}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
        } catch {return new Response(null,{status:503});}
      }
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
