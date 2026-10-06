import { describe, expect, it } from 'vitest';
import { buildStageSummary } from '../../src/application/stage-summary';
import type { HistorySnapshot } from '../../src/application/history-context';
import type { PlanVersion, WorkoutSession, SetRecord } from '../../src/domain/models';
import { exercises } from '../../src/catalog/exercises';

const base: HistorySnapshot = { capturedAt: '2026-03-10T12:00:00Z', dataRevision: 4, restoreGeneration: 2, plans: [], planVersions: [], sessions: [], sets: [], scheduledWorkouts: [], bodyWeights: [] };
const entity = { createdAt: base.capturedAt, updatedAt: base.capturedAt, revision: 0 };
function session(id: string, localDate = '2026-03-08', planVersionId?: string): WorkoutSession {
  const { steps: _steps, cautions: _cautions, ...exercise } = exercises[0];
  return { ...entity, id, status: 'completed', startedAt: base.capturedAt, localDate, timeZone: 'America/New_York', ...(planVersionId ? { planVersionId, plannedDayId: planVersionId } : {}), originalExerciseSnapshots: [],
    exerciseSnapshots: [{ ...exercise, exerciseId: exercise.id as WorkoutSession['exerciseSnapshots'][number]['exerciseId'], exerciseInstanceId: 'instance', order: 0, targetSets: [] }] };
}
function fixture(): HistorySnapshot {
  const versions: PlanVersion[] = [
    { ...entity, id: 'new', planId: 'p', versionNumber: 2, model: 'date-day', startDate: '2026-03-08', scheduleTimeZone: 'America/New_York', goalSnapshot: { goal: 'new goal' }, days: [{ dayId: 'new', date: '2026-03-08', exercises: [] }] },
    { ...entity, id: 'old', planId: 'p', versionNumber: 1, startDate: '2026-03-01', scheduleTimeZone: 'America/New_York', goalSnapshot: { goal: 'old goal' }, durationWeeks: 2, daysPerWeek: 1, days: [{ dayId: 'old', weekIndex: 2, dayOfWeek: 7, exercises: [] }] },
  ];
  return { ...base, planVersions: versions, plans: [{ ...entity, id: 'p', name: 'Plan', source: 'manual', status: 'active', currentVersionId: 'new', startDate: '2026-03-08', scheduleTimeZone: 'America/New_York' }],
    sessions: [session('new-session', '2026-03-08', 'new'), session('old-session', '2026-03-08', 'old'), session('temporary'), { ...session('ongoing'), status: 'in_progress' }],
    scheduledWorkouts: ['new', 'old'].map(id => ({ ...entity, id, planVersionId: id, plannedDayId: id, originalDate: '2026-03-08', scheduledDate: '2026-03-08', completedSessionId: `${id}-session`, status: 'pending' })),
  };
}
function accepted(input: HistorySnapshot, selection: Parameters<typeof buildStageSummary>[1]) {
  const result = buildStageSummary(input, selection);
  if (!result.ok) throw new Error(result.code + result.detail);
  return result;
}
describe('stage summary local selection', () => {
  it('reports empty and invalid ranges without a fabricated summary', () => {
    expect(buildStageSummary(base, { kind: 'dateRange', from: '2026-03-01', to: '2026-03-10', timeZone: 'UTC' })).toMatchObject({ ok: false, code: 'EMPTY_STAGE' });
    expect(buildStageSummary(base, { kind: 'dateRange', from: '2026-03-11', to: '2026-03-10', timeZone: 'UTC' })).toMatchObject({ ok: false, code: 'INVALID_RANGE' });
  });
  it('retains same-date new, legacy and temporary sessions as separate identities', () => {
    const input = fixture(); const before = structuredClone(input);
    const result = accepted(input, { kind: 'dateRange', from: '2026-03-08', to: '2026-03-08', timeZone: 'UTC' });
    expect(result.manifest.counts.sessions).toBe(3);
    expect(result.manifest.identities.sessions).toEqual(['new-session', 'old-session', 'temporary']);
    expect(result.report.completedCount).toBe(2);
    expect(result.goals.map(row => row.goal.goal)).toEqual(['new goal', 'old goal']);
    expect(result.manifest).toMatchObject({ dataRevision: 4, restoreGeneration: 2 });
    expect(input).toEqual(before);
  });
  it('selects the entire plan across versions and excludes temporary workouts', () => {
    const result = accepted(fixture(), { kind: 'wholePlan', planId: 'p', timeZone: 'UTC' });
    expect(result.range).toMatchObject({ from: '2026-03-01', to: '2026-03-14' });
    expect(result.manifest.identities.sessions).toEqual(['new-session', 'old-session']);
    expect(result.report).toMatchObject({ dueCount: 2, completedCount: 2 });
  });
  it('uses seven calendar days across DST and inclusive endpoints', () => {
    const input = fixture(); input.sessions = [session('first', '2026-03-07', 'new'), session('last', '2026-03-13', 'new'), session('outside', '2026-03-14', 'new')];
    const result = accepted(input, { kind: 'planWeek', planId: 'p', from: '2026-03-07', timeZone: 'America/New_York' });
    expect(result.range.to).toBe('2026-03-13');
    expect(result.manifest.identities.sessions).toEqual(['first', 'last']);
  });
  it('credits an outside-range make-up to the original task without including its facts', () => {
    const input = fixture(); input.sessions = [session('new-session', '2026-03-09', 'new'), session('temporary')];
    input.bodyWeights = [{ ...entity, id: 'weight', localDate: '2026-03-08', timeZone: 'UTC', weightGrams: 70000 }];
    const result = accepted(input, { kind: 'planWeek', planId: 'p', from: '2026-03-02', timeZone: 'UTC' });
    expect(result.payload.sessions).toEqual([]);
    // A real profile weight makes this an eligible stage even without in-range training.
    expect(result.report.completedCount).toBe(1);
  });
  it('preserves four metric types, missing distance and recorded zero; excludes unfinished sets', () => {
    const input = fixture();
    input.sets = [
      { ...entity, id: 'load', sessionId: 'temporary', exerciseInstanceId: 'instance', order: 0, metricType: 'reps_load', completed: true, reps: 5, loadGrams: 0 },
      { ...entity, id: 'reps', sessionId: 'temporary', exerciseInstanceId: 'instance', order: 1, metricType: 'reps', completed: true, reps: 8 },
      { ...entity, id: 'duration', sessionId: 'temporary', exerciseInstanceId: 'instance', order: 2, metricType: 'duration', completed: true, durationSeconds: 20 },
      { ...entity, id: 'missing', sessionId: 'temporary', exerciseInstanceId: 'instance', order: 3, metricType: 'duration_distance', completed: true, durationSeconds: 30 },
      { ...entity, id: 'zero', sessionId: 'temporary', exerciseInstanceId: 'instance', order: 4, metricType: 'duration_distance', completed: true, durationSeconds: 30, distanceMeters: 0 },
      { ...entity, id: 'unfinished', sessionId: 'temporary', exerciseInstanceId: 'instance', order: 5, metricType: 'reps', completed: false },
    ] satisfies SetRecord[];
    const result = accepted(input, { kind: 'dateRange', from: '2026-03-08', to: '2026-03-08', timeZone: 'UTC' });
    expect(result.payload.sets).toHaveLength(5);
    expect(new Set(result.payload.sets.map(row => row.metricType)).size).toBe(4);
    expect(result.payload.sets.find(row => row.id === 'missing')).not.toHaveProperty('distanceMeters');
    expect(result.payload.sets.find(row => row.id === 'zero')?.distanceMeters).toBe(0);
  });
  it('accepts weight-only stages, with profile-level observations and missing days untouched', () => {
    const input = { ...base, bodyWeights: [{ ...entity, id: 'weight', localDate: '2026-03-08', timeZone: 'UTC', weightGrams: 70000 }] };
    const result = accepted(input, { kind: 'dateRange', from: '2026-03-01', to: '2026-03-10', timeZone: 'UTC' });
    expect(result.payload.bodyWeights).toHaveLength(1);
    expect(result.goals).toEqual([]);
    expect(result.report.completionRate).toBeNull();
  });
  it('rejects missing referenced versions rather than inventing provenance', () => {
    const input = { ...base, sessions: [session('broken', '2026-03-08', 'missing')] };
    expect(buildStageSummary(input, { kind: 'dateRange', from: '2026-03-08', to: '2026-03-08', timeZone: 'UTC' })).toMatchObject({ ok: false, code: 'INVALID_FACTS' });
  });
});
