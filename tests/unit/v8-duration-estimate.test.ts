import { describe, expect, it } from 'vitest';
import { estimateTrainingMinutes, type DurationTarget } from '../../src/application/rules/duration-estimate';

const routine = (actions: number, sets: number, target: DurationTarget) => Array.from({ length: actions }, () => ({ sets: Array.from({ length: sets }, () => ({ ...target })) }));

describe('V8.0.5 shared plan duration estimate', () => {
  it('matches the approved full and short examples', () => {
    expect(estimateTrainingMinutes(routine(5, 3, { reps: 10 }))).toBe(35);
    expect(estimateTrainingMinutes(routine(3, 2, { reps: 10 }))).toBe(15);
  });
  it('uses at least 20 seconds for repetition sets', () => {
    // 20 * 20 + 19 * 90 + 300 = 2410 seconds, rounded up to 45 minutes.
    expect(estimateTrainingMinutes(routine(1, 20, { reps: 1 }))).toBe(45);
  });
  it('uses timed targets and distance at 1.5 metres per second', () => {
    expect(estimateTrainingMinutes(routine(1, 1, { durationSeconds: 900 }))).toBe(20);
    expect(estimateTrainingMinutes(routine(1, 1, { distanceMeters: 1350 }))).toBe(20);
  });
  it('adds rest only between sets and transition only between actions', () => {
    expect(estimateTrainingMinutes(routine(1, 3, { durationSeconds: 300 }))).toBe(25);
    expect(estimateTrainingMinutes(routine(3, 1, { durationSeconds: 300 }))).toBe(25);
    expect(estimateTrainingMinutes(routine(1, 1, { durationSeconds: 600 }))).toBe(15);
    expect(estimateTrainingMinutes(routine(1, 1, { durationSeconds: 601 }))).toBe(20);
  });
  it('preserves different targets within one old exercise and does not mutate them', () => {
    const input = [{ sets: [{ durationSeconds: 300 }, { durationSeconds: 600 }] }];
    const before = structuredClone(input);
    expect(estimateTrainingMinutes(input)).toBe(25);
    expect(input).toEqual(before);
  });
  it('clamps the result and rejects absent or invalid targets', () => {
    expect(estimateTrainingMinutes(routine(1, 1, { reps: 1 }))).toBe(15);
    expect(estimateTrainingMinutes(routine(1, 1, { durationSeconds: 10000 }))).toBe(120);
    expect(() => estimateTrainingMinutes([])).toThrow();
    expect(() => estimateTrainingMinutes([{ sets: [] }])).toThrow();
    for (const reps of [0, -1, NaN, Infinity]) expect(() => estimateTrainingMinutes(routine(1, 1, { reps }))).toThrow();
  });
});
