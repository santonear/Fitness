import { describe, expect, it } from 'vitest';
import { adjustGuidedNumber } from '../../src/ui/components/guided/GuidedOnboarding';
import { GuidedMeasurements, measurementDelta, measurementUnit } from '../../src/ui/components/guided/GuidedMeasurements';
import { formatGuidedTargets, ProgramDashboard } from '../../src/ui/components/guided/ProgramDashboard';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { validNumber, numbers, valuesOf } from '../../src/ui/components/guided/onboarding-content';

describe('guided numeric input', () => {
  it('keeps exact typed measurements and missing answers distinct from defaults', () => {
    expect(validNumber('70.2', numbers.weightKg!)).toBe(true);
    expect(validNumber('', numbers.weightKg!)).toBe(false);
    expect(validNumber(301, numbers.weightKg!)).toBe(false);
    expect(validNumber('30.5', numbers.age!)).toBe(false);
    expect(valuesOf({ status: 'skipped' })).toEqual([]);
    expect(valuesOf({ status: 'answered', value: '没有已知限制' })).toEqual(['没有已知限制']);
  });
  it('keeps numeric scrolling within measurement boundaries', () => {
    expect(adjustGuidedNumber(18, -1, 18, 110, 1)).toBe(18);
    expect(adjustGuidedNumber(110, 1, 18, 110, 1)).toBe(110);
    expect(adjustGuidedNumber(70, -1, 30, 300, .5)).toBe(69.5);
    expect(adjustGuidedNumber(69.5, 1, 30, 300, .5)).toBe(70);
  });
  it('does not accumulate floating point error during fractional adjustments', () => {
    let value = 20;
    for (let index = 0; index < 7; index++) value = adjustGuidedNumber(value, 1, 3, 65, .1);
    expect(value).toBe(20.7);
  });
});

describe('measurement display', () => {
  it('does not ask for weight source data which the weight service cannot preserve', () => {
    const html = renderToStaticMarkup(createElement(GuidedMeasurements, { locale: 'zh', onSave: () => {}, observations: [] }));
    expect(html).not.toContain('测量方法或来源');
    expect(html).toContain('尚未记录');
  });
  it('keeps units distinct and never computes a delta between different metrics', () => {
    expect(measurementUnit('weight')).toBe('kg');
    expect(measurementUnit('waist')).toBe('cm');
    expect(measurementUnit('bodyFat')).toBe('%');
    const current = { id: 'one', kind: 'bodyFat' as const, value: 20.2, date: '2026-10-07', method: 'scale' };
    expect(measurementDelta(current, { ...current, id: 'two', value: 20.5 })).toBe(-.3);
    expect(measurementDelta(current, { ...current, kind: 'weight' })).toBeNull();
  });
});

describe('plan display', () => {
  it('keeps per-set units and unspecified distance explicit', () => {
    expect(formatGuidedTargets([{ metricType: 'reps_load', reps: 8, loadGrams: 5000 }, { metricType: 'duration_distance', durationSeconds: 600 }], 'zh')).toEqual(['第1组 · 8 次 · 5 kg', '第2组 · 600 s · 距离未设置']);
  });
  it('labels a candidate without claiming there is no current plan', () => {
    const html = renderToStaticMarkup(createElement(ProgramDashboard, { locale: 'zh', title: '候选计划', status: 'candidate', elapsedDays: 0, totalDays: 7, completedWorkouts: 0, plannedWorkouts: 3, todayLabel: '尚未生效' }));
    expect(html).toContain('候选，尚未生效');
    expect(html).not.toContain('尚无当前计划');
  });
});
