import { afterEach, expect, it } from 'vitest';
import { ControlService, testConfig } from '../../src/backend/control';
import { SqliteControlStore } from '../../src/backend/sqlite-store';
import { confirmationFor } from '../../src/backend/contracts';
import { createHandler } from '../../src/backend/http';
const stores: SqliteControlStore[] = [];
afterEach(() => stores.splice(0).forEach(s => s.close()));
async function fixture() {
  const store = new SqliteControlStore(':memory:'); stores.push(store);
  let now = Date.parse('2026-10-31T12:00:00Z'), calls = 0;
  const service = new ControlService(store, testConfig, { kind: 'local-mock', call: async () => { calls++; return { result: { interpretedGoal: 'synthetic' }, actualCost: 1 }; } }, () => now);
  const session = await service.redeem((await service.issue(testConfig.adminSecret)).code);
  await service.enableMock(testConfig.adminSecret, true);
  await store.transact(s => { s.usages[`${session.subjectId}:2026-10`] = { understand: 8, generate: 4, summary: 2 }; });
  const input = { id: crypto.randomUUID(), subjectId: session.subjectId, period: '2026-10', reason: 'Verified support request' };
  const request = async () => { const p = { contractVersion: 1 as const, requestId: crypto.randomUUID(), operation: 'understand' as const, goalText: 'Synthetic goal', locale: 'en' as const, restoreGeneration: 0 }; return { ...p, sendConfirmation: await confirmationFor(p) }; };
  return { store, service, session, input, request, calls: () => calls, nextMonth: () => { now = Date.parse('2026-11-01T01:00:00Z'); } };
}
it('restores remaining defaults while preserving recorded usage, qualification and billing', async () => {
  const f = await fixture(); const before = await f.store.read();
  await f.service.restoreQuota(testConfig.adminSecret, f.input);
  const status = await f.service.status(f.session.token), after = await f.store.read();
  expect(status.limits.understand - status.used.understand).toBe(8);
  expect(status.limits.generate - status.used.generate).toBe(4);
  expect(status.limits.summary).toBe(4);
  for (const key of ['usages', 'budgets', 'requests', 'subjects', 'sessions'] as const) expect(after[key]).toEqual(before[key]);
  expect(f.calls()).toBe(0);
});
it('deduplicates restoration retries after subsequent usage; another confirmed restoration returns to defaults', async () => {
  const f = await fixture(); await Promise.all([1, 2].map(() => f.service.restoreQuota(testConfig.adminSecret, f.input)));
  await f.service.submit(f.session.token, await f.request());
  await f.service.restoreQuota(testConfig.adminSecret, f.input);
  let status = await f.service.status(f.session.token);
  expect(status.limits.understand - status.used.understand).toBe(7);
  await f.service.restoreQuota(testConfig.adminSecret, { ...f.input, id: crypto.randomUUID() });
  status = await f.service.status(f.session.token);
  expect(status.limits.understand - status.used.understand).toBe(8);
  expect(Object.keys((await f.store.read()).quotaRestorations!)).toHaveLength(2);
});
it('requires administrator, active trial, valid reason, and current server month', async () => {
  const f = await fixture();
  await expect(f.service.restoreQuota('wrong', f.input)).rejects.toMatchObject({ code: 'ADMIN_REQUIRED' });
  await expect(f.service.restoreQuota(testConfig.adminSecret, { ...f.input, reason: '' })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  f.nextMonth();
  await expect(f.service.restoreQuota(testConfig.adminSecret, f.input)).rejects.toMatchObject({ code: 'QUOTA_PERIOD_CHANGED' });
  await f.service.revoke(testConfig.adminSecret, f.session.subjectId);
  await expect(f.service.restoreQuota(testConfig.adminSecret, { ...f.input, period: '2026-11' })).rejects.toMatchObject({ code: 'QUALIFICATION_REQUIRED' });
});
it('restoration neither bypasses exhausted project budget nor survives into the next month', async () => {
  const f = await fixture(); await f.store.transact(s => { s.budgets['2026-10'] = { spent: testConfig.budgetLimit, reserved: 0 }; });
  await f.service.restoreQuota(testConfig.adminSecret, f.input);
  await expect(f.service.submit(f.session.token, await f.request())).rejects.toMatchObject({ code: 'GLOBAL_BUDGET_EXHAUSTED' });
  expect(f.calls()).toBe(0); f.nextMonth();
  const status = await f.service.status(f.session.token);
  expect(status.limits.understand).toBe(8); expect(status.used.understand).toBe(0);
});
it('rejects reused operation IDs with changed inputs and blocks ledger recovery', async () => {
  const f = await fixture(); await f.service.restoreQuota(testConfig.adminSecret, f.input);
  await expect(f.service.restoreQuota(testConfig.adminSecret, { ...f.input, reason: 'Different' })).rejects.toMatchObject({ code: 'REQUEST_CONFLICT' });
  await f.store.transact(s => { s.recoveryRequired = true; });
  await expect(f.service.restoreQuota(testConfig.adminSecret, { ...f.input, id: crypto.randomUUID() })).rejects.toMatchObject({ code: 'RECONCILIATION_REQUIRED' });
});
it('enforces authorization and a strict payload on the restoration endpoint', async () => {
  const f = await fixture(), handler = createHandler(f.service, { origins: ['https://fitness.test'], maxBodyBytes: 4096 });
  const call = (input: unknown, authorized = true) => handler(new Request('https://fitness.test/api/v1/admin/quota-restore', { method: 'POST', headers: { origin: 'https://fitness.test', 'content-type': 'application/json', ...(authorized ? { authorization: `Bearer ${testConfig.adminSecret}` } : {}) }, body: JSON.stringify(input) }));
  expect((await call(f.input, false)).status).toBe(401);
  expect((await call({ ...f.input, count: 100 })).status).toBe(400);
  expect((await call(f.input)).status).toBe(200);
  expect((await f.service.managementReport(testConfig.adminSecret)).quotaRestorations[0].reason).toBe(f.input.reason);
});
it('restored allowance is finite and isolated to the selected user', async () => {
  const f = await fixture();
  await f.service.restoreQuota(testConfig.adminSecret, f.input);
  for (let i = 0; i < 8; i++) await f.service.submit(f.session.token, await f.request());
  await expect(f.service.submit(f.session.token, await f.request())).rejects.toMatchObject({ code: 'INDIVIDUAL_QUOTA_EXHAUSTED' });
  const other = await f.service.redeem((await f.service.issue(testConfig.adminSecret)).code);
  expect((await f.service.status(other.token)).limits.understand).toBe(8);
  expect(f.calls()).toBe(8);
});
it('uses Shanghai month boundaries and keeps unresolved reservations intact', async () => {
  const f = await fixture();
  const service = new ControlService(f.store, { ...testConfig, timeZone: 'Asia/Shanghai' }, { kind: 'local-mock', call: async () => { throw new Error('must not call'); } }, () => Date.parse('2026-10-31T16:01:00Z'));
  await f.store.transact(s => {
    s.usages[`${f.session.subjectId}:2026-11`] = { understand: 3, generate: 2 };
    s.budgets['2026-10'] = { spent: 10, reserved: 300 };
    s.requests['synthetic-pending'] = { subjectId: f.session.subjectId, requestId: crypto.randomUUID(), inputDigest: 'fixture', operation: 'generate', period: '2026-10', bound: 300, status: 'pending', cancelled: false };
  });
  const before = await f.store.read();
  await expect(service.restoreQuota(testConfig.adminSecret, f.input)).rejects.toMatchObject({ code: 'QUOTA_PERIOD_CHANGED' });
  await service.restoreQuota(testConfig.adminSecret, { ...f.input, period: '2026-11' });
  const status = await service.status(f.session.token), after = await f.store.read();
  expect(status.period).toBe('2026-11'); expect(status.limits.understand - status.used.understand).toBe(8);
  expect(status.reconciliationRequired).toBe(true);
  expect(after.budgets).toEqual(before.budgets); expect(after.requests).toEqual(before.requests);
});
