import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import type { AdminDatabase, AdminStatement } from '../../src/backend/admin/core/contracts';
import { AssistantUsageStore, nextMidnight } from '../../src/backend/assistant/admission';
const databases: DatabaseSync[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));
const price = { inputFenPerMillion: 10, outputFenPerMillion: 20, version: 'test-price' };
const now = Date.parse('2026-10-11T10:00:00Z');
function setup() {
 const sql = new DatabaseSync(':memory:'); databases.push(sql);
 sql.exec(readFileSync('migrations/admin/1_assistant_v2.sql', 'utf8'));
 sql.exec(readFileSync('migrations/admin/5_assistant_failure_detail.sql', 'utf8'));
 const db: AdminDatabase = {
  prepare(query) { let values: unknown[] = []; const stmt: AdminStatement = {
   bind(...args) { values = args; return stmt; },
   async first<T>() { return sql.prepare(query).get(...values as never[]) as T ?? null; },
   async all<T>() { return { results: sql.prepare(query).all(...values as never[]) as T[] }; },
   async run() { const result = sql.prepare(query).run(...values as never[]); return { success: true, meta: { changes: Number(result.changes) } }; }
  }; return stmt; },
  async batch(statements) { sql.exec('BEGIN'); try { const results = []; for (const statement of statements) results.push(await statement.run()); sql.exec('COMMIT'); return results; } catch(error) { sql.exec('ROLLBACK'); throw error; } }
 };
 return { sql, store: new AssistantUsageStore(db), other: new AssistantUsageStore(db) };
}
const finish = (store: AssistantUsageStore, request: string, success = true, at = now + 1) => store.finish('subject', request, 'chat', success, [{ inputTokens: 100, outputTokens: 50, stage: 'text', result: success ? 'success' : 'failed' }], price, at, success ? 'success' : 'failed');
describe('assistant admission SQLite integration', () => {
 it.each([
  ['2026-03-08T05:00:00Z', 'America/New_York', '2026-03-09T04:00:00Z'],
  ['2026-11-01T04:00:00Z', 'America/New_York', '2026-11-02T05:00:00Z'],
  ['2026-10-11T10:00:00Z', 'Asia/Kathmandu', '2026-10-11T18:15:00Z'],
 ])('finds real local midnight from %s in %s', (start, zone, end) => expect(nextMidnight(Date.parse(start), zone)).toBe(Date.parse(end)));
 it('keeps the admitted local window when the requested timezone changes', async () => {
  const { store } = setup(); const original = await store.admit('subject', 'one', 'Asia/Shanghai', 30, now); await finish(store, 'one');
  const changed = await store.admit('subject', 'two', 'Pacific/Honolulu', 30, now + 2);
  expect(changed).toMatchObject({ day: original.day, timeZone: 'Asia/Shanghai', resetAt: original.resetAt, used: 1 });
 });
 it('allows exactly thirty successful messages and resets only at the local midnight', async () => {
  const { store } = setup();
  for(let i = 0; i < 30; i++) { await store.admit('subject', String(i), 'Asia/Shanghai', 30, now + i * 10); await finish(store, String(i), true, now + i * 10 + 1); }
  expect((await store.read('subject'))?.used).toBe(30);
  const reset = nextMidnight(now, 'Asia/Shanghai');
  await expect(store.admit('subject', 'blocked', 'Pacific/Honolulu', 30, reset - 1)).rejects.toMatchObject({ code: 'DAILY_MESSAGE_LIMIT', resetAt: reset });
  await store.admit('subject', 'new-day', 'Asia/Shanghai', 30, reset);
  expect((await store.read('subject'))?.used).toBe(0);
 });
 it('atomically admits one of two concurrent store instances', async () => {
  const { store, other } = setup(); const result = await Promise.allSettled([store.admit('subject', 'a', 'Asia/Shanghai', 30, now), other.admit('subject', 'b', 'Asia/Shanghai', 30, now)]);
  expect(result.filter(item => item.status === 'fulfilled')).toHaveLength(1);
  expect(result.filter(item => item.status === 'rejected')).toHaveLength(1);
  expect((await store.read('subject'))?.used).toBe(0);
 });
 it('failure releases the lease without consuming a daily message', async () => {
  const { store, sql } = setup(); await store.admit('subject', 'failed', 'Asia/Shanghai', 30, now); await finish(store, 'failed', false);
  expect(await store.read('subject')).toMatchObject({ used: 0, active_request: null });
  expect(sql.prepare('SELECT result FROM assistant_requests WHERE request_id=?').get('failed')?.result).toBe('failed');
  await expect(store.admit('subject', 'next', 'Asia/Shanghai', 30, now + 2)).resolves.toMatchObject({ used: 0 });
 });
 it('does not consume twice or duplicate usage on a repeated finish', async () => {
  const { store, sql } = setup(); await store.admit('subject', 'one', 'Asia/Shanghai', 30, now); await finish(store, 'one'); await finish(store, 'one');
  await finish(store, 'one', false);
  expect(sql.prepare('SELECT result FROM assistant_requests WHERE request_id=?').get('one')?.result).toBe('success');
  expect((await store.read('subject'))?.used).toBe(1);
  expect(sql.prepare('SELECT count(*) AS count FROM assistant_usage').get()?.count).toBe(1);
  await expect(store.admit('subject', 'one', 'Asia/Shanghai', 30, now + 2)).rejects.toMatchObject({ code: 'REQUEST_ALREADY_HANDLED' });
 });
 it('ignores an old legacy pending reservation without modifying it', async () => {
  const { store, sql } = setup(); sql.exec("CREATE TABLE control_ledger(request_key TEXT, status TEXT); INSERT INTO control_ledger VALUES('old','pending')");
  await expect(store.admit('subject', 'new', 'Asia/Shanghai', 30, now)).resolves.toMatchObject({ used: 0 });
  expect(sql.prepare('SELECT status FROM control_ledger').get()?.status).toBe('pending');
 });
 it('recovers an expired lease while rejecting late completion and replay of the stale request', async () => {
  const { store } = setup(); await store.admit('subject', 'stale', 'Asia/Shanghai', 30, now);
  await expect(store.admit('subject', 'early', 'Asia/Shanghai', 30, now + 179999)).rejects.toMatchObject({ code: 'CONCURRENT_REQUEST' });
  await store.admit('subject', 'recovery', 'Asia/Shanghai', 30, now + 180001);
  await finish(store, 'stale', true, now + 180002);
  expect(await store.read('subject')).toMatchObject({ used: 0, active_request: 'recovery' });
  await finish(store, 'recovery', true, now + 180003);
  await expect(store.admit('subject', 'stale', 'Asia/Shanghai', 30, now + 180004)).rejects.toMatchObject({ code: 'REQUEST_ALREADY_HANDLED' });
  expect((await store.read('subject'))?.used).toBe(1);
 });
});
