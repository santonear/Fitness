import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminDatabase, AdminStatement } from '../../src/backend/admin/core/contracts';
import { collectError, errorSummary, recordBlockedCategory, saveEvaluation } from '../../src/backend/admin/quality/service';
import { dispatchAdminPush, enqueueNotification, evaluateQualityNotifications } from '../../src/backend/admin/quality/notifications';
import { handleQuality } from '../../src/backend/admin/quality';

function database(): AdminDatabase {
  const sqlite = new DatabaseSync(':memory:');
  const migration = readFileSync('migrations/admin/4_quality.sql', 'utf8');
  sqlite.exec(migration); sqlite.exec(migration);
  return {
    prepare(sql) {
      let values: (string | number | null)[] = [];
      const statement: AdminStatement = {
        bind(...args) { values = args as typeof values; return statement; },
        async first<T>() { return (sqlite.prepare(sql).get(...values) ?? null) as T | null; },
        async all<T>() { return { results: sqlite.prepare(sql).all(...values) as T[] }; },
        async run() { const result = sqlite.prepare(sql).run(...values); return { success: true, meta: { changes: Number(result.changes) } }; },
      }; return statement;
    },
    async batch(statements) { sqlite.exec('BEGIN'); try { const result = []; for (const statement of statements) result.push(await statement.run()); sqlite.exec('COMMIT'); return result; } catch (error) { sqlite.exec('ROLLBACK'); throw error; } },
  };
}
describe('quality SQLite persistence and retry', () => {
  let db: AdminDatabase;
  const now = Date.parse('2026-10-11T01:00:00Z');
  beforeEach(() => { db = database(); });
  const env = () => ({ ADMIN_DB: db, ADMIN_PUSH_ENABLED: 'true', VAPID_PRIVATE_JWK: '{}', VAPID_PUBLIC_KEY: 'test', VAPID_SUBJECT: 'mailto:admin@example.com' });
  async function subscribe() { await db.prepare('INSERT INTO admin_quality_subscriptions(id,endpoint,created_at) VALUES(?,?,?)').bind('s1', 'https://fcm.googleapis.com/test', now).run(); }
  it('persists exact error metadata and groups rolling same-hour spikes', async () => {
    const event = { type: 'storage', route: '/workout', version: '1.0.0', browser: 'Safari', os: 'iOS', time: now };
    for (let i = 0; i < 10; i++) expect((await collectError(new Request('https://test', { method: 'POST', body: JSON.stringify(event) }), { ADMIN_DB: db, ADMIN_ERROR_COLLECTION_ENABLED: 'true' }, now)).status).toBe(202);
    expect((await errorSummary(db, now))[0]).toMatchObject({ count: 10, currentHour: 10, spike: true, browsers: { Safari: 10 } });
    expect((await collectError(new Request('https://test', { method: 'POST', body: JSON.stringify({ ...event, ip: 'private' }) }), { ADMIN_DB: db, ADMIN_ERROR_COLLECTION_ENABLED: 'true' }, now)).status).toBe(400);
    expect((await errorSummary(db, now))[0].count).toBe(10);
  });
  it('deduplicates synthetic reports and detects conflicting same IDs', async () => {
    const report = { id: crypto.randomUUID(), synthetic: true, time: now, promptVersion: 'v1', model: 'synthetic', scenarios: [{ scenario: 'tone', passed: true, violations: 0 }], durationMs: 1, costMicros: 0 };
    expect(await saveEvaluation(db, report)).toBe(true); expect(await saveEvaluation(db, report)).toBe(false);
    await expect(saveEvaluation(db, { ...report, durationMs: 2 })).rejects.toThrow('CONFLICT');
    await recordBlockedCategory(db, 'pressure', now); await recordBlockedCategory(db, 'pressure', now);
    expect(await db.prepare('SELECT count FROM admin_quality_blocks').first()).toMatchObject({ count: 2 });
  });
  it('deduplicates daily applications and retries transient delivery without duplicate successful sends', async () => {
    await subscribe();
    await evaluateQualityNotifications(env(), now, 3); await evaluateQualityNotifications(env(), now + 1000, 4);
    expect((await db.prepare('SELECT * FROM admin_quality_notifications').all()).results).toHaveLength(1);
    const send = vi.fn().mockResolvedValueOnce(503).mockResolvedValue(201);
    expect((await dispatchAdminPush(env(), now, send)).sent).toBe(0);
    await dispatchAdminPush(env(), now + 1000, send); expect(send).toHaveBeenCalledTimes(1);
    expect((await dispatchAdminPush(env(), now + 60000, send)).sent).toBe(1);
    await dispatchAdminPush(env(), now + 120000, send); expect(send).toHaveBeenCalledTimes(2);
  });
  it('honors quiet hours, urgent exemption, concurrent claims and expired subscriptions', async () => {
    await subscribe(); const quiet = Date.parse('2026-10-11T15:00:00Z');
    await enqueueNotification(db, 'errors', 10, 'error-hour', quiet);
    const send = vi.fn().mockResolvedValue(201);
    await dispatchAdminPush(env(), quiet, send); expect(send).not.toHaveBeenCalled();
    await enqueueNotification(db, 'ledger', 1, 'ledger-case', quiet);
    await Promise.all([dispatchAdminPush(env(), quiet, send), dispatchAdminPush(env(), quiet, send)]);
    expect(send).toHaveBeenCalledTimes(1);
    await enqueueNotification(db, 'test', 1, 'expired', quiet);
    await dispatchAdminPush(env(), quiet, vi.fn().mockResolvedValue(410));
    expect((await db.prepare('SELECT id FROM admin_quality_subscriptions').all()).results).toHaveLength(0);
  });
  it('reports missing push secrets as unavailable rather than success', async () => {
    const response = await handleQuality(new Request('https://test/api/v1/management/console/quality/notifications/test', { method: 'POST', body: '{}' }), { env: { ADMIN_DB: db }, now, fresh: true, actor: 'admin', requestId: 'r1', audit: async () => {} });
    expect(response?.status).toBe(503);
    expect(await response?.json()).toEqual({ error: 'PUSH_UNAVAILABLE' });
  });
});
