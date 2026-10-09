import { describe, expect, it, vi } from 'vitest';
import { legacyPlanMinutes, legacyTemplateMinutes } from '../../src/domain/v8/legacy-duration';

describe('approved legacy duration normalization', () => {
  it('retains valid actual durations, including the exact boundaries, without estimating', () => {
    const estimate = vi.fn(() => 99);
    for (const minutes of [15, 25, 45, 120]) expect(legacyTemplateMinutes(minutes, estimate)).toEqual({ minutes, estimated: false });
    expect(estimate).not.toHaveBeenCalled();
  });
  it('estimates missing, zero, malformed and out-of-range durations, preserving the original input', () => {
    for (const raw of [undefined, null, 0, -1, '30', {}, NaN, Infinity, 14, 121]) {
      const source = { durationMinutes: raw };
      const before = structuredClone(source);
      const estimate = vi.fn(() => 42);
      expect(legacyTemplateMinutes(source.durationMinutes, estimate)).toEqual({ minutes: 42, estimated: true });
      expect(estimate).toHaveBeenCalledTimes(1);
      expect(source).toEqual(before);
    }
  });
  it('clamps estimated durations to 15–120 minutes and rejects unavailable estimates', () => {
    expect(legacyTemplateMinutes(undefined, () => 5)).toEqual({ minutes: 15, estimated: true });
    expect(legacyTemplateMinutes(undefined, () => 300)).toEqual({ minutes: 120, estimated: true });
    for (const value of [NaN, Infinity, -Infinity]) expect(() => legacyTemplateMinutes(undefined, () => value)).toThrow('Duration estimation must be finite');
  });
  it('keeps legal onboarding slots before the template median', () => {
    for (const slot of [30, 40, 50, 60, 70, 80, 90, 100, 110, 120]) expect(legacyPlanMinutes(slot, [15, 25])).toBe(slot);
  });
  it('uses the median for absent and invalid slots without changing template ordering', () => {
    const durations = [90, 15, 30];
    for (const slot of [undefined, null, 0, '30', 15, 25, 121]) expect(legacyPlanMinutes(slot, durations)).toBe(30);
    expect(legacyPlanMinutes(undefined, [40, 15, 25, 60])).toBe(33);
    expect(durations).toEqual([90, 15, 30]);
  });
  it('never invents a median without valid templates', () => {
    expect(() => legacyPlanMinutes(undefined, [])).toThrow('valid template durations');
    expect(() => legacyPlanMinutes(undefined, [0, 60])).toThrow('valid template durations');
  });
  it('rounds legacy fractional minutes before deciding whether estimation is needed', () => {
    const estimate = vi.fn(() => 40);
    expect(legacyTemplateMinutes(14.5, estimate)).toEqual({ minutes: 15, estimated: false });
    expect(legacyTemplateMinutes(120.4, estimate)).toEqual({ minutes: 120, estimated: false });
    expect(legacyTemplateMinutes(120.5, estimate)).toEqual({ minutes: 40, estimated: true });
    expect(estimate).toHaveBeenCalledTimes(1);
  });
});
