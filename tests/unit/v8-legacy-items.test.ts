import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { legacyItemsToV8 } from '../../src/domain/v8/legacy-items';
import { validateBackupEnvelope } from '../../src/application/backup';
import type { PlannedExercise, SetMetrics } from '../../src/domain/models';

const repsId = 'd16325d9-fc00-4c41-88a1-000000000003';
const item = (targetSets: SetMetrics[]): PlannedExercise => ({ exerciseId: repsId, order: 0, targetSets, notes: 'Retain original instruction', setTimings: targetSets.map(() => ({ durationSeconds: 30, restSeconds: 60 })) });
describe('approved lossless legacy target projection', () => {
  it('groups only adjacent identical targets and preserves their sequence', () => {
    const source = item([8, 8, 10, 8].map(reps => ({ metricType: 'reps', reps })));
    const before = structuredClone(source);
    const result = legacyItemsToV8([source]);
    expect(result.map(row => [row.sets, row.target])).toEqual([[2, { metricType: 'reps', reps: 8 }], [1, { metricType: 'reps', reps: 10 }], [1, { metricType: 'reps', reps: 8 }]]);
    expect(source).toEqual(before);
    if (result[0].target.metricType === 'reps') result[0].target.reps = 99;
    expect(source).toEqual(before);
  });
  it('does not merge distinct exercise entries or change input order', () => {
    const first = item([{ metricType: 'reps', reps: 8 }]);
    const second = { ...item([{ metricType: 'reps', reps: 8 }]), order: 1 };
    expect(legacyItemsToV8([first, second]).map(row => row.sets)).toEqual([1, 1]);
  });
  it('keeps missing distance distinct from zero and treats property order as irrelevant', () => {
    const input: PlannedExercise = { exerciseId: 'd16325d9-fc00-4c41-88a1-000000000002', order: 0, targetSets: [{ metricType: 'duration_distance', durationSeconds: 60 }, { durationSeconds: 60, metricType: 'duration_distance' }, { metricType: 'duration_distance', durationSeconds: 60, distanceMeters: 0 }] };
    expect(legacyItemsToV8([input]).map(row => row.sets)).toEqual([2, 1]);
  });
  it('retains different loads and durations rather than merging by repetition count', () => {
    const strength: PlannedExercise = { exerciseId: 'd16325d9-fc00-4c41-88a1-000000000001', order: 0, targetSets: [1000, 2000, 2000].map(loadGrams => ({ metricType: 'reps_load', reps: 8, loadGrams })) };
    const timed: PlannedExercise = { exerciseId: 'd16325d9-fc00-4c41-88a1-000000000004', order: 1, targetSets: [30, 30, 60].map(durationSeconds => ({ metricType: 'duration', durationSeconds })) };
    expect(legacyItemsToV8([strength, timed]).map(row => [row.sets, row.target])).toEqual([
      [1, { metricType: 'reps_load', reps: 8, loadGrams: 1000 }], [2, { metricType: 'reps_load', reps: 8, loadGrams: 2000 }],
      [2, { metricType: 'duration', durationSeconds: 30 }], [1, { metricType: 'duration', durationSeconds: 60 }],
    ]);
  });
  it('rejects invalid metrics without changing previously visited legacy rows', () => {
    const valid = item([{ metricType: 'reps', reps: 8 }]);
    const invalid = item([{ metricType: 'duration', durationSeconds: 60 }]);
    invalid.setTimings = [{ durationSeconds: 60, restSeconds: 60 }];
    const source = [valid, invalid];
    const before = structuredClone(source);
    expect(() => legacyItemsToV8(source)).toThrow('Legacy exercise metrics');
    expect(source).toEqual(before);
  });
  for (const name of ['v5-plans-weight.json', 'v62-plans-weight.json', 'v71-plans-weight.json', 'v71-coach-plan.json']) {
    it(`preserves every actual exported target and legacy fact: ${name}`, () => {
      const data = validateBackupEnvelope(JSON.parse(readFileSync(new URL(`../fixtures/legacy-backups/${name}`, import.meta.url), 'utf8'))).data;
      const before = structuredClone(data);
      for (const version of data.planVersions) for (const day of version.days) {
        const projected = legacyItemsToV8(day.exercises);
        expect(projected.flatMap(row => Array.from({ length: row.sets }, () => ({ exerciseId: row.exerciseId, target: row.target })))).toEqual(day.exercises.flatMap(row => row.targetSets.map(target => ({ exerciseId: row.exerciseId, target }))));
        expect(legacyItemsToV8(day.exercises)).toEqual(projected);
      }
      expect(data).toEqual(before);
    });
  }
});
