import { describe, expect, it } from 'vitest';
import type { WorkoutRecord } from '../../src/domain/v8/contracts';
import { computeIncompleteTiming, computeExerciseEvidence } from '../../src/application/review/evidence';

const workout = (patch: Partial<WorkoutRecord> = {}): WorkoutRecord => ({
  id: 'w', planVersionId: 'v', startedAt: '2026-10-09T06:00:00Z',
  localDate: '2026-10-09', timeZone: 'UTC', status: 'partial', plannedSetCount: 2,
  sets: [], ...patch,
});
const set = (exerciseId: string, itemIndex = 0, setIndex = 0) => ({
  exerciseId, itemIndex, setIndex, completedAt: '2026-10-09T06:10:00Z',
});

describe('incomplete timing facts (caller supplies the review period)', () => {
  it.each([
    ['04:59:59', 'evening'], ['05:00:00', 'morning'], ['11:59:59', 'morning'],
    ['12:00:00', 'daytime'], ['16:59:59', 'daytime'], ['17:00:00', 'evening'],
    ['00:00:00', 'evening'], ['23:59:59', 'evening'],
  ] as const)('classifies %s as %s', (time, band) => {
    const result = computeIncompleteTiming([workout({ startedAt: `2026-10-09T${time}Z` })]);
    expect(result.weekday[band].partial).toBe(1);
  });
  it('uses each saved timezone and instant, not localDate or the machine timezone', () => {
    const records = [
      workout({ startedAt: '2026-10-09T22:00:00Z', timeZone: 'Asia/Shanghai' }),
      workout({ startedAt: '2026-10-12T01:00:00Z', timeZone: 'America/New_York', status: 'not_started' }),
    ];
    const result = computeIncompleteTiming(records);
    expect(result.weekend.morning.partial).toBe(1);
    expect(result.weekend.evening.notStarted).toBe(1);
    expect(result.weekday.morning.partial).toBe(0);
  });
  it('handles DST using the offset at the recorded instant', () => {
    const result = computeIncompleteTiming([
      workout({ startedAt: '2026-03-08T08:59:00Z', timeZone: 'America/New_York' }),
      workout({ startedAt: '2026-03-08T09:00:00Z', timeZone: 'America/New_York' }),
    ]);
    expect(result.weekend.evening.partial).toBe(1);
    expect(result.weekend.morning.partial).toBe(1);
  });
  it('only counts partial and not_started and returns independent empty buckets', () => {
    const result = computeIncompleteTiming(['complete', 'in_progress', 'abandoned'].map(status => workout({ status: status as WorkoutRecord['status'] })));
    expect(JSON.stringify(result)).not.toMatch(/:1/);
    expect(computeIncompleteTiming([])).toEqual(result);
  });
});

describe('exercise evidence from one workout', () => {
  const plannedExercises = [{ exerciseId: 'squat', itemIndex: 0, plannedSetCount: 2 }];
  const sets = [set('squat', 0, 0), set('squat', 0, 1)];
  it.each(['easy', 'right'] as const)('requires all snapshot sets, including in a partial workout with %s feel', feel => {
    expect(computeExerciseEvidence(workout({ plannedExercises, sets, feedback: { feel, reasons: [] } })).easyCompletedExerciseIds).toEqual(['squat']);
    expect(computeExerciseEvidence(workout({ plannedExercises, sets: sets.slice(0, 1), feedback: { feel, reasons: [] } })).easyCompletedExerciseIds).toEqual([]);
  });
  it('does not infer completion from legacy total count or complete status', () => {
    expect(computeExerciseEvidence(workout({ status: 'complete', sets, feedback: { feel: 'easy', reasons: [] } })).easyCompletedExerciseIds).toEqual([]);
  });
  it('evaluates each exercise independently and does not mutate recorded facts', () => {
    const record = workout({
      plannedExercises: [...plannedExercises, { exerciseId: 'row', itemIndex: 1, plannedSetCount: 2 }],
      sets: [...sets, set('row', 1)], feedback: { feel: 'easy', reasons: [] },
    });
    const original = structuredClone(record);
    expect(computeExerciseEvidence(record).easyCompletedExerciseIds).toEqual(['squat']);
    computeIncompleteTiming([record]);
    expect(record).toEqual(original);
  });
  it('does not treat zero planned sets as completed exercise evidence', () => {
    expect(computeExerciseEvidence(workout({ plannedExercises: [{ ...plannedExercises[0], plannedSetCount: 0 }], feedback: { feel: 'easy', reasons: [] } })).easyCompletedExerciseIds).toEqual([]);
  });
  it('does not combine different item occurrences or duplicate set facts', () => {
    const repeated = [...plannedExercises, { exerciseId: 'squat', itemIndex: 1, plannedSetCount: 1 }];
    expect(computeExerciseEvidence(workout({ plannedExercises: repeated, sets, feedback: { feel: 'easy', reasons: [] } })).easyCompletedExerciseIds).toEqual([]);
    expect(computeExerciseEvidence(workout({ plannedExercises, sets: [sets[0], sets[0]], feedback: { feel: 'right', reasons: [] } })).easyCompletedExerciseIds).toEqual([]);
    expect(computeExerciseEvidence(workout({ plannedExercises: repeated, sets: [...sets, set('squat', 1)], feedback: { feel: 'easy', reasons: [] } })).easyCompletedExerciseIds).toEqual(['squat']);
  });
  it.each(['tired', 'very_tired', undefined] as const)('does not label %s feeling as easy completion', feel => {
    expect(computeExerciseEvidence(workout({ plannedExercises, sets, feedback: { feel, reasons: [] } })).easyCompletedExerciseIds).toEqual([]);
  });
  it('does not count a replacement as completion of the original exercise', () => {
    expect(computeExerciseEvidence(workout({ plannedExercises, sets: [set('bridge'), set('bridge', 0, 1)], feedback: { feel: 'easy', reasons: [] } })).easyCompletedExerciseIds).toEqual([]);
  });
  it('only attributes feedback discomfort to selected exercises actually performed', () => {
    expect(computeExerciseEvidence(workout({ sets, feedback: { reasons: ['discomfort'], discomfortExerciseIds: ['squat', 'squat', 'bridge'] } })).discomfortExerciseIds).toEqual(['squat']);
    expect(computeExerciseEvidence(workout({ sets, feedback: { reasons: ['discomfort'] } })).discomfortExerciseIds).toEqual([]);
    expect(computeExerciseEvidence(workout({ sets, feedback: { reasons: [], discomfortExerciseIds: ['squat'] } })).discomfortExerciseIds).toEqual([]);
  });
  it('counts discomfort substitutions without completed replacement sets and deduplicates selections', () => {
    const substitution = { fromExerciseId: 'squat', toExerciseId: 'bridge', itemIndex: 0, reason: 'discomfort' as const, createdAt: '2026-10-09T06:05:00Z' };
    expect(computeExerciseEvidence(workout({ substitutions: [substitution, substitution] })).discomfortExerciseIds).toEqual(['squat']);
    expect(computeExerciseEvidence(workout({ sets, substitutions: [substitution], feedback: { reasons: ['discomfort'], discomfortExerciseIds: ['squat'] } })).discomfortExerciseIds).toEqual(['squat']);
    expect(computeExerciseEvidence(workout({ substitutions: [{ ...substitution, reason: 'other' }] })).discomfortExerciseIds).toEqual([]);
  });
  it('keeps legacy substitutedFrom alone insufficient for discomfort attribution', () => {
    expect(computeExerciseEvidence(workout({ sets: [{ ...set('bridge'), substitutedFrom: 'squat' }] }))).toEqual({ easyCompletedExerciseIds: [], discomfortExerciseIds: [] });
  });
});
