import { capabilityHash } from '../../push-service';
import { sendAdminPush } from './push-payload';
import { defaultSettings, notificationSettings, notificationAllowed, type Category, type QualityDatabase, type QualityEnv } from './contracts';
import { errorSummary } from './service';

export async function readSettings(db: QualityDatabase) {
  const row = await db.prepare('SELECT value FROM admin_quality_settings WHERE id=1').first<{ value: string }>();
  return row ? notificationSettings.parse(JSON.parse(row.value)) : defaultSettings;
}
export function pushAvailable(env: QualityEnv): boolean { return env.ADMIN_PUSH_ENABLED === 'true' && !!env.VAPID_PRIVATE_JWK && !!env.VAPID_PUBLIC_KEY && !!env.VAPID_SUBJECT; }
export async function enqueueNotification(db: QualityDatabase, category: Category, count: number, eventKey: string, now: number) {
  if (!Number.isSafeInteger(count) || count < 1) throw Error('INVALID_COUNT');
  const id = await capabilityHash(`${category}:${eventKey}`);
  await db.batch([
    db.prepare('INSERT OR IGNORE INTO admin_quality_notifications(id,category,count,created_at) VALUES(?,?,?,?)').bind(id, category, count, now),
    db.prepare('INSERT OR IGNORE INTO admin_quality_deliveries(notification_id,subscription_id) SELECT ?,id FROM admin_quality_subscriptions').bind(id),
  ]);
  return id;
}
/** Call from a scheduled handler; projection contains only an aggregate count. */
export async function evaluateQualityNotifications(env: QualityEnv, now: number, pendingOver48h: number) {
  if (!env.ADMIN_DB) return;
  const active: string[] = [];
  for (const group of (await errorSummary(env.ADMIN_DB, now)).filter(row => row.spike)) active.push(await enqueueNotification(env.ADMIN_DB, 'errors', group.currentHour, `${group.type}:${Math.floor(now / 3600000)}`, now));
  const settings = await readSettings(env.ADMIN_DB);
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: settings.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  if (pendingOver48h > 0) active.push(await enqueueNotification(env.ADMIN_DB, 'applications', pendingOver48h, day, now));
  await env.ADMIN_DB.prepare(`UPDATE admin_quality_deliveries SET state='cancelled' WHERE state='pending' AND notification_id IN (SELECT id FROM admin_quality_notifications WHERE category IN ('errors','applications'))${active.length ? ` AND notification_id NOT IN (${active.map(() => '?').join(',')})` : ''}`).bind(...active).run();
}
export async function dispatchAdminPush(env: QualityEnv, now = Date.now(), send = sendAdminPush) {
  if (!env.ADMIN_DB || !pushAvailable(env)) return { available: false, sent: 0, pending: 0 };
  const db = env.ADMIN_DB;
  const settings = await readSettings(db);
  const { results } = await db.prepare("SELECT d.notification_id,d.subscription_id,d.attempts,n.category,n.count,s.endpoint,s.keys FROM admin_quality_deliveries d JOIN admin_quality_notifications n ON n.id=d.notification_id JOIN admin_quality_subscriptions s ON s.id=d.subscription_id WHERE d.state IN ('pending','sending') AND d.retry_at<=? AND d.attempts<5 ORDER BY n.created_at LIMIT 100").bind(now).all<{ notification_id: string; subscription_id: string; attempts: number; category: Category; count: number; endpoint: string; keys: string }>();
  let sent = 0;
  for (const row of results) {
    if (!notificationAllowed(row.category, settings, now)) continue;
    if (row.category === 'applications') {
      const day = new Intl.DateTimeFormat('en-CA', { timeZone: settings.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
      await db.prepare('INSERT OR IGNORE INTO admin_quality_daily_claims(subscription_id,day,notification_id) VALUES(?,?,?)').bind(row.subscription_id, day, row.notification_id).run();
      const claim = await db.prepare('SELECT notification_id FROM admin_quality_daily_claims WHERE subscription_id=? AND day=?').bind(row.subscription_id, day).first<{ notification_id: string }>();
      if (claim?.notification_id !== row.notification_id) continue;
    }
    const claim = await db.prepare("UPDATE admin_quality_deliveries SET state='sending',retry_at=?,attempts=attempts+1 WHERE notification_id=? AND subscription_id=? AND attempts=? AND retry_at<=? AND state IN ('pending','sending')").bind(now + 60000, row.notification_id, row.subscription_id, row.attempts, now).run();
    if (!claim.meta.changes) continue;
    let status = 0;
    try { status = await send(row.endpoint, env.VAPID_PRIVATE_JWK!, env.VAPID_PUBLIC_KEY!, env.VAPID_SUBJECT!, now, JSON.parse(row.keys), row.category, row.count); } catch { /* No endpoint or exception text is logged. */ }
    const delivered = status >= 200 && status < 300;
    if (delivered) sent++;
    const terminal = status === 404 || status === 410 || (status >= 400 && status < 500 && status !== 408 && status !== 429);
    await db.prepare('UPDATE admin_quality_deliveries SET state=?,retry_at=? WHERE notification_id=? AND subscription_id=?').bind(delivered ? 'sent' : terminal || row.attempts >= 4 ? 'failed' : 'pending', now + Math.min(3600000, 60000 * 2 ** row.attempts), row.notification_id, row.subscription_id).run();
    if (status === 404 || status === 410) await db.prepare('DELETE FROM admin_quality_subscriptions WHERE id=?').bind(row.subscription_id).run();
  }
  return { available: true, sent, pending: results.length - sent };
}
