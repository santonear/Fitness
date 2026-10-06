import { afterEach, expect, it } from 'vitest';
import { ControlService, testConfig } from '../../src/backend/control';
import { SqliteControlStore } from '../../src/backend/sqlite-store';
import { confirmationFor } from '../../src/backend/contracts';
import { createDeepSeekCodec } from '../../src/backend/deepseek';

const stores: SqliteControlStore[] = [];
afterEach(() => stores.splice(0).forEach(store => store.close()));
async function fixture() {
  const store = new SqliteControlStore(':memory:'); stores.push(store);
  let now = Date.parse('2026-10-07T00:00:00Z'), calls = 0, proof: number | undefined = 212, fail = false;
  const config = { ...testConfig, budgetLimit: 3000, maximumRequestCost: 300, allowBoundedPending: true,
    requestBounds: { understand: 300, generate: 300 }, quotas: { understand: 100, generate: 100 } };
  const service = new ControlService(store, config, { kind: 'local-mock', costUpperBoundFen: () => proof,
    call: async () => { calls++; if (fail) throw Error('uncertain'); return { result: { interpretedGoal: 'General fitness' } }; } }, () => now);
  await service.enableMock(config.adminSecret, true);
  const session = await service.redeem((await service.issue(config.adminSecret)).code);
  async function send() {
    const input = { contractVersion: 1 as const, requestId: crypto.randomUUID(), operation: 'understand' as const,
      goalText: 'General fitness', locale: 'en' as const, restoreGeneration: 0 };
    const request = { ...input, sendConfirmation: await confirmationFor(input) };
    return { request, result: await service.submit(session.token, request) };
  }
  return { store, service, session, config, send, calls: () => calls, proof: (value?: number) => { proof = value; }, fail: () => { fail = true; }, time: (value: string) => { now = Date.parse(value); } };
}

it('ten unaccounted calls retain RMB 30; eleventh is rejected without a supplier call', async () => {
  const f = await fixture();
  for (let i = 0; i < 10; i++) expect((await f.send()).result.accounting).toBe('pending');
  expect((await f.store.read()).budgets['2026-10']).toEqual({ spent: 0, reserved: 3000 });
  expect((await f.service.status(f.session.token)).reconciliationRequired).toBe(false);
  await expect(f.send()).rejects.toMatchObject({ code: 'GLOBAL_BUDGET_EXHAUSTED' }); expect(f.calls()).toBe(10);
});
it('operator settlement replaces only its reservation, never refunds request quota', async () => {
  const f = await fixture(); const first = await f.send(); await f.send();
  await f.service.settle(f.config.adminSecret, f.session.subjectId, first.request.requestId, 7);
  expect((await f.store.read()).budgets['2026-10']).toEqual({ spent: 7, reserved: 300 });
  expect((await f.service.status(f.session.token)).used.understand).toBe(2);
  await f.service.settle(f.config.adminSecret, f.session.subjectId, first.request.requestId, 7);
  expect((await f.store.read()).budgets['2026-10']).toEqual({ spent: 7, reserved: 300 });
});
it('old-month reservations carry forward and are not reset into new allowance', async () => {
  const f = await fixture(); for (let i = 0; i < 10; i++) await f.send();
  f.time('2026-11-01T00:00:00Z');
  await expect(f.send()).rejects.toMatchObject({ code: 'GLOBAL_BUDGET_EXHAUSTED' });
  expect((await f.store.read()).budgets['2026-10'].reserved).toBe(3000);
});
it('missing proof and proof exceeding reservation prevent calls', async () => {
  const f = await fixture();
  for (const value of [undefined, 301, NaN, -1]) { f.proof(value); await expect(f.send()).rejects.toMatchObject({ code: 'COST_BOUND_UNVERIFIED' }); }
  expect(f.calls()).toBe(0); expect((await f.store.read()).requests).toEqual({});
});
it('uncertain result blocks subsequent requests without releasing its reservation', async () => {
  const f = await fixture(); f.fail(); await expect(f.send()).rejects.toMatchObject({ code: 'ACCOUNTING_PENDING' });
  await expect(f.send()).rejects.toMatchObject({ code: 'RECONCILIATION_REQUIRED' });
  expect((await f.store.read()).budgets['2026-10'].reserved).toBe(300); expect(f.calls()).toBe(1);
});
it('over-bound actual bill stops AI and preserves actual charge', async () => {
  const f = await fixture(); const { request } = await f.send();
  await f.service.settle(f.config.adminSecret, f.session.subjectId, request.requestId, 301);
  expect(await f.store.read()).toMatchObject({ aiEnabled: false, recoveryRequired: true, budgets: { '2026-10': { spent: 301, reserved: 0 } } });
  await expect(f.send()).rejects.toMatchObject({ code: 'RECONCILIATION_REQUIRED' });
});
it('ledger mismatch blocks new calls rather than reviving allowance', async () => {
  const f = await fixture(); await f.send(); await f.store.transact(s => { s.budgets['2026-10'].reserved = 0; });
  await expect(f.send()).rejects.toMatchObject({ code: 'RECONCILIATION_REQUIRED' }); expect(f.calls()).toBe(1);
});
it('a reduced settled balance is a ledger anomaly, not new allowance', async () => {
  const f = await fixture(); const { request } = await f.send();
  await f.service.settle(f.config.adminSecret, f.session.subjectId, request.requestId, 7);
  await f.store.transact(s => { s.budgets['2026-10'].spent = 0; });
  await expect(f.send()).rejects.toMatchObject({ code: 'RECONCILIATION_REQUIRED' });
  expect(f.calls()).toBe(1);
});
it('concurrent reservations cannot exceed the final RMB 3 of available budget', async () => {
  const f = await fixture(); for (let i = 0; i < 9; i++) await f.send();
  const results = await Promise.allSettled([f.send(), f.send()]);
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1); expect(f.calls()).toBe(10);
});
it('expired pricing evidence fails closed; full-context cost bound is below RMB 3', () => {
  const codec = createDeepSeekCodec({ maxOutputTokens: 2048, pricingVerifiedUntil: '2099-01-01T00:00:00Z' });
  expect(codec.costUpperBoundFen!({} as never)).toBe(212);
  expect(createDeepSeekCodec({ maxOutputTokens: 8192, pricingVerifiedUntil: '2099-01-01T00:00:00Z' }).costUpperBoundFen!({} as never)).toBe(217);
  expect(createDeepSeekCodec({ maxOutputTokens: 2048, pricingVerifiedUntil: '2000-01-01T00:00:00Z' }).costUpperBoundFen!({} as never)).toBeUndefined();
  expect(createDeepSeekCodec({ maxOutputTokens: 2048 }).costUpperBoundFen!({} as never)).toBeUndefined();
});
