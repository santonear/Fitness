import { expect, it } from 'vitest';
import { handleUsers, userProjection, type UsersContext } from '../../src/backend/admin/users/handler';
import { initialState } from '../../src/backend/store';
import { ControlService, testConfig } from '../../src/backend/control';
import type { AdminDatabase, AdminStatement } from '../../src/backend/admin/core/contracts';
const id = '93000000-0003-4000-8000-000000000003',
  requestId = '94000000-0004-4000-8000-000000000004';
it('retries the committed synthetic restoration using the original ID, then hides the prompt', async () => {
  const now = Date.parse('2026-10-31T16:30:00Z'),
    state = initialState();
  state.subjects[id] = { expiresAt: now + 86400000, revoked: false };
  state.usages[id + ':2026-11'] = { understand: 0, generate: 2 };
  const receipt = {
    subjectId: id,
    period: '2026-11',
    reason: '预览合成：额度恢复响应丢失',
    at: now,
    credits: { understand: 0, generate: 2 },
  };
  state.quotaRestorations = { [requestId]: receipt };
  state.audit.push({ at: now, event: 'quota-restore-unknown:' + requestId, subjectId: id });
  let confirmed = false;
  const db: AdminDatabase = {
    prepare() {
      const statement: AdminStatement = {
        bind() {
          return statement;
        },
        async first<T>() {
          return confirmed ? ({ id: 'confirmed' } as T) : null;
        },
        async all<T>() {
          return { results: [] as T[] };
        },
        async run() {
          return { success: true, meta: { changes: 0 } };
        },
      };
      return statement;
    },
    async batch() {
      return [];
    },
  };
  const service = new ControlService(
    { read: async () => state, transact: async fn => fn(state) },
    { ...testConfig, timeZone: 'Asia/Shanghai' },
    { kind: 'local-mock' } as never,
    () => now,
  );
  const received: string[] = [];
  const c: UsersContext = {
    env: {
      ADMIN_DB: db,
      ADMIN_ENVIRONMENT: 'preview',
      CONTROL_POLICY: JSON.stringify({ timeZone: 'Asia/Shanghai', quotas: { generate: 3 } }),
      CONTROL_DB: {
        withSession() {
          return {
            prepare() {
              return {
                bind() {
                  return this;
                },
                async first<T>() {
                  return { state: JSON.stringify(state) } as T;
                },
                async run() {
                  return { success: true, meta: { changes: 0 } };
                },
              };
            },
          };
        },
      },
    },
    actor: 'admin',
    now,
    fresh: true,
    requestId,
    audit: async action => {
      if (action === 'quota-retry-confirmed') confirmed = true;
    },
    forward: async (op, data) => {
      expect(op).toBe('quota-restore');
      received.push((data as typeof receipt & { id: string }).id);
      return Response.json(
        await service.restoreQuota(testConfig.adminSecret, data as Parameters<typeof service.restoreQuota>[1]),
      );
    },
  };
  const detail = () =>
    handleUsers(new Request('https://app.test/api/v1/management/console/users/detail?id=' + id.slice(0, 12)), c);
  const before = await (await detail())!.json();
  expect(before.retryQuota.requestId).toBe(requestId);
  expect(before.user.currentQuota).toEqual({ period: '2026-11', used: 2, total: 5 });
  expect(before.user.remainingDays).toBe(1);
  c.env.ADMIN_ENVIRONMENT = 'production';
  expect(await (await detail())!.json()).not.toHaveProperty('retryQuota');
  c.env.ADMIN_ENVIRONMENT = 'preview';
  for (let n = 0; n < 2; n++)
    expect(
      (await handleUsers(
        new Request('https://app.test/api/v1/management/console/users/action', {
          method: 'POST',
          body: JSON.stringify(before.retryQuota.body),
        }),
        c,
      ))!.ok,
    ).toBe(true);
  expect(received).toEqual([requestId, requestId]);
  expect(state.quotaRestorations).toEqual({ [requestId]: receipt });
  expect(state.usages[id + ':2026-11'].generate).toBe(2);
  expect(await (await detail())!.json()).not.toHaveProperty('retryQuota');
});
it('shows zero current use with configured total and never derives current totals from old months', () => {
  const now = Date.parse('2026-10-31T16:30:00Z'),
    state = initialState();
  state.subjects[id] = { expiresAt: now - 1, revoked: false };
  state.usages[id + ':2026-10'] = { understand: 0, generate: 99 };
  expect(
    userProjection(state, now, 'production', JSON.stringify({ timeZone: 'Asia/Shanghai', quotas: { generate: 8 } }))[0],
  ).toMatchObject({ remainingDays: 0, currentQuota: { period: '2026-11', used: 0, total: 8 } });
});

it('labels dynamically identified finance samples only in preview with matching audit evidence', () => {
  const state = initialState(),
    financeId = crypto.randomUUID(),
    otherId = crypto.randomUUID();
  state.subjects[financeId] = { expiresAt: 100, revoked: true };
  state.subjects[otherId] = { expiresAt: 100, revoked: true };
  state.audit.push({ at: 1, event: 'preview-synthetic-finance', subjectId: financeId });
  expect(userProjection(state, 1, 'preview').map(u => u.previewLabel)).toEqual(['finance', undefined]);
  for (const environment of ['production', undefined])
    expect(userProjection(state, 1, environment).every(u => u.previewLabel === undefined)).toBe(true);
});
