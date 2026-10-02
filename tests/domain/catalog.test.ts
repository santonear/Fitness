import { describe, expect, it } from 'vitest';
import { searchExercises, getExercise } from '../../src/catalog/catalog-service';
import { parseMetric } from '../../src/domain/units';
import { metadataSchema, plannedExerciseSchema, setMetricsSchema, setRecordSchema } from '../../src/domain/schemas';

describe('exercise catalogue', () => {
  it.each(['strength', 'cardio', 'bodyweight'] as const)('offers usable %s exercises', (category) => {
    const results = searchExercises('', 'en', { category });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((exercise) => exercise.category === category && exercise.steps.en.length > 0 && exercise.steps.zh.length > 0)).toBe(true);
  });
  it('searches both languages and respects equipment filters', () => {
    expect(searchExercises('深蹲', 'en', {}).map((item) => item.name.en)).toContain('Bodyweight squat');
    expect(searchExercises('SQUAT', 'zh', { equipment: 'none' }).map((item) => item.name.zh)).toEqual(['徒手深蹲']);
    expect(searchExercises('squat', 'en', { equipment: 'dumbbell' }).map((item) => item.name.en)).toEqual(['Goblet squat']);
  });
  it('rejects unknown exercise IDs', () => {
    expect(() => getExercise('unknown')).toThrow();
  });
});

describe('metric boundaries', () => {
  it('converts kilograms and kilometres once to canonical integers', () => {
    expect(parseMetric({ metricType: 'reps_load', reps: '8', loadKg: '1.25' })).toEqual({ metricType: 'reps_load', reps: 8, loadGrams: 1250 });
    expect(parseMetric({ metricType: 'duration_distance', durationSeconds: '60', distanceKm: '1.25' })).toEqual({ metricType: 'duration_distance', durationSeconds: 60, distanceMeters: 1250 });
  });
  it('preserves missing optional distance and valid zero load', () => {
    expect(parseMetric({ metricType: 'duration_distance', durationSeconds: 60 })).toEqual({ metricType: 'duration_distance', durationSeconds: 60 });
    expect(parseMetric({ metricType: 'reps_load', reps: 8, loadKg: 0 })).toEqual({ metricType: 'reps_load', reps: 8, loadGrams: 0 });
  });
  it('accepts exact milligram boundary precision despite binary floating point', () => {
    expect(parseMetric({ metricType: 'reps_load', reps: 8, loadKg: '1.001' })).toEqual({ metricType: 'reps_load', reps: 8, loadGrams: 1001 });
  });
  it.each([
    { metricType: 'reps', reps: 1.5 }, { metricType: 'reps', reps: 0 },
    { metricType: 'reps_load', reps: 8, loadKg: -1 },
    { metricType: 'reps_load', reps: 8, loadKg: -0.001 },
    { metricType: 'reps_load', reps: 8, loadKg: '1.0001' },
    { metricType: 'duration', durationSeconds: Infinity },
    { metricType: 'duration', durationSeconds: NaN },
    { metricType: 'duration', durationSeconds: '' },
    { metricType: 'reps', reps: 5, distanceKm: 1 },
    { metricType: 'unknown', reps: 5 },
  ])('rejects invalid form metric %j', (input) => {
    expect(() => parseMetric(input as Parameters<typeof parseMetric>[0])).toThrow();
  });
  it('rejects fractional canonical units and unknown fields', () => {
    expect(setMetricsSchema.safeParse({ metricType: 'reps_load', reps: 8, loadGrams: 1.5 }).success).toBe(false);
    expect(setMetricsSchema.safeParse({ metricType: 'reps', reps: 8, alien: 1 }).success).toBe(false);
  });
});

describe('stored record contracts', () => {
  const entity = {
    id: '76e6310c-9ee6-48bc-a016-100000000001', createdAt: '2026-10-03T00:00:00Z',
    updatedAt: '2026-10-03T00:00:00Z', revision: 0,
  };
  const set = { ...entity, sessionId: entity.id, exerciseInstanceId: entity.id, order: 0, metricType: 'reps', completed: false };
  it('permits an unfinished empty set but rejects completing it', () => {
    expect(setRecordSchema.safeParse(set).success).toBe(true);
    expect(setRecordSchema.safeParse({ ...set, completed: true }).success).toBe(false);
    expect(setRecordSchema.safeParse({ ...set, completed: true, reps: 8 }).success).toBe(true);
    expect(setRecordSchema.safeParse({ ...set, distanceMeters: 10 }).success).toBe(false);
  });
  it('requires an integer global data revision for restore concurrency', () => {
    const metadata = { schemaVersion: 1, localProfileId: entity.id, catalogVersion: 1, revision: 0 };
    expect(metadataSchema.safeParse({ ...metadata, dataRevision: 0 }).success).toBe(true);
    expect(metadataSchema.safeParse(metadata).success).toBe(false);
    expect(metadataSchema.safeParse({ ...metadata, dataRevision: 0.5 }).success).toBe(false);
  });
  it('rejects a well formed but unknown catalogue reference', () => {
    expect(plannedExerciseSchema.safeParse({ exerciseId: entity.id, order: 0, targetSets: [{ metricType: 'reps', reps: 8 }] }).success).toBe(false);
  });
});
