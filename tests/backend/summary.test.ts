import { expect, it } from 'vitest';
import { buildStageSummary } from '../../src/application/stage-summary-core';
import { confirmationFor, validateCandidate, validateRequest } from '../../src/backend/contracts';
import { validateSummaryStage, summaryStageSchema } from '../../src/backend/summary-contract';
import { buildStageSummaryPrompt as buildAiPrompt } from '../../src/backend/summary-provider';
import { createDeepSeekCodec } from '../../src/backend/deepseek';
import { ControlService, testConfig } from '../../src/backend/control';
import { SqliteControlStore } from '../../src/backend/sqlite-store';
import { readWorkerConfig, createWorker } from '../../src/backend/worker';
import { createHandler } from '../../src/backend/http';
import { exercises } from '../../src/catalog/exercises';
import { exerciseIdSchema } from '../../src/domain/schemas';
import { createSummaryClient, summaryEligible } from '../../src/ai/summary-client';

const at = '2026-10-07T12:00:00Z';
const entity = { createdAt: at, updatedAt: at, revision: 0 };
const id = (suffix: string) => `11111111-1111-4111-8111-${suffix.padStart(12, '0')}`;
async function request() {
  const result = buildStageSummary({ capturedAt: at, dataRevision: 3, restoreGeneration: 2, plans: [], planVersions: [], sessions: [], sets: [],
    scheduledWorkouts: [], bodyWeights: [{ ...entity, id: id('1'), localDate: '2026-10-06', timeZone: 'UTC', weightGrams: 70000 }] },
    { kind: 'dateRange', from: '2026-10-06', to: '2026-10-06', timeZone: 'UTC' });
  if (!result.ok) throw new Error(result.code);
  const base = { contractVersion: 1, requestId: crypto.randomUUID(), operation: 'summary', locale: 'zh', restoreGeneration: 2,
    stage: { selection: result.selection, range: result.range, sourceRevision: 3, capturedAt: at,
      payload: result.payload, goals: result.goals, completionLinks: result.completionLinks } };
  return validateRequest({ ...base, sendConfirmation: await confirmationFor(base) }, 1, 65536);
}

it('summary accepts exact stage without a goal text and builds a facts-only prompt and strict candidate', async () => {
  const req = await request(); expect(req.operation).toBe('summary'); if (req.operation !== 'summary') throw new Error();
  expect(validateSummaryStage(req.stage, 2).report.bodyWeights[0].weightGrams).toBe(70000);
  const prompt = await buildAiPrompt(req); const sent = JSON.parse(prompt.messages[1].content);
  expect(sent.statistics.bodyWeights[0].weightGrams).toBe(70000); expect(sent).not.toHaveProperty('goalText');
  expect(prompt.messages[0].content).toContain('Range-external completionLinks');
  const result = { summary: '合成阶段总结', nextStageAdvice: ['循序渐进'] };
  expect(validateCandidate(req, result)).toEqual(result);
  for (const bad of [{ ...result, report: {} }, { summary: '', nextStageAdvice: [] }, { summary: 'ok', nextStageAdvice: Array(9).fill('x') },
    { summary: 'x'.repeat(8001), nextStageAdvice: [] }, { summary: 'ok', nextStageAdvice: ['x'.repeat(2001)] }]) expect(() => validateCandidate(req, bad)).toThrow('INVALID_CANDIDATE');
  const encoded = await createDeepSeekCodec({ maxOutputTokens: 2048 }).encode(req) as { model: string; messages: unknown[] };
  expect(encoded.model).toBe('deepseek-flash'); expect(encoded.messages).toHaveLength(2);
});

it('summary rejects extra database entities, unconfirmed changes, invalid scope/source/restore and unknown references', async () => {
  const req = await request(); if (req.operation !== 'summary') throw new Error();
  for (const mutate of [
    (stage: typeof req.stage) => { stage.payload.bodyWeights[0].localDate = '2026-10-08'; },
    (stage: typeof req.stage) => { stage.payload.sources = ['sessions']; },
    (stage: typeof req.stage) => { stage.sourceRevision++; },
    (stage: typeof req.stage) => { stage.range.timeZone = 'Asia/Shanghai'; },
    (stage: typeof req.stage) => { stage.payload.restoreGeneration++; },
    (stage: typeof req.stage) => { stage.payload.bodyWeights.push(stage.payload.bodyWeights[0]); },
  ]) {
    const changed = structuredClone(req); mutate(changed.stage); changed.sendConfirmation = await confirmationFor(changed);
    await expect(validateRequest(changed, 1, 65536)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  }
  await expect(validateRequest({ ...req, stage: { ...req.stage, report: {} } }, 1, 65536)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  const changed = structuredClone(req); changed.stage.payload.bodyWeights[0].weightGrams++;
  await expect(validateRequest(changed, 1, 65536)).rejects.toMatchObject({ code: 'CONFIRMATION_REQUIRED' });
});

it('legacy controls keep summary disabled and existing usage, enabled summary reserves independently and blocks on pending', async () => {
  const store = new SqliteControlStore(':memory:'); let calls = 0;
  const supplier = { kind: 'local-mock' as const, call: async () => { calls++; return { result: { summary: 'Synthetic summary', nextStageAdvice: [] } }; } };
  try {
    const oldConfig = { ...testConfig, requestBounds: { understand: 100, generate: 300 }, quotas: { understand: 8, generate: 4 } };
    const old = new ControlService(store, oldConfig, supplier); const session = await old.redeem((await old.issue(testConfig.adminSecret)).code);
    await old.enableMock(testConfig.adminSecret, true);
    await expect(old.submit(session.token, await request())).rejects.toMatchObject({ code: 'SUMMARY_DISABLED' }); expect(calls).toBe(0);
    await store.transact(state => { state.usages[`${session.subjectId}:${new Date().toISOString().slice(0, 7)}`] = { understand: 2, generate: 1 }; });
    const service = new ControlService(store, testConfig, supplier); expect((await service.status(session.token)).summaryAvailable).toBe(true);
    const req = await request(); expect(await service.submit(session.token, req)).toMatchObject({ accounting: 'pending', result: { summary: 'Synthetic summary' } });
    const state = await store.read(); const used = Object.values(state.usages)[0]; expect(used).toEqual({ understand: 2, generate: 1, summary: 1 });
    expect(Object.values(state.budgets)[0]).toEqual({ spent: 0, reserved: 300 }); expect(JSON.stringify(state)).not.toContain('Synthetic summary');
    expect((await service.status(session.token)).summaryAvailable).toBe(false);
    await expect(service.submit(session.token, req)).rejects.toMatchObject({ code: 'REQUEST_IN_PROGRESS' });
    await expect(service.submit(session.token, await request())).rejects.toMatchObject({ code: 'RECONCILIATION_REQUIRED' }); expect(calls).toBe(1);
  } finally { store.close(); }
});

it('summary endpoint obeys auth/origin/disabled worker and old/new policy compatibility', async () => {
  const store = new SqliteControlStore(':memory:');
  try {
    const service = new ControlService(store, testConfig, { kind: 'local-mock', call: async () => ({ result: { summary: 'Synthetic', nextStageAdvice: [] }, actualCost: 10 }) });
    const handler = createHandler(service, { origins: ['https://preview.test'], maxBodyBytes: 65536 });
    const req = await request(); const post = (origin = 'https://preview.test') => new Request('https://preview.test/api/v1/stages/summarize', {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(req) });
    expect((await handler(post())).status).toBe(401); expect((await handler(post('https://other.test'))).status).toBe(403);
    const env = { CONTROL_MODE: 'control-only', CONTROL_ADMIN_SECRET: 'a'.repeat(40), CONTROL_DIGEST_SECRET: 'b'.repeat(40), CONTROL_ORIGINS: '["https://preview.test"]',
      CONTROL_POLICY: JSON.stringify({ ...testConfig, mode: undefined, adminSecret: undefined, digestSecret: undefined }) };
    expect(readWorkerConfig(env)?.control.quotas.summary).toBe(4);
    const old = JSON.parse(env.CONTROL_POLICY); delete old.quotas.summary; delete old.requestBounds.summary;
    expect(readWorkerConfig({ ...env, CONTROL_POLICY: JSON.stringify(old) })?.control.quotas.summary).toBeUndefined();
    expect((await createWorker({ store: () => store }).fetch(post(), env)).status).toBe(503);
  } finally { store.close(); }
});

it('real summary status permits first use and old usage without writing or resetting the ledger', async () => {
  const store = new SqliteControlStore(':memory:');
  try {
    const service = new ControlService(store, testConfig, { kind: 'local-mock', call: async () => { throw new Error('no supplier calls'); } });
    const session = await service.redeem((await service.issue(testConfig.adminSecret)).code);
    await service.enableMock(testConfig.adminSecret, true);
    const handler = createHandler(service, { origins: ['https://preview.test'], maxBodyBytes: 65536 });
    const client = createSummaryClient(async () => handler(new Request('https://preview.test/api/v1/trial/status',
      { headers: { Cookie: `__Host-fitness_trial=${session.token}` } })));
    const before = await store.read(); const first = await client.status();
    expect(first.used.summary).toBe(0); expect(summaryEligible(first)).toBe(true); expect(await store.read()).toEqual(before);
    await store.transact(state => { state.usages[`${session.subjectId}:${first.period}`] = { understand: 3, generate: 2 }; });
    const old = await store.read(); const status = await client.status();
    expect(status.used).toEqual({ understand: 3, generate: 2, summary: 0 }); expect(summaryEligible(status)).toBe(true); expect(await store.read()).toEqual(old);
    const disabled = new ControlService(store, { ...testConfig, quotas: { understand: 8, generate: 4 }, requestBounds: { understand: 100, generate: 300 } },
      { kind: 'local-mock', call: async () => { throw new Error('no supplier calls'); } });
    expect(summaryEligible(await disabled.status(session.token))).toBe(false);
  } finally { store.close(); }
});

it('restored summary allowance requires explicit evidence and cannot reduce known usage', async () => {
  const store = new SqliteControlStore(':memory:');
  try {
    const supplier = { kind: 'local-mock' as const, call: async () => { throw new Error('no supplier calls'); } };
    const service = new ControlService(store, testConfig, supplier);
    const session = await service.redeem((await service.issue(testConfig.adminSecret)).code); const period = (await service.status(session.token)).period;
    const key = `${session.subjectId}:${period}`;
    await store.transact(state => { state.usages[key] = { understand: 2, generate: 1, summary: 3 }; });
    await service.markLedgerRecovered(testConfig.adminSecret); const before = await store.read();
    const evidence = { budgets: { [period]: 0 }, usages: { [key]: { understand: 2, generate: 1 } } };
    await expect(service.confirmReconciled(testConfig.adminSecret, evidence)).rejects.toMatchObject({ code: 'RECONCILIATION_EVIDENCE_REQUIRED' });
    expect(await store.read()).toEqual(before);
    await service.confirmReconciled(testConfig.adminSecret, { ...evidence, usages: { [key]: { ...evidence.usages[key], summary: 0 } } });
    expect((await store.read()).usages[key].summary).toBe(3);
    const legacy = new ControlService(store, { ...testConfig, quotas: { understand: 8, generate: 4 }, requestBounds: { understand: 100, generate: 300 } }, supplier);
    await legacy.markLedgerRecovered(testConfig.adminSecret);
    await expect(legacy.confirmReconciled(testConfig.adminSecret, evidence)).rejects.toMatchObject({ code: 'RECONCILIATION_EVIDENCE_REQUIRED' });
    // Simulate a restored snapshot whose usage lost the summary counter.
    await store.transact(state => { state.usages[key] = { understand: 2, generate: 1 }; });
    await expect(service.confirmReconciled(testConfig.adminSecret, evidence)).rejects.toMatchObject({ code: 'RECONCILIATION_EVIDENCE_REQUIRED' });
    await store.transact(state => { state.requests['summary-proof'] = { subjectId: session.subjectId, requestId: crypto.randomUUID(),
      inputDigest: 'synthetic', operation: 'summary', period, bound: 300, status: 'settled', cancelled: false, actualCost: 10 }; });
    await expect(legacy.confirmReconciled(testConfig.adminSecret, evidence)).rejects.toMatchObject({ code: 'RECONCILIATION_EVIDENCE_REQUIRED' });
    await legacy.confirmReconciled(testConfig.adminSecret, { ...evidence, usages: { [key]: { ...evidence.usages[key], summary: 1 } } });
    expect((await store.read()).usages[key].summary).toBe(1);
  } finally { store.close(); }
});

it('legacy policy and ledger without summary facts retain two-counter recovery compatibility', async () => {
  const store = new SqliteControlStore(':memory:');
  try {
    const service = new ControlService(store, { ...testConfig, quotas: { understand: 8, generate: 4 }, requestBounds: { understand: 100, generate: 300 } },
      { kind: 'local-mock', call: async () => { throw new Error('no supplier calls'); } });
    const session = await service.redeem((await service.issue(testConfig.adminSecret)).code); const period = (await service.status(session.token)).period;
    await service.markLedgerRecovered(testConfig.adminSecret);
    await service.confirmReconciled(testConfig.adminSecret, { budgets: { [period]: 0 }, usages: { [`${session.subjectId}:${period}`]: { understand: 0, generate: 0 } } });
    expect((await store.read()).recoveryRequired).toBe(false);
  } finally { store.close(); }
});

it('outside-range completed links preserve completion attribution without leaking session performance', async () => {
  const req = await request(); if (req.operation !== 'summary') throw new Error();
  const stage = structuredClone(req.stage); const planId = id('2'), versionId = id('3'), dayId = id('4'), taskId = id('5'), sessionId = id('6');
  stage.payload.plans = [{ ...entity, id: planId, name: 'Plan', source: 'manual', status: 'active', currentVersionId: versionId,
    startDate: '2026-10-06', scheduleTimeZone: 'UTC', model: 'date-day' }];
  stage.payload.planVersions = [{ ...entity, id: versionId, planId, versionNumber: 1, model: 'date-day', startDate: '2026-10-06', scheduleTimeZone: 'UTC',
    days: [{ dayId, date: '2026-10-06', exercises: [{ exerciseId: exerciseIdSchema.parse(exercises.find(item => item.metricType === 'reps')!.id), order: 0, targetSets: [{ metricType: 'reps', reps: 8 }] }] }] }];
  stage.payload.scheduledWorkouts = [{ ...entity, id: taskId, planVersionId: versionId, plannedDayId: dayId, originalDate: '2026-10-06', scheduledDate: '2026-10-08', status: 'pending', completedSessionId: sessionId }];
  stage.goals = [{ planId, planVersionId: versionId, goal: { goal: 'Synthetic goal' } }];
  stage.completionLinks = [{ taskId, sessionId, planVersionId: versionId, plannedDayId: dayId }];
  const result = validateSummaryStage(summaryStageSchema.parse(stage), 2); expect(result.report).toMatchObject({ dueCount: 1, completedCount: 1, completionRate: 1, history: [] });
  stage.completionLinks = []; expect(() => validateSummaryStage(stage, 2)).toThrow('INVALID_INPUT');
});

it('completed source facts retain four metrics, recorded zero and missing distance; reject false completion/foreign metrics', async () => {
  const req = await request(); if (req.operation !== 'summary') throw new Error();
  const stage = structuredClone(req.stage); const sessionId = id('10');
  const snapshots = exercises.slice(0, 4).map((exercise, order) => {
    const { steps: _steps, cautions: _cautions, ...fields } = exercise;
    return { ...fields, allowedMetrics: [...fields.allowedMetrics].sort(), exerciseInstanceId: id(String(20 + order)), exerciseId: exerciseIdSchema.parse(exercise.id), order, targetSets: [] };
  });
  stage.payload.sessions = [{ ...entity, id: sessionId, status: 'completed', startedAt: '2026-10-06T10:00:00Z', completedAt: '2026-10-06T11:00:00Z',
    localDate: '2026-10-06', timeZone: 'UTC', originalExerciseSnapshots: snapshots, exerciseSnapshots: snapshots }];
  stage.payload.sets = snapshots.map((snapshot, order) => ({ ...entity, id: id(String(30 + order)), sessionId,
    exerciseInstanceId: snapshot.exerciseInstanceId, order, metricType: snapshot.metricType, completed: true,
    ...(snapshot.metricType === 'reps_load' ? { reps: 8, loadGrams: 0 } : snapshot.metricType === 'reps' ? { reps: 8 } : { durationSeconds: 20 }) }));
  stage.payload.sets.push({ ...stage.payload.sets[1], id: id('35'), order: 5, distanceMeters: 0 });
  // Canonical history payload arrays are ordered by source identity.
  stage.payload.sets.sort((a, b) => a.id.localeCompare(b.id));
  const parsed = summaryStageSchema.parse(stage); const { report } = validateSummaryStage(parsed, 2);
  expect(report.totals).toMatchObject({ reps: 16, loadGrams: 0, distanceMeters: 0, missingDistanceSets: 1 });
  for (const mutate of [(value: typeof parsed) => { value.payload.sessions[0].status = 'in_progress'; },
    (value: typeof parsed) => { value.payload.sessions[0].completedAt = undefined; },
    (value: typeof parsed) => { value.payload.sets[0].completed = false; },
    (value: typeof parsed) => { value.payload.sessions[0].exerciseSnapshots[0].metricType = 'reps'; },
    (value: typeof parsed) => { value.payload.sets[1].exerciseInstanceId = id('999'); },
    (value: typeof parsed) => { value.payload.sets[4].order = value.payload.sets[1].order; }]) {
    const broken = structuredClone(parsed); mutate(broken); expect(() => validateSummaryStage(broken, 2)).toThrow('INVALID_INPUT');
  }
});
