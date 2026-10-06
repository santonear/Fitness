import { expect, it } from 'vitest';
import { buildAdminReport } from '../../src/backend/admin-report';
import { initialState } from '../../src/backend/store';

it('builds a detached deterministic admin ledger report with no credentials or body', () => {
  const state = initialState();
  const subjectId = '11111111-1111-4111-8111-111111111111';
  const requestId = '22222222-2222-4222-8222-222222222222';
  state.subjects[subjectId] = { expiresAt: 10, revoked: true };
  state.sessions['secret-session-token'] = { subjectId, revoked: true };
  state.invites['secret-invite-token'] = { expiresAt: 20, redeemed: false };
  state.usages[`${subjectId}:2026-10`] = { understand: 1, generate: 2 };
  state.budgets['2026-10'] = { spent: 5, reserved: 300 };
  state.requests['private-key'] = { subjectId, requestId, inputDigest: 'secret-input-digest', operation: 'generate', period: '2026-10', bound: 300, status: 'pending', cancelled: true, error: 'private response body' };
  state.audit.push({ at: 1, event: 'secret-audit-body' });
  Object.assign(state, { adminSecret: 'secret-admin-token', body: 'private response body' });
  Object.assign(state.subjects[subjectId], { sessionToken: 'secret-session-token' });
  Object.assign(state.budgets['2026-10'], { secret: 'secret-budget-token' });
  Object.assign(state.usages[`${subjectId}:2026-10`], { body: 'private response body' });
  Object.assign(state.requests['private-key'], { supplierKey: 'secret-supplier-token', result: 'private response body' });
  const before = structuredClone(state);
  const report = buildAdminReport(state, 20);
  expect(report.subjects).toEqual([{ subjectId, expiresAt: 10, revoked: true, expired: true }]);
  expect(report.requests).toEqual([{ subjectId, requestId, operation: 'generate', period: '2026-10', boundFen: 300, status: 'pending', cancelled: true }]);
  expect(report.budgets).toEqual([{ period: '2026-10', spentFen: 5, reservedFen: 300 }]);
  expect(JSON.stringify(report)).not.toMatch(/secret-|private response|inputDigest|sessions|invites|audit/);
  expect(state).toEqual(before);
  report.requests[0].cancelled = false;
  expect(state.requests['private-key'].cancelled).toBe(true);
});

it('preserves every request status, settled zero and recovery flags without conflating pending with spent', () => {
  const state = initialState(); state.recoveryRequired = true; state.aiEnabled = false;
  for (const [index, status] of (['reserved', 'submitted', 'pending', 'settled', 'released'] as const).entries()) {
    state.requests[status] = { subjectId: 'subject', requestId: `request-${index}`, operation: 'understand', period: '2026-10', bound: 100, status, cancelled: false,
      inputDigest: 'never report', ...(status === 'settled' ? { actualCost: 0 } : {}) };
  }
  state.budgets['2026-11'] = { spent: 0, reserved: 0 };
  state.budgets['2026-10'] = { spent: 0, reserved: 300 };
  const report = buildAdminReport(state, Date.parse('2026-10-06T00:00:00Z'));
  expect(report).toMatchObject({ recoveryRequired: true, aiEnabled: false });
  expect(report.budgets.map(row => row.period)).toEqual(['2026-10', '2026-11']);
  expect(report.requests.map(row => row.status)).toEqual(['reserved', 'submitted', 'pending', 'settled', 'released']);
  expect(report.requests.find(row => row.status === 'settled')?.actualCostFen).toBe(0);
  expect(report.requests.find(row => row.status === 'pending')).not.toHaveProperty('actualCostFen');
});

it('reports expiry at the exact boundary and rejects invalid clocks', () => {
  const state = initialState(); state.subjects.subject = { expiresAt: 100, revoked: false };
  expect(buildAdminReport(state, 99).subjects[0].expired).toBe(false);
  expect(buildAdminReport(state, 100).subjects[0].expired).toBe(true);
  expect(() => buildAdminReport(state, Number.NaN)).toThrow('INVALID_REPORT_CLOCK');
});
