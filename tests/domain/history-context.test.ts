import { describe, expect, it } from 'vitest';
import { buildHistoryContext, type HistorySnapshot, type HistoryScope } from '../../src/application/history-context';
import type { SetRecord, WorkoutSession } from '../../src/domain/models';
import { exercises } from '../../src/catalog/exercises';

const timestamp = '2026-10-01T00:00:00Z';
const entity = { createdAt: timestamp, updatedAt: timestamp, revision: 2 };
function session(id: string, status: WorkoutSession['status'] = 'completed'): WorkoutSession {
  const { steps: _steps, cautions: _cautions, ...exercise } = exercises[0];
  return { ...entity, id, localDate: '2026-10-02', timeZone: 'Asia/Shanghai', status, startedAt: timestamp,
    exerciseSnapshots: [{ ...exercise, exerciseId: exercise.id as WorkoutSession['exerciseSnapshots'][number]['exerciseId'], exerciseInstanceId: 'instance', order: 0, targetSets: [], notes: '目标\n原文😀', originalExerciseId: exercises[1].id as WorkoutSession['exerciseSnapshots'][number]['exerciseId'] }],
    originalExerciseSnapshots: [], notes: '  完整备注\n😀  ' };
}
function snapshot(): HistorySnapshot {
  return { capturedAt: timestamp, dataRevision: 12, restoreGeneration: 3, plans: [], planVersions: [],
    sessions: [session('b'), session('a', 'in_progress')], sets: [], scheduledWorkouts: [], bodyWeights: [] };
}
const scope: HistoryScope = { from: '2026-10-01', to: '2026-10-03', sources: ['sessions'], maxUtf8Bytes: 100000 };
function accepted(input = snapshot(), request = scope) {
  const result = buildHistoryContext(input, request);
  if (!result.ok) throw new Error(result.reason);
  return result;
}
describe('explicit committed history context', () => {
  it('preserves identity, notes, replacement provenance and ongoing status without changing its input', () => {
    const input = snapshot(); const before = structuredClone(input);
    const result = accepted(input);
    expect(input).toEqual(before);
    expect(result.payload.sessions.map(s => s.id)).toEqual(['a', 'b']);
    expect(result.payload.sessions[0]).toMatchObject({ status: 'in_progress', notes: input.sessions[0].notes });
    expect(result.payload.sessions[0].exerciseSnapshots[0]).toMatchObject({ notes: '目标\n原文😀', originalExerciseId: exercises[1].id });
    input.sessions[1].notes = 'changed';
    expect(result.payload.sessions[0].notes).toBe('  完整备注\n😀  ');
    expect(result.manifest).toMatchObject({ source: 'committed-entity-snapshot', dataRevision: 12, restoreGeneration: 3, counts: { sessions: 2 }, sessionStatuses: { completed: 1, in_progress: 1, abandoned: 0 } });
  });
  it('produces identical JSON and manifest for permutations including nested exercise and set ordering', () => {
    const input = snapshot(); input.sets = [record('z', 'b'), record('x', 'a')];
    input.sessions[0].exerciseSnapshots.push({ ...input.sessions[0].exerciseSnapshots[0], exerciseInstanceId: 'second', order: 1 });
    const reversed = structuredClone(input); reversed.sessions = [...reversed.sessions].reverse(); reversed.sets = [...reversed.sets].reverse();
    reversed.sessions[1].exerciseSnapshots.reverse();
    expect(accepted(input)).toEqual(accepted(reversed));
  });
  it('retains four metric types, zero versus missing and temporary versus completed sets', () => {
    const input = snapshot();
    input.sets = [record('load', 'b', { loadGrams: 0 }), record('reps', 'b', { metricType: 'reps', loadGrams: undefined }),
      record('time', 'b', { metricType: 'duration', reps: undefined, loadGrams: undefined, durationSeconds: 20 }),
      record('missing', 'b', { metricType: 'duration_distance', reps: undefined, loadGrams: undefined, durationSeconds: 20 }),
      record('zero', 'b', { metricType: 'duration_distance', reps: undefined, loadGrams: undefined, durationSeconds: 20, distanceMeters: 0 }),
      record('temporary', 'a', { completed: false, reps: undefined, loadGrams: undefined })];
    const output = accepted(input).payload.sets;
    expect(output.find(s => s.id === 'load')?.loadGrams).toBe(0);
    expect(output.find(s => s.id === 'missing')).not.toHaveProperty('distanceMeters');
    expect(output.find(s => s.id === 'zero')?.distanceMeters).toBe(0);
    expect(output.find(s => s.id === 'temporary')).toMatchObject({ completed: false });
    expect(new Set(output.map(s => s.metricType)).size).toBe(4);
  });
  it('selects inclusive actual session dates and original schedule dates without merging legacy and new identities', () => {
    const input = snapshot(); input.sessions = [...input.sessions, { ...session('outside'), localDate: '2026-10-04' }];
    input.scheduledWorkouts = ['new', 'legacy'].map(id => ({ ...entity, id, planVersionId: id, plannedDayId: id, originalDate: '2026-10-02', scheduledDate: '2026-10-10', status: 'pending' }));
    input.planVersions = [{ ...entity, id: 'new', planId: 'new', model: 'date-day', versionNumber: 1, goalSnapshot: { goal: 'exact' }, startDate: '2026-10-02', scheduleTimeZone: 'Asia/Shanghai', days: [{ dayId: 'new', date: '2026-10-02', exercises: [] }] },
      { ...entity, id: 'legacy', planId: 'legacy', versionNumber: 1, goalSnapshot: { goal: 'private goal' }, startDate: '2026-10-02', scheduleTimeZone: 'Asia/Shanghai', durationWeeks: 1, daysPerWeek: 1,
        days: [{ dayId: 'legacy', weekIndex: 1, dayOfWeek: 1, exercises: [] }, { dayId: 'unselected', weekIndex: 1, dayOfWeek: 2, exercises: [] }] }];
    input.plans = ['new', 'legacy'].map(id => ({ ...entity, id, name: id, source: 'manual', status: 'active', currentVersionId: id, startDate: '2026-10-02', scheduleTimeZone: 'Asia/Shanghai' }));
    const result = accepted(input, { ...scope, sources: ['sessions', 'scheduledWorkouts'] });
    expect(result.payload.sessions).toHaveLength(2);
    expect(result.payload.scheduledWorkouts.map(s => s.id)).toEqual(['legacy', 'new']);
    expect(result.payload.planVersions.map(v => v.id)).toEqual(['legacy', 'new']);
    expect(result.payload.planVersions[0].days.map(day => day.dayId)).toEqual(['legacy']);
    expect(result.payload.planVersions[1]).toMatchObject({ model: 'date-day' });
    expect(result.json).not.toContain('private goal');
  });
  it('requires explicit source selection and excludes full bodies and unrelated observations', () => {
    const input = snapshot(); input.bodyWeights = [{ ...entity, id: 'weight', localDate: '2026-10-02', timeZone: 'UTC', weightGrams: 70000 }];
    expect(accepted(input, { ...scope, sources: [] }).payload.sessions).toEqual([]);
    expect(accepted(input).payload.bodyWeights).toEqual([]);
    expect(accepted(input, { ...scope, sources: ['bodyWeights'] }).payload.bodyWeights).toHaveLength(1);
    Object.assign(input.sessions[0], { privateUnknownField: 'must not send' });
    expect(accepted(input).json).not.toContain('privateUnknownField');
  });
  it('counts exact UTF8 payload bytes and rejects without a partial payload at one byte over budget', () => {
    const first = accepted(); const bytes = new TextEncoder().encode(first.json).byteLength;
    expect(first.manifest.utf8Bytes).toBe(bytes); expect(bytes).toBeGreaterThan(first.json.length);
    expect(accepted(snapshot(), { ...scope, maxUtf8Bytes: bytes }).json).toBe(first.json);
    expect(buildHistoryContext(snapshot(), { ...scope, maxUtf8Bytes: bytes - 1 })).toMatchObject({ ok: false, reason: 'over_budget', requiredUtf8Bytes: bytes });
    expect(buildHistoryContext(snapshot(), { ...scope, maxUtf8Bytes: bytes - 1 })).not.toHaveProperty('payload');
  });
  it('rejects reversed/invalid ranges, bad metadata, duplicate identities and missing version references', () => {
    expect(buildHistoryContext(snapshot(), { ...scope, from: '2026-10-04' })).toMatchObject({ ok: false, reason: 'invalid_snapshot' });
    expect(buildHistoryContext(snapshot(), { ...scope, to: '2026-02-30' })).toMatchObject({ ok: false });
    const input = snapshot(); input.sessions = [...input.sessions, session('a')];
    expect(buildHistoryContext(input, scope)).toMatchObject({ ok: false });
    const orphan = snapshot(); orphan.sessions[0].planVersionId = 'missing';
    expect(buildHistoryContext(orphan, scope)).toMatchObject({ ok: false });
    const dayOrphan = snapshot(); dayOrphan.sessions[0].planVersionId = 'version'; dayOrphan.sessions[0].plannedDayId = 'missing';
    dayOrphan.planVersions = [{ ...entity, id: 'version', planId: 'plan', versionNumber: 1, goalSnapshot: { goal: 'goal' }, startDate: '2026-10-02', scheduleTimeZone: 'UTC', days: [], durationWeeks: 1, daysPerWeek: 1 }];
    dayOrphan.plans = [{ ...entity, id: 'plan', name: 'plan', source: 'manual', status: 'active', currentVersionId: 'version', startDate: '2026-10-02', scheduleTimeZone: 'UTC' }];
    expect(buildHistoryContext(dayOrphan, scope)).toMatchObject({ ok: false });
    expect(buildHistoryContext({ ...snapshot(), restoreGeneration: -1 }, scope)).toMatchObject({ ok: false });
  });
});
function record(id: string, sessionId: string, extra: Partial<SetRecord> = {}): SetRecord {
  return { ...entity, id, sessionId, exerciseInstanceId: 'instance', order: 0, metricType: 'reps_load', completed: true, reps: 10, loadGrams: 1000, notes: '原文', ...extra };
}
