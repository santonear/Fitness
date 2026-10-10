import { afterEach, expect, it } from 'vitest';
import { guidedInputSnapshot } from '../../src/ai/guided-dialogue';
import { guidedTransportEnvelope } from '../fixtures/legacy-guided-envelope';
import { validateRequest, validateCandidate, confirmationFor } from '../../src/backend/contracts';
import { createDeepSeekCodec } from '../../src/backend/deepseek';
import { ControlService, testConfig } from '../../src/backend/control';
import { SqliteControlStore } from '../../src/backend/sqlite-store';
import { fourMetricCandidate } from '../fixtures/prompt-cases';
import type { GuidedDialogueRequest } from '../../src/domain/guided-ai-contracts';

function request(purpose: GuidedDialogueRequest['purpose'] = 'program'): GuidedDialogueRequest {
  const input = { version: 'guided-dialogue-v1' as const, conversationId: crypto.randomUUID(), restoreGeneration: 0,
    purpose, locale: 'zh' as const, scope: { goal: '建立规律健身习惯', conditions: {} }, confirmedSummary: '建立规律健身习惯', timeZone: 'Asia/Shanghai',
    ...(['program', 'refine'].includes(purpose) ? { startDate: '2026-10-06', endDate: '2026-10-06', dates: ['2026-10-06'] } : {}),
    ...(purpose === 'refine' ? { refinement: '降低强度', candidateId: crypto.randomUUID() } : {}) };
  return { ...input, requestId: crypto.randomUUID(), inputSnapshot: guidedInputSnapshot(input) };
}
const candidate = () => ({ kind: 'program', name: '规律训练', explanation: '按确认日期安排', ...fourMetricCandidate() });
const stores: SqliteControlStore[] = [];
afterEach(() => stores.splice(0).forEach(s => s.close()));

it('binds the new protocol to existing request identity, quota operation and exact date confirmation', async () => {
  for (const purpose of ['understand', 'clarify', 'program', 'refine'] as const) {
    const envelope = await guidedTransportEnvelope(request(purpose));
    expect((await validateRequest(envelope, 1, 65536)).operation).toBe(['program', 'refine'].includes(purpose) ? 'generate' : 'understand');
    const corrupted = { ...envelope, requestId: crypto.randomUUID() };
    corrupted.sendConfirmation = await confirmationFor(corrupted);
    await expect(validateRequest(corrupted, 1, 65536)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  }
});

it('rejects unconfirmed nested input before supplier encoding', async () => {
  const r = request(); r.scope.goal = 'changed';
  const envelope = await guidedTransportEnvelope(r);
  await expect(createDeepSeekCodec({ maxOutputTokens: 2048 }).encode(envelope)).rejects.toMatchObject({ code: 'AI_CONTRACT_RETIRED' });
});

it('server owns candidate identity and strictly rejects omitted dates, unknown exercises and invalid metrics', async () => {
  const envelope = await guidedTransportEnvelope(request());
  const result = validateCandidate(envelope, candidate());
  expect(result).toMatchObject({ purpose: 'program', requestId: envelope.requestId, candidate: { goal: envelope.goalText, restoreGeneration: 0 } });
  for (const invalid of [ { ...candidate(), days: [] }, { ...candidate(), days: [{ ...candidate().days[0], date: '2026-10-07' }] },
    { ...candidate(), days: [{ date: '2026-10-06', exercises: [{ ...candidate().days[0].exercises[0], exerciseId: crypto.randomUUID() }] }] } ])
    expect(() => validateCandidate(envelope, invalid)).toThrow('INVALID_CANDIDATE');
});

it('returns structured refusal without fabricating a candidate and preserves requested purpose', async () => {
  const envelope = await guidedTransportEnvelope(request('refine'));
  expect(validateCandidate(envelope, { kind: 'refused', reason: 'unrelated', message: '请回到健身目标。' })).toMatchObject({ purpose: 'refused', requestedPurpose: 'refine', reason: 'unrelated' });
});

it('uses existing admission and pending accounting with no plaintext dialogue in the ledger or duplicate supplier calls', async () => {
  const store = new SqliteControlStore(':memory:'); stores.push(store); let calls = 0;
  const service = new ControlService(store, testConfig, { kind: 'local-mock', call: async () => { calls++; return { result: candidate() }; } });
  await service.enableMock(testConfig.adminSecret, true);
  const session = await service.redeem((await service.issue(testConfig.adminSecret)).code);
  const envelope = await guidedTransportEnvelope(request());
  const result = await service.submit(session.token, envelope);
  expect(result).toMatchObject({ accounting: 'pending', result: { purpose: 'program' } });
  await expect(service.submit(session.token, envelope)).rejects.toMatchObject({ code: 'REQUEST_IN_PROGRESS' });
  expect(calls).toBe(1); expect(JSON.stringify(await store.read())).not.toContain(envelope.goalText);
  expect(Object.values((await store.read()).requests)[0].coachContract).toMatchObject({promptVersion:'v7.1.0',schemaVersion:'guided-dialogue-v1',task:'generate-days'});
});
