import { afterEach, expect, it } from 'vitest';
import { ControlService, testConfig } from '../../src/backend/control';
import { SqliteControlStore } from '../../src/backend/sqlite-store';
import { confirmationFor } from '../../src/backend/contracts';
import { createDeepSeekCodec } from '../../src/backend/deepseek';

const stores: SqliteControlStore[] = [];
afterEach(() => stores.splice(0).forEach(store => store.close()));
async function fixture(submissionProof?: number) {
  let proofChecks = 0;
  const store = new SqliteControlStore(':memory:'); stores.push(store);
  let now = Date.parse('2026-10-07T00:00:00Z'), calls = 0, proof: number | undefined = 212, fail = false;
  const config = { ...testConfig, planningBudgetDisabled: false, budgetLimit: 3000, maximumRequestCost: 300, allowBoundedPending: true,
    requestBounds: { understand: 300, generate: 300 }, quotas: { understand: 100, generate: 100 } };
  const service = new ControlService(store, config, { kind: 'local-mock', costUpperBoundFen: () => submissionProof === undefined || proofChecks++ === 0 ? proof : submissionProof,
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

it('successful calls retain proven ceilings; admission still requires the full request reservation', async () => {
  const f = await fixture();
  for (let i = 0; i < 13; i++) expect((await f.send()).result.accounting).toBe('pending');
  expect((await f.store.read()).budgets['2026-10']).toEqual({ spent: 0, reserved: 2756 });
  expect((await f.service.status(f.session.token)).reconciliationRequired).toBe(false);
  await expect(f.send()).rejects.toMatchObject({ code: 'GLOBAL_BUDGET_EXHAUSTED' }); expect(f.calls()).toBe(13);
});
it('operator settlement replaces only its reservation, never refunds request quota', async () => {
  const f = await fixture(); const first = await f.send(); await f.send();
  await f.service.settle(f.config.adminSecret, f.session.subjectId, first.request.requestId, 7);
  expect((await f.store.read()).budgets['2026-10']).toEqual({ spent: 7, reserved: 212 });
  expect((await f.service.status(f.session.token)).used.understand).toBe(2);
  await f.service.settle(f.config.adminSecret, f.session.subjectId, first.request.requestId, 7);
  expect((await f.store.read()).budgets['2026-10']).toEqual({ spent: 7, reserved: 212 });
});
it('old-month reservations carry forward and are not reset into new allowance', async () => {
  const f = await fixture(); for (let i = 0; i < 13; i++) await f.send();
  f.time('2026-11-01T00:00:00Z');
  await expect(f.send()).rejects.toMatchObject({ code: 'GLOBAL_BUDGET_EXHAUSTED' });
  expect((await f.store.read()).budgets['2026-10'].reserved).toBe(2756);
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
it('concurrent reservations cannot spend the same released headroom', async () => {
  const f = await fixture(); for (let i = 0; i < 12; i++) await f.send();
  const results = await Promise.allSettled([f.send(), f.send()]);
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1); expect(f.calls()).toBe(13);
});
it('expired pricing evidence fails closed; full-context cost bound is below RMB 3', () => {
  const codec = createDeepSeekCodec({ maxOutputTokens: 2048, pricingVerifiedUntil: '2099-01-01T00:00:00Z' });
  expect(codec.costUpperBoundFen!({} as never)).toBe(212);
  expect(createDeepSeekCodec({ maxOutputTokens: 8192, pricingVerifiedUntil: '2099-01-01T00:00:00Z' }).costUpperBoundFen!({} as never)).toBe(217);
  expect(createDeepSeekCodec({ maxOutputTokens: 2048, pricingVerifiedUntil: '2000-01-01T00:00:00Z' }).costUpperBoundFen!({} as never)).toBeUndefined();
  expect(createDeepSeekCodec({ maxOutputTokens: 2048 }).costUpperBoundFen!({} as never)).toBeUndefined();
});

it('successful pending delivery releases excess once without inventing fees or refunding quota', async () => {
  const f = await fixture(); const first = await f.send();
  const state = await f.store.read(), entry = state.requests[`${f.session.subjectId}:${first.request.requestId}`];
  expect(entry).toMatchObject({ status: 'pending', bound: 212, verifiedBoundFen: 212 });
  expect(entry.actualCost).toBeUndefined();
  expect(state.budgets['2026-10']).toEqual({ spent: 0, reserved: 212 });
  expect((await f.service.status(f.session.token)).used.understand).toBe(1);
  expect(state.audit.some(a => a.event.startsWith('reservation-excess-released:'))).toBe(true);
  await expect(f.service.submit(f.session.token, first.request)).rejects.toMatchObject({ code: 'REQUEST_IN_PROGRESS' });
  expect((await f.store.read()).budgets['2026-10'].reserved).toBe(212); expect(f.calls()).toBe(1);
});

it('retains the larger proof when the ceiling changes between admission and submission', async () => {
  const f = await fixture(217); await f.send();
  expect((await f.store.read()).budgets['2026-10'].reserved).toBe(217);
  expect(Object.values((await f.store.read()).requests)[0].verifiedBoundFen).toBe(217);
});
it('a lower submission proof does not erase the previously verified ceiling', async () => {
  const f = await fixture(200); await f.send();
  expect((await f.store.read()).budgets['2026-10'].reserved).toBe(212);
});
it('settlement exceeding the retained ceiling stops AI even below the initial reservation', async () => {
  const f = await fixture(); const { request } = await f.send();
  await f.service.settle(f.config.adminSecret, f.session.subjectId, request.requestId, 213);
  expect(await f.store.read()).toMatchObject({ aiEnabled: false, recoveryRequired: true,
    budgets: { '2026-10': { spent: 213, reserved: 0 } } });
});


it('temporary planning bypass ignores money limits and expired bounds, retaining accounting and quota', async () => {
  const f = await fixture(); f.config.planningBudgetDisabled = true; f.config.maximumRequestCost = 1; f.config.budgetLimit = 1; f.proof(undefined);
  const first = await f.send(); await f.send();
  expect(f.calls()).toBe(2);
  expect(await f.service.status(f.session.token)).toMatchObject({planningBudgetDisabled:true,budgetAvailable:{understand:true,generate:true},used:{understand:2},reconciliationRequired:false});
  expect((await f.store.read()).budgets['2026-10']).toEqual({spent:0,reserved:600});
  await f.service.settle(f.config.adminSecret,f.session.subjectId,first.request.requestId,500);
  expect(await f.store.read()).toMatchObject({aiEnabled:true,recoveryRequired:false,budgets:{'2026-10':{spent:500,reserved:300}}});
  f.config.quotas.understand = 2;
  await expect(f.send()).rejects.toMatchObject({code:'INDIVIDUAL_QUOTA_EXHAUSTED'});
  expect(f.calls()).toBe(2);
});
it('reenabling money limits restores pending proof and budget gates without changing historical entries', async () => {
  const f=await fixture();f.config.planningBudgetDisabled=true;f.proof(undefined);await f.send();const before=await f.store.read();
  f.config.planningBudgetDisabled=false;f.proof(212);
  expect((await f.service.status(f.session.token)).reconciliationRequired).toBe(true);
  await expect(f.send()).rejects.toMatchObject({code:'RECONCILIATION_REQUIRED'});
  expect(await f.store.read()).toEqual(before);
});
it('temporary bypass does not bypass uncertain supplier failures or revoked eligibility', async()=>{
  const f=await fixture();f.config.planningBudgetDisabled=true;f.proof(undefined);f.fail();
  await expect(f.send()).rejects.toMatchObject({code:'ACCOUNTING_PENDING'});
  expect((await f.service.status(f.session.token)).reconciliationRequired).toBe(true);
  await expect(f.send()).rejects.toMatchObject({code:'RECONCILIATION_REQUIRED'});
  await f.store.transact(s=>{s.subjects[f.session.subjectId].revoked=true;});
  await expect(f.send()).rejects.toMatchObject({code:'QUALIFICATION_REQUIRED'});
});
