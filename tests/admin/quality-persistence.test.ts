import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminDatabase, AdminStatement } from '../../src/backend/admin/core/contracts';
import { collectError, errorSummary, recordBlockedCategory, saveEvaluation } from '../../src/backend/admin/quality/service';
import { dispatchAdminPush, enqueueNotification, evaluateQualityNotifications, reconcileNotificationIncidents } from '../../src/backend/admin/quality/notifications';
import { handleQuality } from '../../src/backend/admin/quality';
import { createFitnessWorker } from '../../src/backend/fitness-worker';

function database(extra: string[] = []): AdminDatabase {
  const sqlite = new DatabaseSync(':memory:');
  for (const file of extra) sqlite.exec(readFileSync(file, 'utf8'));
  const migration = readFileSync('migrations/admin/4_quality.sql', 'utf8');
  sqlite.exec(migration); sqlite.exec(migration);
  const incidents = readFileSync('migrations/admin/4_quality_incidents.sql', 'utf8');
  sqlite.exec(incidents); sqlite.exec(incidents);
  let batches: Promise<unknown> = Promise.resolve();
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
    batch(statements) { const operation = batches.then(async () => { sqlite.exec('BEGIN'); try { const result = []; for (const statement of statements) result.push(await statement.run()); sqlite.exec('COMMIT'); return result; } catch (error) { sqlite.exec('ROLLBACK'); throw error; } }); batches = operation.catch(() => {}); return operation; },
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
    for (let i = 0; i < 10; i++) expect((await collectError(new Request('https://test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event) }), { ADMIN_DB: db, ADMIN_ERROR_COLLECTION_ENABLED: 'true' }, now)).status).toBe(202);
    expect((await errorSummary(db, now))[0]).toMatchObject({ count: 10, currentHour: 10, spike: true, browsers: { Safari: 10 } });
    expect((await collectError(new Request('https://test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...event, ip: 'private' }) }), { ADMIN_DB: db, ADMIN_ERROR_COLLECTION_ENABLED: 'true' }, now)).status).toBe(400);
    expect((await errorSummary(db, now))[0].count).toBe(10);
  });
  it('deduplicates synthetic reports and detects conflicting same IDs', async () => {
    const report = { id: crypto.randomUUID(), synthetic: true, time: now, promptVersion: 'v1', model: 'synthetic', scenarios: [{ scenario: 'tone', passed: true, violations: 0 }], durationMs: 1, costMicros: 0 };
    expect(await saveEvaluation(db, report)).toBe(true); expect(await saveEvaluation(db, report)).toBe(false);
    await expect(saveEvaluation(db, { ...report, durationMs: 2 })).rejects.toThrow('CONFLICT');
    await recordBlockedCategory(db, 'pressure', now); await recordBlockedCategory(db, 'pressure', now);
    expect(await db.prepare('SELECT count FROM admin_quality_blocks').first()).toMatchObject({ count: 2 });
  });
  it('persists all actual coach rule categories while retaining legacy category compatibility', async () => {
    const categories = ['judgment', 'command', 'minimizing', 'exaggeration', 'exclamation', 'emoji', 'blame', 'body-shaming', 'medical-claim', 'pressure', 'unsafe-advice', 'other'];
    for (const category of categories) await recordBlockedCategory(db, category, now);
    const rows = (await db.prepare('SELECT category,count FROM admin_quality_blocks ORDER BY category').all<{ category: string; count: number }>()).results;
    expect(rows.map(row => row.category)).toEqual([...categories].sort());
    expect(rows.every(row => row.count === 1)).toBe(true);
    await expect(recordBlockedCategory(db, 'private user note', now)).rejects.toThrow();
  });
  it('imports synthetic reports through the management endpoint and lists the persisted report', async () => {
    const report = { id: crypto.randomUUID(), synthetic: true, time: now, promptVersion: 'v8.1.0', model: 'synthetic', scenarios: [{ scenario: 'tone', passed: true, violations: 0 }], durationMs: 10, costMicros: 0 };
    const context = { env: { ADMIN_DB: db }, now, fresh: true, actor: 'admin', requestId: crypto.randomUUID(), audit: vi.fn(async () => {}) };
    const url = 'https://test/api/v1/management/console/quality/reports';
    expect((await handleQuality(new Request(url, { method: 'POST', body: JSON.stringify(report) }), context))?.status).toBe(200);
    const response = await handleQuality(new Request(url), context);
    expect(await response?.json()).toEqual({ reports: [report], blocks: [] });
    expect(context.audit).toHaveBeenCalledWith('quality.report.save', 'synthetic', 'success');
    expect((await handleQuality(new Request(url, { method: 'POST', body: JSON.stringify({ ...report, output: 'private original model response' }) }), context))?.status).toBe(400);
    expect((await db.prepare('SELECT id FROM admin_quality_evaluations').all()).results).toHaveLength(1);
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
    const response = await handleQuality(new Request('https://test/api/v1/management/console/quality/notifications/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }), { env: { ADMIN_DB: db }, now, fresh: true, actor: 'admin', requestId: 'r1', audit: async () => {} });
    expect(response?.status).toBe(503);
    expect(await response?.json()).toEqual({ error: 'PUSH_UNAVAILABLE' });
  });
  it('cancels resolved reminders before leaving quiet hours', async () => {
    await subscribe();
    await evaluateQualityNotifications(env(), now, 3);
    await evaluateQualityNotifications(env(), now + 1000, 0);
    const send = vi.fn().mockResolvedValue(201);
    await dispatchAdminPush(env(), now + 2000, send);
    expect(send).not.toHaveBeenCalled();
  });
  it('caps delayed and current-day application events at one per day per device', async () => {
    await subscribe();
    await enqueueNotification(db, 'applications', 3, 'old-day', now - 86400000);
    await enqueueNotification(db, 'applications', 4, 'today', now);
    const send = vi.fn().mockResolvedValue(201);
    await dispatchAdminPush(env(), now, send);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('rejects cross-origin and streamed oversize error bodies without persistence', async () => {
    const options = { ADMIN_DB: db, ADMIN_ERROR_COLLECTION_ENABLED: 'true' };
    expect((await collectError(new Request('https://test/errors', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' }, body: '{}' }), options, now)).status).toBe(403);
    let cancelled = false;
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(2049)); }, cancel() { cancelled = true; } });
    const request = new Request('https://test/errors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: stream, duplex: 'half' } as RequestInit);
    expect((await collectError(request, options, now)).status).toBe(400);
    expect(cancelled).toBe(true);
    expect((await db.prepare('SELECT * FROM admin_quality_errors').all()).results).toHaveLength(0);
  });
  it('removes a subscription and pending deliveries, idempotently', async () => {
    const id = 'a'.repeat(64);
    await db.prepare('INSERT INTO admin_quality_subscriptions(id,endpoint,created_at) VALUES(?,?,?)').bind(id, 'https://fcm.googleapis.com/test', now).run();
    await enqueueNotification(db, 'test', 1, 'remove', now);
    const context = { env: { ADMIN_DB: db }, now, fresh: true, actor: 'admin', requestId: 'r1', audit: async () => {} };
    for (let i = 0; i < 2; i++) expect((await handleQuality(new Request('https://test/api/v1/management/console/quality/notifications/unsubscribe', { method: 'POST', body: JSON.stringify({ id }) }), context))?.status).toBe(200);
    expect((await db.prepare('SELECT * FROM admin_quality_subscriptions').all()).results).toHaveLength(0);
    expect(await db.prepare('SELECT state FROM admin_quality_deliveries').first()).toMatchObject({ state: 'cancelled' });
  });
  it('notifies once per active incident and creates a new notification after resolution and recurrence', async () => {
    await subscribe(); const event = { id: 'finance-ledger-reconciliation', category: 'ledger' as const, count: 3 };
    await reconcileNotificationIncidents(db, [event], now);
    await reconcileNotificationIncidents(db, [{ ...event, count: 4 }], now + 1);
    expect((await db.prepare('SELECT * FROM admin_quality_notifications').all()).results).toHaveLength(1);
    await reconcileNotificationIncidents(db, [], now + 2);
    expect(await db.prepare('SELECT state FROM admin_quality_deliveries').first()).toMatchObject({ state: 'cancelled' });
    await reconcileNotificationIncidents(db, [event], now + 3);
    expect((await db.prepare('SELECT * FROM admin_quality_notifications').all()).results).toHaveLength(2);
    const send = vi.fn().mockResolvedValue(201);
    await dispatchAdminPush(env(), now + 4, send);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0].slice(-2)).toEqual(['ledger', 3]);
  });
  it('serializes concurrent snapshots, rejects stale snapshots and rolls back incomplete incident writes', async () => {
    await subscribe(); const event = { id: 'smoke:preview:release1', category: 'smoke' as const, count: 2 };
    await Promise.all([reconcileNotificationIncidents(db, [event], now), reconcileNotificationIncidents(db, [event], now)]);
    expect((await db.prepare('SELECT * FROM admin_quality_notifications').all()).results).toHaveLength(1);
    await reconcileNotificationIncidents(db, [], now + 2);
    await reconcileNotificationIncidents(db, [event], now + 1);
    expect(await db.prepare('SELECT active,generation FROM admin_quality_incidents').first()).toMatchObject({ active: 0, generation: 1 });
    const broken = { ...db, batch: (statements: AdminStatement[]) => db.batch([...statements, db.prepare('INSERT INTO nonexistent VALUES(1)')]) };
    await expect(reconcileNotificationIncidents(broken, [event], now + 3)).rejects.toThrow();
    expect(await db.prepare('SELECT active,generation FROM admin_quality_incidents').first()).toMatchObject({ active: 0, generation: 1 });
    await reconcileNotificationIncidents(db, [event], now + 3);
    expect(await db.prepare('SELECT active,generation FROM admin_quality_incidents').first()).toMatchObject({ active: 1, generation: 2 });
  });
  it('resends a previously delivered event only after a completed resolution cycle', async () => {
    await subscribe(); const event = { id: 'finance-budget-2026-10-100', category: 'budget100' as const, count: 1 };
    const send = vi.fn().mockResolvedValue(201);
    await reconcileNotificationIncidents(db, [event], now);
    await dispatchAdminPush(env(), now, send);
    await reconcileNotificationIncidents(db, [event], now + 1);
    await dispatchAdminPush(env(), now + 1, send);
    expect(send).toHaveBeenCalledTimes(1);
    await reconcileNotificationIncidents(db, [], now + 2);
    await reconcileNotificationIncidents(db, [event], now + 3);
    await dispatchAdminPush(env(), now + 3, send);
    expect(send).toHaveBeenCalledTimes(2);
  });
  it('does not revive a cancelled delivery after an in-flight transport failure', async () => {
    await subscribe(); const event = { id: 'finance-ledger-reconciliation', category: 'ledger' as const, count: 1 };
    await reconcileNotificationIncidents(db, [event], now);
    const send = vi.fn(async () => { await reconcileNotificationIncidents(db, [], now + 1); return 503; });
    await dispatchAdminPush(env(), now, send);
    expect(await db.prepare('SELECT state FROM admin_quality_deliveries').first()).toMatchObject({ state: 'cancelled' });
    await dispatchAdminPush(env(), now + 60000, send);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
describe('client error reports reach the admin error count end to end', () => {
  it('a client network failure report through the public worker route is counted on the errors page', async () => {
    const db = database(['migrations/admin/1_core.sql', 'migrations/admin/2_releases.sql']), worker = createFitnessWorker();
    const env = { ADMIN_CONSOLE_ENABLED: 'true', ADMIN_ENVIRONMENT: 'production' as const, ADMIN_ERROR_COLLECTION_ENABLED: 'true', FITNESS_FEATURE_FLAGS: JSON.stringify({ errorReports: true }), ADMIN_DB: db };
    const payload = { type: 'network', route: '/settings', version: '0.1.0', browser: 'Chrome', os: 'Android', time: Date.now() };
    const post = () => new Request('https://fitness.test/api/v1/telemetry/errors', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://fitness.test' }, body: JSON.stringify(payload) });
    expect((await worker.fetch(post(), env)).status).toBe(202);
    const groups = await errorSummary(db, Date.now());
    expect(groups.find(group => group.type === 'network')?.count).toBe(1);
    const context = { env, actor: 'admin', now: Date.now(), fresh: true, requestId: crypto.randomUUID(), audit: async () => {} };
    const page = await handleQuality(new Request('https://fitness.test/api/v1/management/console/quality/errors'), context);
    expect(await page!.json()).toMatchObject({ collecting: true, groups: [{ type: 'network', count: 1 }] });
    // With collection switched off the report is dropped quietly and the page says collection is off.
    const off = { ...env, ADMIN_ERROR_COLLECTION_ENABLED: 'false' };
    expect((await worker.fetch(post(), off)).status).toBe(204);
    expect(await (await handleQuality(new Request('https://fitness.test/api/v1/management/console/quality/errors'), { ...context, env: off }))!.json()).toMatchObject({ collecting: false });
  });
});
