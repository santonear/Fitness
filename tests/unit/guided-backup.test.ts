import { describe, expect, it } from 'vitest';
import { validateBackupEnvelope } from '../../src/application/backup';
import { emptyGuidedState, type GuidedState } from '../../src/domain/guided-contracts';

const profileId = '00000000-0000-4000-8000-000000000001';
const timestamp = '2026-10-07T00:00:00Z';
function backup(version = 4) {
  return {
    format: 'fitness-local', schemaVersion: version, catalogVersion: 1, exportedAt: timestamp,
    data: {
      metadata: { schemaVersion: version + 1, catalogVersion: 1, localProfileId: profileId, revision: 1, dataRevision: 1 },
      profiles: [{ id: profileId, revision: 0, createdAt: timestamp, updatedAt: timestamp, locale: 'en', timeZone: 'UTC', units: 'metric' }],
      plans: [], planVersions: [], sessions: [], sets: [], scheduledWorkouts: [], bodyWeights: [], timers: [], aiMemoryNotes: [], mediaAssets: [],
      trainingMemo: { schemaVersion: 1, revision: 0, sourceRevision: 1, updatedAt: timestamp, sessions: [] },
      ...(version === 4 ? { guidedStates: [] as unknown[] } : {}),
    },
  };
}
const emptyState = { id: 'guided', revision: 0, programs: [], candidates: [], messages: [], events: [], observations: [], invitations: [] };
const ids = Array.from({ length: 16 }, (_, index) => `00000000-0000-4000-8000-${String(index + 10).padStart(12, '0')}`);
function populatedState(): GuidedState {
  return {
    ...emptyGuidedState(),
    onboarding: { id: ids[0], step: 2, answers: { goal: { status: 'answered', value: 'Strength' }, health: { status: 'skipped' } }, updatedAt: timestamp, completed: false },
    candidates: [{ id: ids[1], name: 'Phase', goal: 'Strength', startDate: '2026-10-07', endDate: '2026-10-10', timeZone: 'UTC',
      days: [{ date: '2026-10-07', exercises: [{ exerciseId: 'd16325d9-fc00-4c41-88a1-000000000001', order: 0,
        targetSets: [{ metricType: 'reps_load', reps: 10, loadGrams: 2000 }] }] }], explanation: 'Available time', createdAt: timestamp, restoreGeneration: 0 }],
    programs: [{ id: ids[2], name: 'Phase', goal: 'Strength', startDate: '2026-10-07', endDate: '2026-10-10', timeZone: 'UTC',
      status: 'paused', revision: 0, planIds: [ids[8]], taskIds: [ids[10]], candidateId: ids[1], explanation: 'Available time', createdAt: timestamp, updatedAt: timestamp }],
    messages: [{ id: ids[3], conversationId: ids[0], role: 'assistant', content: 'Review the phase', createdAt: timestamp, programId: ids[2], candidateId: ids[1] }],
    events: [{ id: ids[4], programId: ids[2], action: 'paused', before: 'active', after: 'paused', reason: 'Travel', createdAt: timestamp }],
    observations: [{ id: ids[5], kind: 'waist', value: 80, unit: 'cm', localDate: '2026-10-07', timeZone: 'UTC', method: 'Tape', createdAt: timestamp }],
    invitations: [{ id: ids[6], eventId: ids[4], decision: 'declined' }],
  };
}
function populatedBackup() {
  const value = backup(); const state = populatedState();
  return { ...value, data: { ...value.data, guidedStates: [state],
    plans: [{ id: ids[8], revision: 0, createdAt: timestamp, updatedAt: timestamp, name: 'Phase', source: 'ai', status: 'active',
      model: 'date-day', currentVersionId: ids[9], startDate: '2026-10-07', scheduleTimeZone: 'UTC' }],
    planVersions: [{ id: ids[9], revision: 0, createdAt: timestamp, updatedAt: timestamp, planId: ids[8], versionNumber: 1,
      model: 'date-day', startDate: '2026-10-07', scheduleTimeZone: 'UTC', goalSnapshot: { goal: 'Strength' },
      days: [{ dayId: ids[11], date: '2026-10-07', exercises: structuredClone(state.candidates[0].days[0].exercises) }] }],
    scheduledWorkouts: [{ id: ids[10], revision: 0, createdAt: timestamp, updatedAt: timestamp, planVersionId: ids[9], plannedDayId: ids[11],
      originalDate: '2026-10-07', scheduledDate: '2026-10-07', status: 'pending' }],
  } };
}

describe('guided backup version compatibility', () => {
  it.each([2, 3, 4])('accepts version %i with its original metadata version', version => {
    expect(validateBackupEnvelope(backup(version)).schemaVersion).toBe(version);
  });
  it('requires the guided aggregate collection in v4', () => {
    const value = backup();
    delete value.data.guidedStates;
    expect(() => validateBackupEnvelope(value)).toThrow();
  });
  it('preserves an empty aggregate without inventing a program', () => {
    const value = backup();
    value.data.guidedStates = [emptyState];
    expect(validateBackupEnvelope(value).data).toMatchObject({ guidedStates: [emptyState] });
  });
  it('rejects duplicate aggregate identity', () => {
    const value = backup();
    value.data.guidedStates = [emptyState, emptyState];
    expect(() => validateBackupEnvelope(value)).toThrow(/Duplicate/);
  });
  it('rejects credential fields inside the aggregate', () => {
    const value = backup();
    value.data.guidedStates = [{ ...emptyState, token: 'excluded' }];
    expect(() => validateBackupEnvelope(value)).toThrow();
  });
  it.each([2, 3])('rejects guided data hidden inside old format %i', version => {
    const value = backup(version);
    value.data.guidedStates = [emptyState];
    expect(() => validateBackupEnvelope(value)).toThrow();
  });
  it('rejects a current backup with old database metadata', () => {
    const value = backup();
    value.data.metadata.schemaVersion = 4;
    expect(() => validateBackupEnvelope(value)).toThrow(/version/i);
  });
});

describe('guided backup references and historical facts', () => {
  it.each(['女性', '男性', '其他或不确定', '不愿透露'])('preserves explicit biological sex response %s through JSON validation round-trip', value => {
    const envelope = populatedBackup();
    envelope.data.guidedStates[0].onboarding!.answers.biologicalSex = { status: 'answered', value };
    const first = validateBackupEnvelope(JSON.parse(JSON.stringify(envelope)));
    const second = validateBackupEnvelope(JSON.parse(JSON.stringify(first)));
    expect(second.data.guidedStates).toEqual(envelope.data.guidedStates);
    expect(second.data.sessions).toEqual(envelope.data.sessions);
    expect(second.data.scheduledWorkouts).toEqual(envelope.data.scheduledWorkouts);
  });
  it('preserves all aggregate fields including unknown health and declined invitation', () => {
    const value = populatedBackup(); const state = value.data.guidedStates[0];
    expect(validateBackupEnvelope(value).data.guidedStates).toEqual([state]);
  });
  it.each([
    ['plan', (state: GuidedState) => { state.programs[0].planIds.push(ids[7]); }],
    ['task', (state: GuidedState) => { state.programs[0].taskIds.push(ids[7]); }],
    ['candidate', (state: GuidedState) => { state.programs[0].candidateId = ids[7]; }],
    ['message program', (state: GuidedState) => { state.messages[0].programId = ids[7]; }],
    ['message candidate', (state: GuidedState) => { state.messages[0].candidateId = ids[7]; }],
    ['event program', (state: GuidedState) => { state.events[0].programId = ids[7]; }],
    ['event workout', (state: GuidedState) => { state.events[0].sessionId = ids[7]; }],
    ['invitation event', (state: GuidedState) => { state.invitations[0].eventId = ids[7]; }],
  ] as const)('rejects an orphan %s reference', (_, mutate) => {
    const value = populatedBackup(); const state = value.data.guidedStates[0]; mutate(state);
    expect(() => validateBackupEnvelope(value)).toThrow(/not found|does not belong|incomplete/);
  });
  it('rejects another current phase while retaining terminated phases', () => {
    const value = populatedBackup(); const state = value.data.guidedStates[0];
    state.programs.push({ ...state.programs[0], id: ids[7], status: 'active' });
    expect(() => validateBackupEnvelope(value)).toThrow(/Multiple current/);
  });
  it('preserves adjustment dialogue linking a current program to a new unadopted candidate', () => {
    const value = populatedBackup(); const state = value.data.guidedStates[0];
    state.candidates.push({ ...state.candidates[0], id: ids[7], explanation: 'Proposed adjustment' });
    state.messages[0].candidateId = ids[7]; value.data.guidedStates = [state];
    expect(validateBackupEnvelope(value).data.guidedStates).toEqual([state]);
  });
  it('rejects a duplicate nested identity and duplicate event invitations', () => {
    const value = populatedBackup(); const state = value.data.guidedStates[0];
    state.messages.push(state.messages[0]);
    expect(() => validateBackupEnvelope(value)).toThrow(/Duplicate/);
    state.messages.pop(); state.invitations.push({ ...state.invitations[0], id: ids[7] });
    expect(() => validateBackupEnvelope(value)).toThrow(/Duplicate/);
  });
  it('rejects candidate metrics that disagree with the catalog', () => {
    const value = populatedBackup(); const state = value.data.guidedStates[0];
    delete state.programs[0].candidateId;
    state.candidates[0].days[0].exercises[0].targetSets = [{ metricType: 'duration', durationSeconds: 60 }];
    expect(() => validateBackupEnvelope(value)).toThrow(/metrics/);
  });
});

describe('guided program complete membership', () => {
  it.each([
    ['empty plans', (value: ReturnType<typeof populatedBackup>) => { value.data.guidedStates[0].programs[0].planIds = []; }],
    ['empty tasks', (value: ReturnType<typeof populatedBackup>) => { value.data.guidedStates[0].programs[0].taskIds = []; }],
    ['wrong active child status', (value: ReturnType<typeof populatedBackup>) => { value.data.plans[0].status = 'archived'; }],
    ['wrong terminated child status', (value: ReturnType<typeof populatedBackup>) => { value.data.guidedStates[0].programs[0].status = 'terminated'; }],
    ['wrong timezone', (value: ReturnType<typeof populatedBackup>) => { value.data.guidedStates[0].programs[0].timeZone = 'Asia/Shanghai'; }],
    ['out of range task', (value: ReturnType<typeof populatedBackup>) => { value.data.guidedStates[0].programs[0].startDate = '2026-10-08'; }],
    ['changed adopted exercise', (value: ReturnType<typeof populatedBackup>) => { value.data.guidedStates[0].candidates[0].days[0].exercises[0].targetSets = [{ metricType: 'reps_load', reps: 9, loadGrams: 2000 }]; }],
    ['changed adopted goal', (value: ReturnType<typeof populatedBackup>) => { value.data.planVersions[0].goalSnapshot.goal = 'Other'; }],
    ['omitted candidate day', (value: ReturnType<typeof populatedBackup>) => { value.data.guidedStates[0].candidates[0].days.push({ ...value.data.guidedStates[0].candidates[0].days[0], date: '2026-10-09' }); }],
  ] as const)('rejects %s', (_, mutate) => {
    const value = populatedBackup(); mutate(value); expect(() => validateBackupEnvelope(value)).toThrow();
  });
  it('accepts terminated programs only with archived children and retains stale candidate generation', () => {
    const value = populatedBackup(); value.data.guidedStates[0].programs[0].status = 'terminated'; value.data.plans[0].status = 'archived';
    value.data.guidedStates[0].candidates[0].restoreGeneration = 999;
    expect(() => validateBackupEnvelope(value)).not.toThrow();
  });
  it('rejects a subset of current tasks in a wrapped legacy plan and accepts all tasks', () => {
    const original = populatedBackup(); const program = original.data.guidedStates[0].programs[0]; delete program.candidateId;
    const value = { ...original, data: { ...original.data,
      plans: original.data.plans.map(({ model: _model, ...plan }) => plan),
      planVersions: original.data.planVersions.map(({ model: _model, days, ...version }) => ({ ...version, durationWeeks: 1, daysPerWeek: 2,
        days: [ { dayId: ids[11], weekIndex: 1, dayOfWeek: 3, exercises: days[0].exercises }, { dayId: ids[12], weekIndex: 1, dayOfWeek: 5, exercises: days[0].exercises } ] })),
      scheduledWorkouts: [...original.data.scheduledWorkouts, { ...original.data.scheduledWorkouts[0], id: ids[13], plannedDayId: ids[12], originalDate: '2026-10-09', scheduledDate: '2026-10-09' }],
    } };
    expect(() => validateBackupEnvelope(value)).toThrow(/membership is incomplete/);
    program.taskIds.push(ids[13]); expect(() => validateBackupEnvelope(value)).not.toThrow();
  });
});
