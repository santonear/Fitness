import { describe, expect, it } from 'vitest';
import { computeWeekFacts, computeMonthFacts } from '../../src/application/review/compute';
import type { ReviewInput } from '../../src/application/review/contracts';
import type { WorkoutRecord } from '../../src/domain/v8/contracts';

const row = (id: string, status: WorkoutRecord['status'], date = '2026-10-06', patch: Partial<WorkoutRecord> = {}): WorkoutRecord => ({
  id, status, planVersionId: 'original-plan', startedAt: `${date}T06:00:00Z`, endedAt: `${date}T06:30:00Z`,
  localDate: date, timeZone: 'Asia/Shanghai', plannedSetCount: 3, sets: [], ...patch,
});
const input = (workouts: WorkoutRecord[] = []): ReviewInput => ({ from: '2026-10-05', to: '2026-10-11', timeZone: 'Asia/Shanghai', weeklyTarget: 3, workouts, activities: [], bodyWeights: [] });
const metric = (reps: number) => ({ exerciseId: 'squat', itemIndex: 0, setIndex: 0, reps, completedAt: '2026-10-06T06:00:00Z' });
describe('V8 review facts', () => {
  it('counts complete and partial separately; zero sets, active and abandoned do not count movement', () => {
    const result = computeWeekFacts(input(['complete', 'partial', 'not_started', 'in_progress', 'abandoned'].map((status, index) => row(String(index), status as WorkoutRecord['status']))));
    expect(result).toMatchObject({ complete: 1, partial: 1, notStarted: 1, movementCount: 2, missingCount: 2, trainingSeconds: 3600 });
  });
  it('uses user timezone Monday boundaries and the previous week for comparison', () => {
    const result = computeWeekFacts(input([row('before', 'complete', '2026-10-04', { startedAt: '2026-10-04T15:59:59Z' }),
      row('after', 'complete', '2026-10-04', { startedAt: '2026-10-04T16:00:00Z' })]));
    expect(result).toMatchObject({ complete: 1, previousMovementCount: 1 });
  });
  it('counts activities independently without filling the plan target', () => {
    const data = input();
    data.activities = [{ id: 'walk', type: 'walk', minutes: 35, localDate: '2026-10-06', timeZone: 'Asia/Shanghai', createdAt: '2026-10-06T00:00:00Z' }];
    expect(computeWeekFacts(data)).toMatchObject({ movementCount: 1, complete: 0, missingCount: 3, activityMinutes: 35, activityCounts: { walk: 1 } });
  });
  it('compares actual same-exercise maxima; zero-set records cannot manufacture improvements', () => {
    const result = computeWeekFacts(input([row('previous', 'complete', '2026-10-01', { sets: [metric(8)] }),
      row('current', 'partial', '2026-10-06', { sets: [metric(10)] }), row('zero', 'not_started', '2026-10-07', { sets: [metric(100)] })]));
    expect(result.improvements).toEqual([{ exerciseId: 'squat', metric: 'reps', previous: 8, current: 10 }]);
  });
  it('keeps counts but excludes negative and over-12-hour elapsed time; includes exactly 12 hours', () => {
    expect(computeWeekFacts(input([row('negative', 'complete', undefined, { endedAt: '2026-10-06T05:59:00Z' }),
      row('long', 'partial', undefined, { endedAt: '2026-10-06T18:00:01Z' }), row('boundary', 'complete', undefined, { endedAt: '2026-10-06T18:00:00Z' })])))
      .toMatchObject({ movementCount: 3, trainingSeconds: 43200 });
  });
  it('includes legacy evidence without inventing feedback and deduplicates overlapping identities', () => {
    const data = input([row('same', 'complete')]);
    data.legacyWorkouts = [{ ...row('same', 'partial'), source: 'legacy', sets: [] }, { ...row('old', 'partial'), source: 'legacy', sets: [] }];
    expect(computeWeekFacts(data)).toMatchObject({ complete: 1, partial: 1, movementCount: 2, reasonCounts: { discomfort: 0 } });
  });
  it('does not count free training toward the plan target', () => {
    expect(computeWeekFacts(input([row('free', 'complete', undefined, { planVersionId: undefined })])))
      .toMatchObject({ complete: 0, movementCount: 0, missingCount: 3, trainingSeconds: 1800 });
  });
  it('counts two-week incomplete reasons once per record and local weekday bands', () => {
    const result = computeWeekFacts(input([row('last', 'partial', '2026-10-01', { feedback: { reasons: ['time', 'time'] } }),
      row('now', 'not_started', '2026-10-10', { feedback: { reasons: ['time'] } }), row('complete', 'complete', '2026-10-10', { feedback: { reasons: ['time'] } })]));
    expect(result.reasonCounts.time).toBe(2);
    expect(result.incompleteTiming.weekday.daytime.partial).toBe(1);
    expect(result.incompleteTiming.weekend.daytime.notStarted).toBe(1);
  });
  it('does not mutate inputs and detects only in-range body weight', () => {
    const data = input(); data.bodyWeights = [{ localDate: '2026-10-01', weightGrams: 70000 }];
    const before = structuredClone(data); expect(computeWeekFacts(data).hasBodyWeight).toBe(false); expect(data).toEqual(before);
    data.bodyWeights = [{ localDate: '2026-10-05', weightGrams: 70000 }]; expect(computeWeekFacts(data).hasBodyWeight).toBe(true);
  });
  it('groups calendar month records into Monday weeks without leaking neighboring months', () => {
    const data = { ...input([row('outside', 'complete', '2026-09-30'), row('first', 'complete', '2026-10-01'), row('last', 'partial', '2026-10-31')]), from: '2026-10-01', to: '2026-10-31' };
    const result = computeMonthFacts(data);
    expect(result.complete).toBe(1); expect(result.partial).toBe(1); expect(result.weeks).toHaveLength(5);
    expect(result.weeks[0]).toEqual({ from: '2026-09-28', complete: 1, partial: 0 });
    expect(result.weeks[4]).toEqual({ from: '2026-10-26', complete: 0, partial: 1 });
  });
  it('rejects impossible dates and invalid targets', () => {
    expect(() => computeWeekFacts({ ...input(), from: '2026-02-30' })).toThrow();
    expect(() => computeWeekFacts({ ...input(), weeklyTarget: 0 })).toThrow();
  });
});
