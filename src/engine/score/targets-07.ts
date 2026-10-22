import { direct, resistance, weekly } from './helpers';
import { intervalSatisfaction, mean } from './math';
import { newWeek, volumeLimits } from '../dose';
import { type Satisfaction } from './types';
export const targetGroup07: Record<string, Satisfaction> = {
  'balance.week.hinge_knee': c => {
    const knee = direct(c, ['squat', 'lunge']);
    return knee ? intervalSatisfaction(direct(c, ['hinge']) / knee, c.v.min, c.v.max) : null;
  },
  'balance.week.core_three': c => {
    if (!resistance(c)) return null;
    const v = c.f.rt.length >= 3 ? c.v.rt_days_min_3 : c.v.rt_days_1_2;
    return mean([
      ...(v.required_each ?? v.required ?? []).map((p: string) => Number(c.f.patterns.has(p))),
      ...(v.required_one_of ? [Number(v.required_one_of.some((p: string) => c.f.patterns.has(p)))] : []),
    ]);
  },
  'variety.rotation': () => null,
  'progression.new.weekly_sets': c =>
    newWeek(c.p, c.r) && resistance(c) ? weekly(c, volumeLimits(c.p, c.r).min, volumeLimits(c.p, c.r).max) : null,
};
