import { expect, it } from 'vitest';
import { ControlService, testConfig } from '../../src/backend/control';
import { SqliteControlStore } from '../../src/backend/sqlite-store';
import { confirmationFor } from '../../src/backend/contracts';
import type { ControlState, ControlStore } from '../../src/backend/store';

it.each(['pending', 'month-boundary'] as const)('C-R1 held admission rechecks %s before contacting supplier B', async mode => {
  const base = new SqliteControlStore(':memory:');
  const aId = crypto.randomUUID(), bId = crypto.randomUUID();
  let deliverAdmission!: () => void, admissionCommitted!: () => void, supplierStarted!: () => void, rejectA!: (error: Error) => void;
  const delivery = new Promise<void>(resolve => { deliverAdmission = resolve; });
  const committed = new Promise<void>(resolve => { admissionCommitted = resolve; });
  const started = new Promise<void>(resolve => { supplierStarted = resolve; });
  let held = false, callsA = 0, callsB = 0;
  let now = Date.parse('2026-01-31T23:59:00Z');
  // Commit B's admission atomically, but delay delivering that successful return to its caller.
  // A's independently executing supplier failure can now commit pending before B resumes.
  const store: ControlStore = {
    read: () => base.read(),
    transact: async <T>(change: (state: ControlState) => T): Promise<T> => {
      const result = await base.transact(change);
      const state = await base.read();
      if (!held && Object.values(state.requests).some(entry => entry.requestId === bId && entry.status === 'reserved')) {
        held = true; admissionCommitted(); await delivery;
      }
      return result;
    },
  };
  const service = new ControlService(store, testConfig, { kind: 'local-mock', call: async request => {
    if (request.requestId === aId) { callsA++; supplierStarted(); return new Promise((_resolve, reject) => { rejectA = reject; }); }
    callsB++; return { result: { interpretedGoal: 'B should never run' }, actualCost: 10 };
  } }, () => now);
  const request = async (requestId: string) => {
    const payload = { contractVersion: 1, operation: 'understand', requestId, goalText: 'synthetic boundary fixture', locale: 'en', restoreGeneration: 0 };
    return { ...payload, sendConfirmation: await confirmationFor(payload) };
  };
  try {
    const session = await service.redeem((await service.issue(testConfig.adminSecret)).code);
    await service.enableMock(testConfig.adminSecret, true);
    const a = service.submit(session.token, await request(aId)).then(value => ({ value }), error => ({ error }));
    await started;
    const b = service.submit(session.token, await request(bId)).then(value => ({ value }), error => ({ error }));
    await committed;
    if (mode === 'pending') {
      rejectA(new Error('synthetic uncertain supplier failure'));
      expect(await a).toMatchObject({ error: { code: 'ACCOUNTING_PENDING' } });
    } else now = Date.parse('2026-02-01T00:01:00Z');
    const before = await base.read();
    expect(before.aiEnabled).toBe(true); expect(before.recoveryRequired).toBe(false);
    expect(before.requests[`${session.subjectId}:${aId}`].status).toBe(mode === 'pending' ? 'pending' : 'submitted');
    expect(before.requests[`${session.subjectId}:${bId}`].status).toBe('reserved');
    expect(before.budgets['2026-01'].reserved).toBe(200);
    expect(before.usages[`${session.subjectId}:2026-01`].understand).toBe(2);
    deliverAdmission();
    expect(await b).toMatchObject({ error: { code: 'NOT_SUBMITTED' } });
    const after = await base.read();
    expect(callsA).toBe(1); expect(callsB).toBe(0);
    expect(after.requests[`${session.subjectId}:${bId}`].status).toBe('released');
    expect(after.requests[`${session.subjectId}:${aId}`]).toEqual(before.requests[`${session.subjectId}:${aId}`]);
    expect(after.budgets['2026-01']).toEqual({ spent: 0, reserved: 100 });
    expect(after.usages[`${session.subjectId}:2026-01`].understand).toBe(1);
    if (mode === 'month-boundary') { rejectA(new Error('cleanup uncertain A')); await a; }
  } finally { deliverAdmission(); base.close(); }
});
