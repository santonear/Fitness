import { describe, expect, it } from 'vitest';
import { calculateProgress, dateInZone } from '../../src/application/progress-calculation';
import type { ProgressFacts, ScheduledWorkout, SetRecord, WorkoutSession } from '../../src/domain/models';
import { exercises } from '../../src/catalog/exercises';

const timestamp = '2026-10-01T00:00:00Z';
const entity = { createdAt: timestamp, updatedAt: timestamp, revision: 0 };
// 2026-10-04 00:30 in Shanghai, still 2026-10-03 in UTC.
const nowMs = Date.parse('2026-10-03T16:30:00Z');
const facts = (values: Partial<ProgressFacts> = {}): ProgressFacts => ({ from: '2026-10-01', to: '2026-10-04', timeZone: 'Asia/Shanghai', nowMs,
  planTimeZones: { version: 'Asia/Shanghai', other: 'UTC' }, sessions: [], sets: [], scheduledWorkouts: [], bodyWeights: [], ...values });
const schedule = (id: string, date: string, planVersionId = 'version', completedSessionId?: string): ScheduledWorkout =>
  ({ ...entity, id, planVersionId, plannedDayId: id, originalDate: date, scheduledDate: date, status: completedSessionId ? 'completed' : 'pending', ...(completedSessionId ? { completedSessionId } : {}) }) as ScheduledWorkout;
function session(id: string, date: string, plannedDayId?: string): WorkoutSession {
  const { steps: _steps, cautions: _cautions, ...exercise } = exercises[0];
  return { ...entity, id, localDate: date, timeZone: 'Asia/Shanghai', status: 'completed', startedAt: `${date}T01:00:00Z`, planVersionId: 'version', ...(plannedDayId ? { plannedDayId } : {}),
    exerciseSnapshots: [{ ...exercise, exerciseId: exercise.id as WorkoutSession['exerciseSnapshots'][number]['exerciseId'], exerciseInstanceId: 'instance', order: 0, targetSets: [] }],
    originalExerciseSnapshots: [] } as WorkoutSession;
}
const set = (id: string, sessionId: string, values: Partial<SetRecord> = {}): SetRecord =>
  ({ ...entity, id, sessionId, exerciseInstanceId: 'instance', order: 0, metricType: 'reps_load', completed: true, reps: 10, loadGrams: 2000, ...values }) as SetRecord;

describe('calculateProgress', () => {
  it('reads today in the plan time zone', () => {
    expect(dateInZone(nowMs, 'Asia/Shanghai')).toBe('2026-10-04');
    expect(dateInZone(nowMs, 'UTC')).toBe('2026-10-03');
  });

  it('counts a day as due only once it has passed in its plan time zone', () => {
    const report = calculateProgress(facts({ scheduledWorkouts: [schedule('a', '2026-10-03'), schedule('b', '2026-10-03', 'other'), schedule('c', '2026-10-04')] }), '2026-10-04');
    // Shanghai has moved past 10-03, UTC has not; 10-04 is today.
    expect(report.dueCount).toBe(1);
    expect(report.completionRate).toBe(0);
  });

  it('matches completed sessions to their due day and totals only completed sets', () => {
    const report = calculateProgress(facts({
      scheduledWorkouts: [schedule('a', '2026-10-01', 'version', 's1'), schedule('b', '2026-10-02')],
      sessions: [session('s1', '2026-10-01', 'a')],
      sets: [set('x', 's1'), set('y', 's1', { reps: 5, loadGrams: 1000 }), set('z', 's1', { completed: false })],
    }), '2026-10-04');
    expect(report).toMatchObject({ dueCount: 2, completedCount: 1, completionRate: 0.5 });
    expect(report.totals).toMatchObject({ reps: 15, loadGrams: 3000, volumeGrams: 25000 });
    expect(report.history.map(row => row.id)).toEqual(['s1']);
  });

  it('leaves out facts after the cutoff and outside the plan filter', () => {
    const report = calculateProgress(facts({ planVersionId: 'version', sessions: [session('s1', '2026-10-01'), session('s2', '2026-10-03')], scheduledWorkouts: [schedule('o', '2026-10-01', 'other')] }), '2026-10-02');
    expect(report.history.map(row => row.id)).toEqual(['s1']);
    expect(report).toMatchObject({ dueCount: 0, completionRate: null });
  });

  it('refuses invalid dates, clocks and plans without a time zone', () => {
    expect(() => calculateProgress(facts({ from: '2026-10-05' }), '2026-10-04')).toThrow('Invalid progress dates or clock');
    expect(() => calculateProgress(facts({ nowMs: Number.NaN }), '2026-10-04')).toThrow('Invalid progress dates or clock');
    expect(() => calculateProgress(facts(), '2026-02-30')).toThrow('Invalid progress dates or clock');
    expect(() => calculateProgress(facts({ scheduledWorkouts: [schedule('a', '2026-10-01', 'missing')] }), '2026-10-04')).toThrow('Originating plan time zone is missing');
  });
});
