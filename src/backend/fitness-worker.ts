import { handleAssistant, assistantAccessStatus } from './assistant/route';
import { createDeepSeekWorker, type DeepSeekWorkerEnv } from './deepseek-worker';
import { verifyAdministrator, requireFreshAccess, type ManagementEnv } from './management-auth';
import { readFeatureFlags, readPublicFeatureFlags, type FeatureConfigEnv } from './feature-config';
import { monitoringError } from '../application/monitoring';
import { DailyUsageStore } from './daily-usage-store';
import { adminBoundary, createAdminContext } from './admin/core/boundary';
import { adminJson, type AdminEnvironment } from './admin/core/contracts';
import { evaluateTodos } from './admin/core/todos';
import { handleConsole, type ConsoleEnv } from './admin/core/console';
import { runAdminSchedule } from './admin/core/schedule';
import { resolveRuntimeEnv, activeAnnouncement } from './admin/finance';
import { collectError, errorCollectionEnabled } from './admin/quality';
import { anonymousBatchSchema, TelemetryStore } from './telemetry-store';
import { handleFeedback } from './feedback';
import { readJsonBody, sameOrigin } from './request';
import { utcDay } from '../domain/local-date';
export interface FitnessWorkerEnv
  extends DeepSeekWorkerEnv, ManagementEnv, FeatureConfigEnv, AdminEnvironment, ConsoleEnv {
  ASSETS?: { fetch(request: Request): Promise<Response> };
  FITNESS_TELEMETRY?: { send(event: unknown): Promise<void> };
  PUSH?: { fetch(request: Request): Promise<Response> };
  /** R2 bucket fitness-models: baked exercise motions, file names carry a content hash. */
  MODELS?: { get(key: string): Promise<{ body: ReadableStream; httpEtag: string } | null> };
}
/** API routing is explicit: missing API configuration must never become the SPA HTML. */
export function createFitnessWorker(control = createDeepSeekWorker(), authenticate = verifyAdministrator) {
  return {
    async scheduled(_event: unknown, env: FitnessWorkerEnv) {
      await runAdminSchedule(env);
    },
    async fetch(request: Request, env: FitnessWorkerEnv): Promise<Response> {
      const path = new URL(request.url).pathname;
      if (path === '/api/v1/coach') return adminJson({ error: 'AI_DISABLED' }, 410);
      if (request.method === 'POST' && ['/api/v1/plans/generate', '/api/v1/stages/summarize'].includes(path)) {
        const payload = await request
          .clone()
          .json()
          .catch(() => null);
        if (payload && typeof payload === 'object' && 'coach' in payload)
          return adminJson({ error: 'AI_DISABLED' }, 410);
      }
      if (path === '/api/v1/trial/access-status' && (await readFeatureFlags(env)).aiAssistantV2)
        return assistantAccessStatus(request, env);
      if (path === '/api/v1/assistant/chat') {
        if (!(await readFeatureFlags(env)).aiAssistantV2) return adminJson({ error: 'AI_DISABLED' }, 503);
        return handleAssistant(request, env);
      }
      // 我的 → 给我们留言: the user's own explicitly sent message, stored for the operator only.
      if (path === '/api/v1/feedback') return handleFeedback(request, env);
      if (path === '/api/v1/announcement' && request.method === 'GET') {
        try {
          return adminJson({
            announcement: env.ADMIN_CONSOLE_ENABLED === 'true' ? await activeAnnouncement(env) : null,
          });
        } catch {
          return adminJson({ announcement: null });
        }
      }
      // Disabled collection drops reports quietly (204) instead of adding a console error to every failure.
      if (path === '/api/v1/telemetry/errors' && env.ADMIN_CONSOLE_ENABLED === 'true')
        return (await errorCollectionEnabled(env)) ? collectError(request, env) : new Response(null, { status: 204 });
      if (path.startsWith('/api/v1/push/')) {
        // Reading the configuration is a capability probe: a missing or disabled
        // service is a normal "feature off" answer, never an HTTP error.
        if (path === '/api/v1/push/config' && request.method === 'GET') {
          if (!env.PUSH) return adminJson({ enabled: false, reason: 'unconfigured' });
          if (!(await readFeatureFlags(env).catch(() => ({ systemNotifications: false }))).systemNotifications)
            return adminJson({ enabled: false, reason: 'disabled' });
          return env.PUSH.fetch(request);
        }
        if (!env.PUSH) return new Response(null, { status: 503 });
        if (request.method !== 'DELETE' && !(await readFeatureFlags(env)).systemNotifications)
          return new Response(null, { status: 503 });
        return env.PUSH.fetch(request);
      }
      if (path === '/api/v1/features' && request.method === 'GET') {
        try {
          return new Response(
            JSON.stringify({ version: 1, flags: await readPublicFeatureFlags(env), expiresAt: Date.now() + 60_000 }),
            { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } },
          );
        } catch {
          return new Response(null, { status: 503, headers: { 'Cache-Control': 'no-store' } });
        }
      }
      if (path === '/api/v1/telemetry/errors' || path === '/api/v1/telemetry/counts') {
        if (request.method !== 'POST' || !sameOrigin(request)) return new Response(null, { status: 403 });
        const flags = await readFeatureFlags(env);
        const enabled = path.endsWith('/errors') ? flags.errorReports : flags.anonymousUsage;
        if (!enabled || (!env.FITNESS_TELEMETRY && !env.FITNESS_OPS_DB)) return new Response(null, { status: 204 });
        try {
          if (!request.headers.get('content-type')?.startsWith('application/json'))
            return new Response(null, { status: 415 });
          // A thrown Response is the reply; unreadable JSON stays a 503 like any other failure here.
          const raw = await readJsonBody(
            request,
            1024,
            problem =>
              new Response(null, { status: problem === 'missing' ? 400 : problem === 'too-large' ? 413 : 503 }),
          );
          const count = anonymousBatchSchema.safeParse(raw);
          const event = path.endsWith('/errors')
            ? monitoringError(raw, true)
            : count.success
              ? { event: count.data.event, count: count.data.count }
              : undefined;
          if (!event) return new Response(null, { status: 400 });
          if (env.FITNESS_OPS_DB)
            await new TelemetryStore(env.FITNESS_OPS_DB).count(
              utcDay(),
              raw,
              path.endsWith('/errors') ? 'errors' : 'counts',
            );
          else await env.FITNESS_TELEMETRY!.send(event);
          return new Response(null, { status: 204 });
        } catch (error) {
          return error instanceof Response ? error : new Response(null, { status: 503 });
        }
      }
      if (path === '/admin' || path.startsWith('/admin/') || path.startsWith('/api/v1/management/')) {
        if (!(await authenticate(request, env)))
          return new Response(JSON.stringify({ error: 'ADMIN_REQUIRED' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
          });
        if (path.startsWith('/api/v1/management/console/')) {
          if (env.ADMIN_CONSOLE_ENABLED !== 'true' || !(await readFeatureFlags(env)).adminConsole)
            return adminJson({ error: 'NOT_FOUND' }, 404);
          try {
            return await adminBoundary(request, createAdminContext(request, env), async (req, context) => {
              const forward = async (operation: string, data: unknown) => {
                const url = new URL(request.url);
                url.pathname = `/api/v1/admin/${operation}`;
                return control.fetch(
                  new Request(url, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      origin: url.origin,
                      authorization: `Bearer ${env.CONTROL_ADMIN_SECRET}`,
                      'x-admin-operation-id': context.requestId,
                      'x-admin-actor': context.actor,
                    },
                    body: JSON.stringify(data),
                  }),
                  await resolveRuntimeEnv(env),
                );
              };
              return handleConsole(req, { ...context, env }, forward);
            });
          } catch {
            return adminJson({ error: 'ADMIN_REQUIRED' }, 403);
          }
        }
        if (path === '/api/v1/management/usage-counts' && request.method === 'GET') {
          if (!(await readFeatureFlags(env)).anonymousUsage || !env.FITNESS_OPS_DB)
            return new Response(null, { status: 404 });
          try {
            return new Response(JSON.stringify(await new TelemetryStore(env.FITNESS_OPS_DB).usage(utcDay())), {
              headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
            });
          } catch {
            return new Response(null, { status: 503 });
          }
        }
        if (path === '/api/v1/management/ops-usage' && request.method === 'GET') {
          if (!(await readFeatureFlags(env)).aiOperations || !env.FITNESS_OPS_DB)
            return new Response(null, { status: 404 });
          try {
            const usage = await new DailyUsageStore(env.FITNESS_OPS_DB).get(utcDay());
            return new Response(JSON.stringify({ timeZone: 'UTC', ...usage }), {
              headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
            });
          } catch {
            return new Response(null, { status: 503 });
          }
        }
        if (path.startsWith('/api/v1/management/')) {
          const operation = path.slice('/api/v1/management/'.length);
          if (
            env.ADMIN_CONSOLE_ENABLED === 'true' &&
            ['subject-delete', 'reissue', 'application-retention'].includes(operation) &&
            !requireFreshAccess(request)
          )
            return adminJson({ error: 'FRESH_ACCESS_REQUIRED' }, 401);
          if (
            ![
              'applications',
              'application-review',
              'application-activate',
              'subject-delete',
              'reissue',
              'application-retention',
              'invites',
              'invites/revoke',
              'revoke',
              'settle',
              'quota-restore',
            ].includes(operation)
          )
            return new Response(null, { status: 404 });
          if (request.method !== 'POST' || !sameOrigin(request, false)) return new Response(null, { status: 403 });
          if (!env.CONTROL_ADMIN_SECRET) return new Response(null, { status: 503 });
          const url = new URL(request.url);
          url.pathname = `/api/v1/admin/${operation}`;
          const forwarded = new Request(url, request);
          forwarded.headers.set('authorization', `Bearer ${env.CONTROL_ADMIN_SECRET}`);
          return control.fetch(forwarded, env);
        }
      }
      const model = /^\/api\/v1\/models\/([a-z0-9-]+_(?:male|female)\.[0-9a-f]{8}\.glb)$/.exec(path);
      if (model && request.method === 'GET') {
        const object = await env.MODELS?.get(model[1]!);
        if (!object) return new Response('Not found', { status: 404 });
        return new Response(object.body, {
          headers: {
            'content-type': 'model/gltf-binary',
            etag: object.httpEtag,
            'cache-control': 'public, max-age=31536000, immutable',
          },
        });
      }
      if (path === '/api' || path.startsWith('/api/')) {
        try {
          const response = await control.fetch(
            request,
            env.ADMIN_CONSOLE_ENABLED === 'true' ? await resolveRuntimeEnv(env) : env,
          );
          return response;
        } catch {
          return adminJson({ error: 'CONTROL_UNAVAILABLE' }, 503);
        }
      }
      if (!env.ASSETS) return new Response('Application assets are unavailable', { status: 503 });
      return env.ASSETS.fetch(request);
    },
  };
}
export default createFitnessWorker();
