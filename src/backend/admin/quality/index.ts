import { pushSubscription, capabilityHash } from '../../push-service';
import { z } from 'zod';
import { adminJson, requireAdminDb, type AdminContext } from '../core/contracts';
import { notificationSettings, type QualityEnv } from './contracts';
import { errorCollectionEnabled, errorSummary, saveEvaluation } from './service';
import { appPushUnavailableReason, dispatchAdminPush, enqueueNotification, pushAvailable, pushUnavailableReason, readSettings } from './notifications';
export * from './service';
export * from './notifications';
export type { QualityEnv } from './contracts';

export async function handleQuality(request: Request, context: AdminContext<QualityEnv>): Promise<Response | undefined> {
  const path = new URL(request.url).pathname.replace('/api/v1/management/console/quality', '');
  if (!new URL(request.url).pathname.startsWith('/api/v1/management/console/quality/')) return undefined;
  const db = requireAdminDb(context);
  if (request.method === 'GET') {
    if (path === '/errors') return adminJson({ groups: await errorSummary(db, context.now), collecting: await errorCollectionEnabled(context.env) });
    if (path === '/reports') {
      const { results } = await db.prepare('SELECT report FROM admin_quality_evaluations ORDER BY time DESC LIMIT 100').all<{ report: string }>();
      return adminJson({ reports: results.map(row => JSON.parse(row.report)), blocks: (await db.prepare('SELECT day,category,count FROM admin_quality_blocks ORDER BY day DESC LIMIT 200').all()).results });
    }
    if (path === '/notifications') return adminJson({ settings: await readSettings(db), available: pushAvailable(context.env), reason: pushUnavailableReason(context.env), appReason: await appPushUnavailableReason(context.env), publicKey: context.env.VAPID_PUBLIC_KEY ?? null, subscriptions: (await db.prepare('SELECT id,created_at FROM admin_quality_subscriptions').all()).results });
  }
  if (request.method !== 'POST') return undefined;
  let body: unknown; try { body = await request.json(); } catch { return adminJson({ error: 'INVALID_JSON' }, 400); }
  if (path === '/reports') {
    try { await saveEvaluation(db, body); } catch { return adminJson({ error: 'INVALID_OR_CONFLICTING_SYNTHETIC_REPORT' }, 400); }
    await context.audit('quality.report.save', 'synthetic', 'success');
    return adminJson({ saved: true });
  }
  if (path === '/notifications/settings') {
    const parsed = notificationSettings.safeParse(body);
    if (!parsed.success) return adminJson({ error: 'INVALID_SETTINGS' }, 400);
    await db.prepare('INSERT INTO admin_quality_settings(id,value) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').bind(JSON.stringify(parsed.data)).run();
    await context.audit('quality.notifications.settings', 'admin', 'success');
    return adminJson({ settings: parsed.data });
  }
  if (path === '/notifications/subscribe') {
    if (!pushAvailable(context.env)) return adminJson({ error: 'PUSH_UNAVAILABLE' }, 503);
    const parsed = pushSubscription.safeParse(body);
    if (!parsed.success) return adminJson({ error: 'INVALID_SUBSCRIPTION' }, 400);
    const id = await capabilityHash(parsed.data.endpoint);
    await db.prepare('INSERT INTO admin_quality_subscriptions(id,endpoint,keys,created_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET keys=excluded.keys').bind(id, parsed.data.endpoint, JSON.stringify(parsed.data.keys), context.now).run();
    await context.audit('quality.notifications.subscribe', id.slice(0, 8), 'success');
    return adminJson({ id });
  }
  if (path === '/notifications/test') {
    if (!pushAvailable(context.env)) return adminJson({ error: 'PUSH_UNAVAILABLE' }, 503);
    const subscription = await db.prepare('SELECT id FROM admin_quality_subscriptions LIMIT 1').first();
    if (!subscription) return adminJson({ error: 'NO_SUBSCRIPTION' }, 409);
    await enqueueNotification(db, 'test', 1, context.requestId, context.now);
    const result = await dispatchAdminPush(context.env, context.now);
    await context.audit('quality.notifications.test', 'admin', result.sent ? 'accepted-by-push-service' : 'pending');
    return adminJson({ ...result, delivery: result.sent ? 'accepted-by-push-service' : 'pending' }, result.sent ? 200 : 202);
  }
  if (path === '/notifications/unsubscribe') {
    const parsed = z.object({ id: z.string().regex(/^[a-f0-9]{64}$/) }).strict().safeParse(body);
    if (!parsed.success) return adminJson({ error: 'INVALID_SUBSCRIPTION' }, 400);
    await db.batch([
      db.prepare("UPDATE admin_quality_deliveries SET state='cancelled' WHERE subscription_id=? AND state='pending'").bind(parsed.data.id),
      db.prepare('DELETE FROM admin_quality_subscriptions WHERE id=?').bind(parsed.data.id),
    ]);
    await context.audit('quality.notifications.unsubscribe', parsed.data.id.slice(0, 8), 'success');
    return adminJson({ removed: true });
  }
  return undefined;
}
