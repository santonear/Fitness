import { countSatisfaction, mean, intervalSatisfaction } from './math';
import { older, muscles, exposure } from './helpers';
import { type Satisfaction } from './types';
export const targetGroup08: Record<string, Satisfaction> = {
  'aerobic.target.weekly': c => countSatisfaction(c.f.aerobic, c.v.moderate_equiv_min_week),
  'caution.back.keep_active': c =>
    c.p.cautions.includes('back')
      ? mean([
          countSatisfaction(c.f.sessions.length, c.p.daysPerWeek),
          countSatisfaction(c.f.aerobic, c.r.get('goal.aerobic.baseline').aerobic_moderate_equiv_min_week.target),
        ])
      : null,
  'older.week.aerobic': c => older(c, x => countSatisfaction(x.f.aerobic, x.v.moderate_min_week.min)),
  'older.week.strength': c =>
    older(c, x =>
      mean([
        intervalSatisfaction(x.f.rt.length, x.v.days_per_week.min, x.v.days_per_week.max),
        ...muscles(x).map(g => countSatisfaction(exposure(x, g), x.v.days_per_week.min)),
      ]),
    ),
};
