import { capabilityHash, duePushDay, pushSchedule, pushSubscription, sendGenericPush } from './push-service';
import type { PushSchedule } from './push-service';
import { readFeatureFlags, type FeatureConfigEnv } from './feature-config';
interface Statement { bind(...values: unknown[]): Statement; run(): Promise<{ meta: { changes: number } }>; all<T>(): Promise<{ results: T[] }>; first<T>(): Promise<T | null> }
interface Database { prepare(sql: string): Statement }
export interface PushEnv extends FeatureConfigEnv {
  PUSH_DB: Database; PUSH_ENABLED?: string; APP_ORIGIN: string;
  VAPID_PRIVATE_JWK: string; VAPID_PUBLIC_KEY: string; VAPID_SUBJECT: string;
}
interface Stored { id: string; endpoint: string; schedule: string; last_day: string | null; retry_at: number | null; attempts: number }
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
async function pushAllowed(env: PushEnv) {
  if (env.PUSH_ENABLED !== 'true') return false;
  const flags = await readFeatureFlags(env);
  return flags.pwaOffline && flags.systemNotifications;
}
export async function pushFetch(request: Request, env: PushEnv): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname === '/api/v1/push/config') { const enabled = await pushAllowed(env); return json({ enabled, publicKey: enabled ? env.VAPID_PUBLIC_KEY : undefined }); }
  if (url.pathname !== '/api/v1/push/subscription') return json({ error: 'NOT_FOUND' }, 404);
  if (!['POST','DELETE'].includes(request.method)) return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  if (request.headers.get('Origin') !== env.APP_ORIGIN) return json({ error: 'ORIGIN_REQUIRED' }, 403);
  const token = request.headers.get('Authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
  if (!token) return json({ error: 'DEVICE_CAPABILITY_REQUIRED' }, 401);
  const id = await capabilityHash(token);
  // Deletion remains available while remotely disabled.
  if (request.method === 'DELETE') { await env.PUSH_DB.prepare('DELETE FROM push_subscriptions WHERE id = ?').bind(id).run(); return json({ deleted: true }); }
  if (!await pushAllowed(env)) return json({ error: 'PUSH_DISABLED' }, 503);
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json({ error: 'JSON_REQUIRED' }, 415);
  // Stream limit applies even when Content-Length is absent or dishonest.
  let text = ''; const reader = request.body?.getReader();
  if (!reader) return json({ error: 'INVALID_SUBSCRIPTION' }, 400);
  const decoder = new TextDecoder(); let length = 0;
  while (true) { const chunk = await reader.read(); if (chunk.done) break; length += chunk.value.byteLength; if (length > 8192) { await reader.cancel(); return json({ error: 'TOO_LARGE' }, 413); } text += decoder.decode(chunk.value, { stream: true }); }
  let value: unknown; try { value = JSON.parse(text + decoder.decode()); } catch { return json({ error: 'INVALID_SUBSCRIPTION' }, 400); }
  if (!value || typeof value !== 'object' || Object.keys(value).some(key => !['subscription','schedule'].includes(key))) return json({ error: 'INVALID_SUBSCRIPTION' }, 400);
  const input = value as Record<string, unknown>, subscription = pushSubscription.safeParse(input.subscription), schedule = pushSchedule.safeParse(input.schedule);
  if (!subscription.success || !schedule.success) return json({ error: 'INVALID_SUBSCRIPTION' }, 400);
  // A deliberate preview cap; production provisioning/rate limits require separate approval.
  const existing = await env.PUSH_DB.prepare('SELECT id FROM push_subscriptions WHERE id = ?').bind(id).first();
  const count = await env.PUSH_DB.prepare('SELECT COUNT(*) AS count FROM push_subscriptions').first<{ count: number }>();
  if (!existing && (count?.count ?? 0) >= 100) return json({ error: 'PREVIEW_CAPACITY' }, 429);
  if (!await pushAllowed(env)) return json({ error: 'PUSH_DISABLED' }, 503);
  try {
    await env.PUSH_DB.prepare('INSERT INTO push_subscriptions (id, endpoint, keys_json, schedule, updated_at, attempts) VALUES (?, ?, ?, ?, ?, 0) ON CONFLICT(id) DO UPDATE SET endpoint=excluded.endpoint, keys_json=excluded.keys_json, schedule=excluded.schedule, updated_at=excluded.updated_at, retry_at=NULL').bind(id, subscription.data.endpoint, JSON.stringify(subscription.data.keys), JSON.stringify(schedule.data), Date.now()).run();
  } catch { return json({ error: 'SUBSCRIPTION_CONFLICT' }, 409); }
  return json({ subscribed: true });
}
export async function dispatchPush(env: PushEnv, now = Date.now(), send = sendGenericPush): Promise<void> {
  if (!await pushAllowed(env)) return;
  const { results } = await env.PUSH_DB.prepare('SELECT id, endpoint, schedule, last_day, retry_at, attempts FROM push_subscriptions ORDER BY id LIMIT 100').all<Stored>();
  for (const row of results) {
    let schedule: PushSchedule; try { schedule = pushSchedule.parse(JSON.parse(row.schedule)); } catch { continue; }
    const day = duePushDay(schedule, now);
    const retry = row.retry_at !== null && row.retry_at <= now && now - row.retry_at <= 120000 && row.attempts < 2 && duePushDay(schedule, now, false) === row.last_day;
    if ((!day || day === row.last_day) && !retry) continue;
    // Transactional compare-and-swap before any external send. Unknown delivery is not retried.
    const claim = retry
      ? await env.PUSH_DB.prepare('UPDATE push_subscriptions SET attempts=attempts+1, retry_at=NULL WHERE id=? AND retry_at=? AND attempts=?').bind(row.id, row.retry_at, row.attempts).run()
      : await env.PUSH_DB.prepare('UPDATE push_subscriptions SET last_day=?, attempts=1, retry_at=NULL WHERE id=? AND (last_day IS NULL OR last_day < ?)').bind(day, row.id, day).run();
    if (!claim.meta.changes) continue;
    // Recheck presence after claim so a concurrent unsubscribe normally cancels dispatch.
    if (!await env.PUSH_DB.prepare('SELECT id FROM push_subscriptions WHERE id=?').bind(row.id).first()) continue;
    if (!await pushAllowed(env)) return;
    let status: number; try { status = await send(row.endpoint, env.VAPID_PRIVATE_JWK, env.VAPID_PUBLIC_KEY, env.VAPID_SUBJECT, now); } catch { continue; }
    if (status === 404 || status === 410) await env.PUSH_DB.prepare('DELETE FROM push_subscriptions WHERE id=?').bind(row.id).run();
    else if (!retry && (status === 429 || status === 503)) await env.PUSH_DB.prepare('UPDATE push_subscriptions SET retry_at=? WHERE id=? AND last_day=? AND attempts=1').bind(now + 60000, row.id, day).run();
  }
}
export default { fetch: pushFetch, scheduled: (_event: unknown, env: PushEnv, context: { waitUntil(promise: Promise<void>): void }) => context.waitUntil(dispatchPush(env)) };
