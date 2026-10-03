import { describe, expect, it } from 'vitest';
import { calculateProgress } from '../../src/application/progress';
import type { ProgressFacts, ScheduledWorkout, WorkoutSession, SetRecord } from '../../src/domain/models';
import { exercises } from '../../src/catalog/exercises';

const timestamp = '2026-10-01T00:00:00Z';
const entity = { createdAt: timestamp, updatedAt: timestamp, revision: 0 };
function facts(): ProgressFacts {
  return { from: '2026-10-01', to: '2026-10-03', timeZone: 'Asia/Shanghai',
    nowMs: Date.parse('2026-10-03T17:00:00Z'), planTimeZones: { version: 'Asia/Shanghai' },
    sessions: [], sets: [], scheduledWorkouts: [], bodyWeights: [] };
}
function schedule(id: string, date: string): ScheduledWorkout {
  return { ...entity, id, planVersionId: 'version', plannedDayId: id, originalDate: date,
    scheduledDate: date, status: 'pending' };
}
function session(id: string, date: string, status: WorkoutSession['status'] = 'completed'): WorkoutSession {
  const { steps: _steps, cautions: _cautions, ...exercise } = exercises[0];
  return { ...entity, id, localDate: date, timeZone: 'Asia/Shanghai', status, startedAt: timestamp,
    exerciseSnapshots: [{ ...exercise, exerciseId: exercise.id as WorkoutSession['exerciseSnapshots'][number]['exerciseId'], exerciseInstanceId: 'instance', order: 0, targetSets: [] }],
    originalExerciseSnapshots: [] };
}
function set(id: string, sessionId: string, values: Partial<SetRecord> = {}): SetRecord {
  return { ...entity, id, sessionId, exerciseInstanceId: 'instance', order: 0,
    metricType: 'reps_load', completed: true, reps: 10, loadGrams: 2000, ...values };
}

describe('progress from completed facts', () => {
  it('has no invented rate or trend when no tasks are due', () => {
    const report = calculateProgress(facts(), '2026-10-03');
    expect(report.completionRate).toBeNull();
    expect(report.categoryTrends).toEqual([]);
    expect(report.exerciseTrends).toEqual([]);
  });
  it('counts skipped and missed original dates, excluding today before its deadline', () => {
    const input = facts();
    input.nowMs = Date.parse('2026-10-03T10:00:00Z');
    input.scheduledWorkouts = [{ ...schedule('skip', '2026-10-01'), status: 'skipped' }, schedule('miss', '2026-10-02'), schedule('today', '2026-10-03')];
    expect(calculateProgress(input, input.to)).toMatchObject({ dueCount: 2, completedCount: 0, completionRate: 0 });
  });
  it('uses each originating plan timezone at the UTC boundary, independently of profile timezone', () => {
    const input = facts();
    input.planTimeZones = { version: 'Asia/Shanghai', west: 'America/Los_Angeles' };
    input.scheduledWorkouts = [schedule('east', '2026-10-03'), { ...schedule('west', '2026-10-03'), planVersionId: 'west' }];
    expect(calculateProgress(input, input.to).dueCount).toBe(1);
    input.timeZone = 'Pacific/Honolulu';
    expect(calculateProgress(input, input.to).dueCount).toBe(1);
  });
  it('credits a later make-up to its original stage but keeps ad hoc actual-date history separate', () => {
    const input = facts();
    input.to = '2026-10-01';
    input.scheduledWorkouts = [{ ...schedule('day', '2026-10-01'), scheduledDate: '2026-10-03', completedSessionId: 'makeup' }];
    input.sessions = [{ ...session('makeup', '2026-10-03'), planVersionId: 'version', plannedDayId: 'day' }, session('ad-hoc', '2026-10-03')];
    const original = calculateProgress(input, input.to);
    expect(original).toMatchObject({ completedCount: 1, dueCount: 1, completionRate: 1, history: [] });
    input.from = '2026-10-03'; input.to = '2026-10-03';
    expect(calculateProgress(input, input.to).history.map(row => row.id).sort()).toEqual(['ad-hoc', 'makeup']);
    expect(calculateProgress(input, input.to).dueCount).toBe(0);
  });
  it('excludes ongoing and abandoned sessions and incomplete sets from all completed statistics', () => {
    const input = facts();
    input.sessions = [session('done', '2026-10-02'), session('ongoing', '2026-10-02', 'in_progress'), session('abandoned', '2026-10-02', 'abandoned')];
    input.sets = [set('a', 'done'), set('b', 'ongoing'), set('c', 'abandoned'), set('d', 'done', { completed: false })];
    const report = calculateProgress(input, input.to);
    expect(report.history.map(row => row.id)).toEqual(['done']);
    expect(report.totals).toMatchObject({ reps: 10, loadGrams: 2000, volumeGrams: 20000 });
    expect(report.exerciseTrends[0]).toMatchObject({ localDate: '2026-10-02', exerciseId: exercises[0].id, reps: 10, loadGrams: 2000 });
    expect(report.categoryTrends[0]).toMatchObject({ category: 'strength', localDate: '2026-10-02', reps: 10 });
  });
  it('keeps duration and distance separate and missing distance unknown', () => {
    const input = facts();
    const cardio = session('cardio', '2026-10-02');
    cardio.exerciseSnapshots[0] = { ...cardio.exerciseSnapshots[0], category: 'cardio', metricType: 'duration_distance' };
    input.sessions = [cardio];
    input.sets = [set('duration', 'cardio', { metricType: 'duration_distance', reps: undefined, loadGrams: undefined, durationSeconds: 90 })];
    expect(calculateProgress(input, input.to).totals).toMatchObject({ durationSeconds: 90, distanceMeters: null });
    input.sets.push(set('distance', 'cardio', { metricType: 'duration_distance', reps: undefined, loadGrams: undefined, durationSeconds: 120, distanceMeters: 500 }));
    expect(calculateProgress(input, input.to).totals).toMatchObject({ durationSeconds: 210, distanceMeters: 500, missingDistanceSets: 1 });
  });
  it('preserves observed weight dates with gaps rather than fabricated readings', () => {
    const input = facts();
    input.bodyWeights = [{ ...entity, id: 'a', localDate: '2026-10-01', timeZone: 'Asia/Shanghai', weightGrams: 70000 }, { ...entity, id: 'b', localDate: '2026-10-03', timeZone: 'Asia/Shanghai', weightGrams: 69000 }];
    expect(calculateProgress(input, input.to).bodyWeights.map(row => row.localDate)).toEqual(['2026-10-01', '2026-10-03']);
  });
  it('rejects missing originating plan context instead of using the profile timezone', () => {
    const input = facts();
    input.scheduledWorkouts = [{ ...schedule('missing', '2026-10-01'), planVersionId: 'unknown' }];
    expect(() => calculateProgress(input, input.to)).toThrow('Originating plan time zone is missing');
  });
  it('does not treat an abandoned linked session as completed and applies selected stage', () => {
    const input = facts();
    input.planVersionId = 'version';
    input.planTimeZones.other = 'Asia/Shanghai';
    input.sessions = [{ ...session('abandoned', '2026-10-02', 'abandoned'), planVersionId: 'version', plannedDayId: 'a' }, { ...session('other', '2026-10-02'), planVersionId: 'other' }];
    input.scheduledWorkouts = [{ ...schedule('a', '2026-10-01'), completedSessionId: 'abandoned' }, { ...schedule('b', '2026-10-01'), planVersionId: 'other' }];
    expect(calculateProgress(input, input.to)).toMatchObject({ dueCount: 1, completedCount: 0, history: [] });
  });
});
