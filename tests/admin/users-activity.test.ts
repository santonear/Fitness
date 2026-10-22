import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { handleUsers, type UsersContext } from '../../src/backend/admin/users/handler';
import { userActivity } from '../../src/backend/admin/users/activity';
import { SHORT_ID_LENGTH } from '../../src/backend/admin/core/short-id';
import { initialState, type ControlState } from '../../src/backend/store';
import type { AdminDatabase, AdminStatement } from '../../src/backend/admin/core/contracts';

const id = 'abcdef12-3456-4789-8abc-def123456789',
  other = '99999999-0000-4000-8000-000000000000';
const now = Date.parse('2026-10-19T04:00:00Z');
function database(migrations: string[]) {
  const sqlite = new DatabaseSync(':memory:');
  for (const name of migrations) sqlite.exec(readFileSync(`migrations/admin/${name}`, 'utf8'));
  const db: AdminDatabase = {
    prepare(sql) {
      let values: unknown[] = [];
      const statement: AdminStatement = {
        bind(...args) {
          values = args;
          return statement;
        },
        async first<T>() {
          return (sqlite.prepare(sql).get(...(values as never[])) ?? null) as T | null;
        },
        async all<T>() {
          return { results: sqlite.prepare(sql).all(...(values as never[])) as T[] };
        },
        async run() {
          return { success: true, meta: { changes: Number(sqlite.prepare(sql).run(...(values as never[])).changes) } };
        },
      };
      return statement;
    },
    async batch(statements) {
      return Promise.all(statements.map(s => s.run()));
    },
  };
  return { sqlite, db };
}
function state() {
  const s: ControlState = initialState();
  s.subjects[id] = { expiresAt: now + 5 * 86400000, revoked: false };
  s.subjects[other] = { expiresAt: now + 86400000, revoked: false };
  s.audit.push({ at: now - 9 * 86400000, event: 'invite-redeemed', subjectId: id });
  s.requests[`${id}:legacy`] = {
    subjectId: id,
    requestId: 'legacy',
    inputDigest: 'x',
    operation: 'generate',
    createdAt: now - 8 * 86400000,
    period: '2026-10',
    bound: 300,
    status: 'settled',
    cancelled: false,
    actualCost: 40,
  };
  return s;
}
function context(s: ControlState, db: AdminDatabase): UsersContext {
  return {
    env: {
      ADMIN_DB: db,
      CONTROL_POLICY: JSON.stringify({ timeZone: 'Asia/Shanghai' }),
      CONTROL_DB: {
        withSession: () => ({
          prepare: () => ({
            bind() {
              return this;
            },
            async first<T>() {
              return { state: JSON.stringify(s) } as T;
            },
            async run() {
              return { success: true, meta: { changes: 0 } };
            },
          }),
        }),
      },
    },
    actor: 'admin',
    now,
    fresh: true,
    requestId: crypto.randomUUID(),
    forward: async () => {
      throw Error('no mutation');
    },
    audit: async () => {},
  };
}

it('derives registration, last activity and this month’s AI calls and cost without schema changes', async () => {
  const { sqlite, db } = database(['1_core.sql', '1_assistant_v2.sql', '5_assistant_failure_detail.sql']);
  const insert = sqlite.prepare(
    'INSERT INTO assistant_usage(id,at,subject_short_id,task,stage,input_tokens,output_tokens,estimated_fen,result,pricing_version) VALUES(?,?,?,?,?,?,?,?,?,?)',
  );
  insert.run('a', now - 3600000, id.slice(0, 8), 'CHAT', 'text', 10, 5, 1.25, 'success', 'p1');
  insert.run('b', now - 7200000, id.slice(0, 8), 'ADJUST_TODAY', 'attachment', 10, 5, null, 'VALIDATION_FAILED', 'p1');
  insert.run('c', Date.parse('2026-09-20T00:00:00Z'), id.slice(0, 8), 'CHAT', 'text', 10, 5, 99, 'success', 'p1');
  sqlite
    .prepare('INSERT INTO assistant_requests(subject_id,request_id,at,result) VALUES(?,?,?,?)')
    .run(id, 'r1', now - 1800000, 'success');
  const response = await handleUsers(
    new Request('https://app.test/api/v1/management/console/users/list'),
    context(state(), db),
  );
  const { items } = (await response!.json()) as { items: Record<string, unknown>[] };
  const user = items.find(u => u.id === id.slice(0, 8))!;
  expect(user).toMatchObject({
    registeredAt: now - 9 * 86400000,
    lastActiveAt: now - 1800000,
    monthCalls: 3,
    monthCostFen: 41.25,
    monthCostUnknown: true,
    remainingDays: 5,
  });
  expect(items.find(u => u.id === other.slice(0, 8))).toMatchObject({
    registeredAt: null,
    lastActiveAt: null,
    monthCalls: 0,
    monthCostFen: 0,
  });
  // Account and usage metadata only: no field can carry training, health or conversation content.
  expect(Object.keys(user).sort()).toEqual([
    'currentQuota',
    'expired',
    'expiresAt',
    'id',
    'lastActiveAt',
    'monthCalls',
    'monthCostFen',
    'monthCostUnknown',
    'registeredAt',
    'remainingDays',
    'revoked',
    'usage',
  ]);
});

it('uses one short ID length in user lists and assistant usage rows', async () => {
  const { db } = database(['1_core.sql']);
  const response = await handleUsers(
    new Request('https://app.test/api/v1/management/console/users/list'),
    context(state(), db),
  );
  const { items } = (await response!.json()) as { items: { id: string }[] };
  expect(SHORT_ID_LENGTH).toBe(8);
  expect(items.map(u => u.id)).toEqual([id.slice(0, 8), other.slice(0, 8)]);
  expect(readFileSync('src/backend/assistant/admission.ts', 'utf8')).toContain('shortId(subjectId)');
});

it('keeps working when assistant tables are absent', async () => {
  const { db } = database(['1_core.sql']);
  const activity = await userActivity(state(), db, now, JSON.stringify({ timeZone: 'Asia/Shanghai' }));
  expect(activity.get(id)).toEqual({
    registeredAt: now - 9 * 86400000,
    lastActiveAt: now - 8 * 86400000,
    monthCalls: 1,
    monthCostFen: 40,
    monthCostUnknown: false,
  });
});
