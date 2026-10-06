import { expect, it } from 'vitest';
import { ControlService, testConfig } from '../../src/backend/control';
import { SqliteControlStore } from '../../src/backend/sqlite-store';
import { confirmationFor, goalConfirmationFor } from '../../src/backend/contracts';
import { exercises } from '../../src/catalog/exercises';

async function setup(call: () => Promise<{result: unknown; actualCost?: number}>) {
  const store = new SqliteControlStore(':memory:'); let calls = 0;
  const service = new ControlService(store, testConfig, { kind: 'local-mock', call: async () => { calls++; return call(); } });
  const session = await service.redeem((await service.issue(testConfig.adminSecret)).code);
  await service.enableMock(testConfig.adminSecret, true);
  const base = { contractVersion: 1, requestId: crypto.randomUUID(), operation: 'understand', goalText: 'synthetic goal', locale: 'en', restoreGeneration: 4 };
  const request = { ...base, sendConfirmation: await confirmationFor(base) };
  return { store, service, session, request, calls: () => calls };
}

it('delivers valid unknown-cost candidate once while retaining budget, quota and metadata-only pending ledger', async () => {
  const f = await setup(async () => ({ result: { interpretedGoal: 'synthetic candidate' } }));
  try {
    expect(await f.service.submit(f.session.token, f.request)).toEqual({ requestId: f.request.requestId,
      result: { interpretedGoal: 'synthetic candidate' }, context: { restoreGeneration: 4, inputDigest: f.request.sendConfirmation }, accounting: 'pending' });
    const state = await f.store.read(); const period = Object.keys(state.budgets)[0];
    expect(state.budgets[period]).toEqual({ spent: 0, reserved: 100 }); expect(state.usages[`${f.session.subjectId}:${period}`].understand).toBe(1);
    expect(Object.values(state.requests)[0].status).toBe('pending');
    expect((await f.service.status(f.session.token)).reconciliationRequired).toBe(true);
    const second = await f.service.redeem((await f.service.issue(testConfig.adminSecret)).code);
    expect(await f.service.status(second.token)).toMatchObject({ pending: 0, reconciliationRequired: true, aiEnabled: true });
    expect(JSON.stringify(state)).not.toContain('synthetic candidate'); expect(JSON.stringify(state)).not.toContain('synthetic goal');
    await expect(f.service.submit(f.session.token, f.request)).rejects.toMatchObject({ code: 'REQUEST_IN_PROGRESS' });
    await expect(f.service.submit(f.session.token, { ...f.request, requestId: crypto.randomUUID() })).rejects.toMatchObject({ code: 'RECONCILIATION_REQUIRED' });
    expect(f.calls()).toBe(1);
    await f.service.settle(testConfig.adminSecret, f.session.subjectId, f.request.requestId, 20);
    expect((await f.service.status(f.session.token)).reconciliationRequired).toBe(false);
  } finally { f.store.close(); }
});

it.each([undefined, null, -1, 0.5, NaN, Infinity, '10'])('explicit invalid cost %s cannot deliver a candidate', async cost => {
  const f = await setup(async () => ({ result: { interpretedGoal: 'never delivered' }, actualCost: cost as number }));
  try {
    await expect(f.service.submit(f.session.token, f.request)).rejects.toMatchObject({ code: 'ACCOUNTING_PENDING' });
    expect(Object.values((await f.store.read()).budgets)[0]).toEqual({ spent: 0, reserved: 100 });
  } finally { f.store.close(); }
});

it('invalid candidate without a cost keeps pending and never delivers raw output', async () => {
  const f = await setup(async () => ({ result: { privateBody: 'invalid' } }));
  try {
    await expect(f.service.submit(f.session.token, f.request)).rejects.toMatchObject({ code: 'ACCOUNTING_PENDING' });
    const state = await f.store.read(); expect(Object.values(state.requests)[0].status).toBe('pending'); expect(JSON.stringify(state)).not.toContain('privateBody');
  } finally { f.store.close(); }
});

it('valid day candidate can be delivered pending without persisting plan contents', async () => {
  const exercise = exercises.find(item => item.metricType === 'reps')!;
  const candidate = { days: [{ date: '2026-10-06', exercises: [{ exerciseId: exercise.id, order: 0,
    targetSets: [{ metricType: 'reps', reps: 8 }], notes: 'private synthetic plan' }] }] };
  const f = await setup(async () => ({ result: candidate }));
  try {
    const base = { ...f.request, operation: 'generate', confirmedGoal: 'synthetic confirmed goal',
      dates: ['2026-10-06'], timeZone: 'UTC', catalogVersion: 1, conditions: {} };
    const request = { ...base, goalConfirmation: await goalConfirmationFor(base), sendConfirmation: await confirmationFor(base) };
    expect(await f.service.submit(f.session.token, request)).toMatchObject({ result: candidate, accounting: 'pending' });
    const state = await f.store.read(); expect(Object.values(state.budgets)[0]).toEqual({ spent: 0, reserved: 300 });
    expect(Object.values(state.usages)[0].generate).toBe(1); expect(JSON.stringify(state)).not.toContain('private synthetic plan');
  } finally { f.store.close(); }
});

it('cancelled in-flight response is not delivered and its reservation remains pending', async () => {
  let finish!: (value: {result: unknown}) => void;
  const f = await setup(() => new Promise(resolve => { finish = resolve; }));
  try {
    const result = f.service.submit(f.session.token, f.request).then(value => ({value}), error => ({error}));
    while (!finish) await new Promise(resolve => setTimeout(resolve, 0));
    await f.service.cancel(f.session.token, f.request.requestId); finish({ result: { interpretedGoal: 'cancelled candidate' } });
    expect(await result).toMatchObject({ error: { code: 'CANCELLED' } });
    expect(Object.values((await f.store.read()).budgets)[0]).toEqual({ spent: 0, reserved: 100 });
  } finally { f.store.close(); }
});

it('independently settled in-flight response cannot restore pending or release budget twice', async () => {
  let finish!: (value: {result: unknown}) => void;
  const f = await setup(() => new Promise(resolve => { finish = resolve; }));
  try {
    const result = f.service.submit(f.session.token, f.request);
    while (!finish) await new Promise(resolve => setTimeout(resolve, 0));
    await f.service.settle(testConfig.adminSecret, f.session.subjectId, f.request.requestId, 20);
    finish({ result: { interpretedGoal: 'synthetic candidate' } });
    expect((await result).accounting).toBe('settled');
    const state = await f.store.read(); expect(Object.values(state.requests)[0].status).toBe('settled');
    expect(Object.values(state.budgets)[0]).toEqual({ spent: 20, reserved: 0 });
  } finally { f.store.close(); }
});
