import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { AdminDatabase, AdminStatement } from '../../src/backend/admin/core/contracts';
import { FEEDBACK_HOURLY_LIMIT, handleFeedback } from '../../src/backend/feedback';
import { handleFeedbackAdmin } from '../../src/backend/admin/feedback';
import { createFitnessWorker } from '../../src/backend/fitness-worker';
import { digest } from '../../src/backend/contracts';
import { initialState } from '../../src/backend/store';
import type { D1Binding } from '../../src/backend/d1-store';

const migration = 'migrations/admin/6_user_feedback.sql';
function database(): { db: AdminDatabase; sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync('migrations/admin/1_core.sql', 'utf8'));
  // Idempotent: applying twice must neither fail nor change the schema.
  sqlite.exec(readFileSync(migration, 'utf8')); sqlite.exec(readFileSync(migration, 'utf8'));
  const db: AdminDatabase = {
    prepare(sql) {
      let values: (string | number | null)[] = [];
      const statement: AdminStatement = {
        bind(...args) { values = args as typeof values; return statement; },
        async first<T>() { return (sqlite.prepare(sql).get(...values) ?? null) as T | null; },
        async all<T>() { return { results: sqlite.prepare(sql).all(...values) as T[] }; },
        async run() { const result = sqlite.prepare(sql).run(...values); return { success: true, meta: { changes: Number(result.changes) } }; },
      }; return statement;
    },
    async batch(statements) { sqlite.exec('BEGIN'); try { const out = []; for (const s of statements) out.push(await s.run()); sqlite.exec('COMMIT'); return out; } catch (e) { sqlite.exec('ROLLBACK'); throw e; } },
  };
  return { db, sqlite };
}
const origin = 'https://fitness.test';
const post = (body: unknown, headers: Record<string, string> = {}) => new Request(`${origin}/api/v1/feedback`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, 'cf-connecting-ip': '203.0.113.7', ...headers }, body: JSON.stringify(body) });
const message = (text = '计时结束的提示音太小了') => ({ id: crypto.randomUUID(), message: text, locale: 'zh' as const });

describe('user feedback endpoint', () => {
  it('migration is idempotent and creates the feedback and rate tables', () => {
    const { sqlite } = database();
    const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'user_feedback%' ORDER BY name").all() as { name: string }[];
    expect(tables.map(t => t.name)).toEqual(['user_feedback', 'user_feedback_rate']);
  });

  it('stores an anonymous message through the real worker route, once per request id, without logging its text', async () => {
    const { db, sqlite } = database(); const worker = createFitnessWorker();
    const log = vi.spyOn(console, 'log'), warn = vi.spyOn(console, 'warn'), error = vi.spyOn(console, 'error');
    const body = { ...message('希望能导出到手机日历'), contact: 'me@example.com' };
    const env = { ADMIN_DB: db, CONTROL_DIGEST_SECRET: 'f'.repeat(64) };
    const first = await worker.fetch(post(body), env);
    expect(first.status).toBe(201); expect(await first.json()).toEqual({ ok: true, id: body.id });
    const again = await worker.fetch(post(body), env);
    expect(again.status).toBe(200);
    const rows = sqlite.prepare('SELECT * FROM user_feedback').all() as Record<string, unknown>[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: body.id, message: '希望能导出到手机日历', contact: 'me@example.com', subject_short_id: null, status: 'new', locale: 'zh' });
    // The replay did not count against the sender; no raw address is stored anywhere.
    const rate = sqlite.prepare('SELECT key,count FROM user_feedback_rate ORDER BY key').all() as { key: string; count: number }[];
    expect(rate.map(r => r.count)).toEqual([1, 1]);
    expect(JSON.stringify(rate)).not.toContain('203.0.113.7');
    for (const spy of [log, warn, error]) expect(JSON.stringify(spy.mock.calls)).not.toContain('导出到手机日历');
    log.mockRestore(); warn.mockRestore(); error.mockRestore();
  });

  it('rejects cross-origin, oversize, empty and extra fields (no health data can ride along)', async () => {
    const { db, sqlite } = database(); const env = { ADMIN_DB: db };
    expect((await handleFeedback(post(message(), { Origin: 'https://evil.test' }), env)).status).toBe(403);
    expect((await handleFeedback(post(message(), { 'sec-fetch-site': 'cross-site' }), env)).status).toBe(403);
    expect((await handleFeedback(post(message('x'.repeat(1001))), env)).status).toBe(400);
    expect((await handleFeedback(post(message('   ')), env)).status).toBe(400);
    expect((await handleFeedback(post({ ...message(), workouts: [{ id: 'w' }] }), env)).status).toBe(400);
    expect((await handleFeedback(post({ ...message(), contact: 'c'.repeat(101) }), env)).status).toBe(400);
    expect((await handleFeedback(new Request(`${origin}/api/v1/feedback`, { method: 'GET' }), env)).status).toBe(405);
    expect((await handleFeedback(post(message()), {})).status).toBe(503);
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM user_feedback').get()).toEqual({ n: 0 });
  });

  it('rate-limits each sender per hour while other senders still get through', async () => {
    const { db, sqlite } = database(); const env = { ADMIN_DB: db, CONTROL_DIGEST_SECRET: 'f'.repeat(64) }; const now = Date.parse('2026-10-19T08:10:00Z');
    for (let i = 0; i < FEEDBACK_HOURLY_LIMIT; i++) expect((await handleFeedback(post(message(`第 ${i} 条`)), env, now)).status).toBe(201);
    expect((await handleFeedback(post(message('太多了')), env, now)).status).toBe(429);
    expect((await handleFeedback(post(message('另一个人'), { 'cf-connecting-ip': '198.51.100.2' }), env, now)).status).toBe(201);
    // The next hour opens a new window.
    expect((await handleFeedback(post(message('一小时后')), env, now + 3600000)).status).toBe(201);
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM user_feedback').get()).toEqual({ n: FEEDBACK_HOURLY_LIMIT + 2 });
  });

  it('attaches only the 8-character subject ID for a valid trial cookie', async () => {
    const { db, sqlite } = database(); const secret = 'a'.repeat(64), token = 'b'.repeat(64), subjectId = '12345678-aaaa-4bbb-8ccc-000000000001';
    const state = initialState(); state.subjects[subjectId] = { expiresAt: Date.now() + 86400000, revoked: false }; state.sessions[await digest(token, secret)] = { subjectId, revoked: false };
    const control: D1Binding = { withSession: () => ({ prepare: () => ({ bind() { return this; }, first: async <T,>() => ({ state: JSON.stringify(state) }) as T, run: async () => ({ success: true, meta: {} }) }) }) };
    const response = await handleFeedback(post(message('有资格的用户'), { cookie: `__Host-fitness_trial=${token}` }), { ADMIN_DB: db, CONTROL_DB: control, CONTROL_DIGEST_SECRET: secret });
    expect(response.status).toBe(201);
    expect(sqlite.prepare('SELECT subject_short_id FROM user_feedback').get()).toEqual({ subject_short_id: '12345678' });
    // An unknown cookie is simply anonymous, never an error.
    expect((await handleFeedback(post(message('未知资格'), { cookie: `__Host-fitness_trial=${'c'.repeat(64)}` }), { ADMIN_DB: db, CONTROL_DB: control, CONTROL_DIGEST_SECRET: secret })).status).toBe(201);
  });

  it('admin lists open and all messages and marks them handled with an audit entry', async () => {
    const { db, sqlite } = database(); const env = { ADMIN_DB: db, CONTROL_DIGEST_SECRET: 'f'.repeat(64) };
    const a = message('第一条'), b = message('第二条');
    await handleFeedback(post(a), env, 1000); await handleFeedback(post(b), env, 2000);
    const audit: string[] = [];
    const context = { env: { ADMIN_DB: db }, actor: 'admin@test', now: 3000, fresh: true, requestId: 'r'.repeat(20), audit: async (action: string, id: string) => { audit.push(`${action}:${id}`); } };
    const list = async (filter: string) => (await (await handleFeedbackAdmin(new Request(`${origin}/api/v1/management/console/feedback?filter=${filter}`), context))!.json()) as { items: { id: string; status: string }[]; open: number; total: number };
    expect(await list('open')).toMatchObject({ open: 2, total: 2, items: [{ id: b.id }, { id: a.id }] });
    const mark = (id: string, status: string) => handleFeedbackAdmin(new Request(`${origin}/api/v1/management/console/feedback/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) }), context);
    expect((await mark(a.id, 'handled'))!.status).toBe(200);
    expect(await list('open')).toMatchObject({ open: 1, items: [{ id: b.id }] });
    expect((await list('all')).items.map(i => i.status)).toEqual(['new', 'handled']);
    expect(sqlite.prepare('SELECT handled_by,handled_at FROM user_feedback WHERE id=?').get(a.id)).toEqual({ handled_by: 'admin@test', handled_at: 3000 });
    expect((await mark(a.id, 'new'))!.status).toBe(200);
    await expect(mark(crypto.randomUUID(), 'handled')).rejects.toThrow('OBJECT_NOT_FOUND');
    expect(audit).toEqual([`feedback-handled:${a.id}`, `feedback-reopened:${a.id}`]);
    expect(await handleFeedbackAdmin(new Request(`${origin}/api/v1/management/console/users/list`), context)).toBeUndefined();
  });
});
