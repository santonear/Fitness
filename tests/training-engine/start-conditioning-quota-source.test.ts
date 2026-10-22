import { baseProfile } from '../../tools/eval/training-engine-profiles';
import { legacySampledProfile } from './v1-inputs';
import { beforeAll, expect, it } from 'vitest';
import { generatePlan, validatePlan } from '../../src/engine';
import { Rules } from '../../src/engine/data';
import { scorePlan } from '../../src/engine/score';
import { estimateSeconds } from '../../src/engine/fit';
import { independentElapsedAllocation } from '../unit/engine/reference/training-engine-goal-share';
const frozen = legacySampledProfile(74),
  profile = baseProfile({
    ...frozen,
    screening: { ...frozen.screening, cmrSymptoms: baseProfile().screening.cmrSymptoms },
  }),
  r = new Rules();
let plan: ReturnType<typeof generatePlan>;
beforeAll(() => {
  plan = generatePlan(profile);
});
function moderateMinutes(copy: typeof plan) {
  const intensity = r.get('aerobic.intensity.rpe_scale');
  return copy.templates
    .flatMap(t => t.items)
    .reduce((sum, item) => {
      const e = r.byExercise.get(item.exerciseId),
        rpe = item.prescription?.targetRpe?.[0] ?? 0;
      if (
        item.prescription?.block !== 'conditioning' ||
        e?.modality !== 'cardio' ||
        !('durationSeconds' in item.target)
      )
        return sum;
      const sides = item.prescription.perSide || e.time.per_side ? r.get('session.time.model').per_side_multiplier : 1;
      return (
        sum +
        ((item.sets * item.target.durationSeconds * sides) / 60) *
          (rpe >= intensity.vigorous[0]
            ? r.get('aerobic.target.weekly').vigorous_multiplier
            : rpe >= intensity.moderate[0]
              ? 1
              : 0)
      );
    }, 0);
}
function weeklyScore(copy: typeof plan) {
  return scorePlan(copy, profile, r).perRule.find(row => row.id === 'aerobic.target.weekly')!.satisfaction;
}
it('measures the original start-moving input actual weekly aerobic target without a fixed V1 quota exception', () => {
  expect(profile.sessionMinutes).toBe(90);
  expect(plan.templates).toHaveLength(1);
  expect(validatePlan(plan, profile).filter(issue => issue.severity === 'error')).toEqual([]);
  const actual = moderateMinutes(plan),
    target = r.get('aerobic.target.weekly').moderate_equiv_min_week;
  expect(actual).toBeGreaterThan(0);
  expect(weeklyScore(plan)).toBe(Math.min(1, actual / target));
  const falseDisplay = structuredClone(plan);
  falseDisplay.templates[0].estimatedSeconds = 1;
  falseDisplay.templates[0].estimatedMinutes = 1;
  expect(moderateMinutes(falseDisplay)).toBe(actual);
  expect(weeklyScore(falseDisplay)).toBe(weeklyScore(plan));
});
it('keeps the original 1200-second counterexample measurable instead of restoring a removed allocation hard error', () => {
  const bad = structuredClone(plan),
    conditioning = bad.templates[0].items.find(item => item.prescription?.block === 'conditioning')!;
  expect(conditioning).toBeDefined();
  bad.templates[0].items = bad.templates[0].items.filter(
    i => i.prescription?.block !== 'conditioning' || i === conditioning,
  );
  conditioning.sets = 1;
  conditioning.target = { metricType: 'duration', durationSeconds: 1200 };
  expect(moderateMinutes(bad)).toBe(20);
  expect(weeklyScore(bad)).toBe(20 / r.get('aerobic.target.weekly').moderate_equiv_min_week);
  expect(weeklyScore(bad)).toBeLessThan(1);
  expect(bad.templates[0].targetMinutes).toBe(plan.templates[0].targetMinutes);
  const seconds = independentElapsedAllocation(bad).total,
    target = bad.templates[0].targetMinutes! * 60,
    [lo, hi] = r.get('duration.fit.bounds').duration_band;
  expect(
    validatePlan(bad, profile).some(issue => issue.code === 'duration_tolerance' && issue.severity === 'error'),
  ).toBe(seconds < target * lo || seconds > target * hi);
});
it('counts split 2 by 1800 seconds and single 3600 seconds equally as aerobic work while retaining their real elapsed clocks', () => {
  const single = structuredClone(plan),
    item = single.templates[0].items.find(item => item.prescription?.block === 'conditioning')!;
  single.templates[0].items = single.templates[0].items.filter(
    i => i.prescription?.block !== 'conditioning' || i === item,
  );
  item.sets = 1;
  item.target = { metricType: 'duration', durationSeconds: 3600 };
  const split = structuredClone(single),
    other = split.templates[0].items.find(i => i.exerciseId === item.exerciseId)!;
  other.sets = 2;
  other.target = { metricType: 'duration', durationSeconds: 1800 };
  expect(moderateMinutes(single)).toBe(60);
  expect(moderateMinutes(split)).toBe(60);
  expect(weeklyScore(split)).toBe(weeklyScore(single));
  for (const copy of [single, split])
    expect(estimateSeconds(copy.templates[0], r)).toBe(independentElapsedAllocation(copy).total);
  expect(estimateSeconds(split.templates[0], r)).toBeGreaterThanOrEqual(estimateSeconds(single.templates[0], r));
  expect(validatePlan(split, profile).some(issue => issue.code === 'conditioning_slot_dose')).toBe(false);
});
it('generates the source default continuous cardio as one set rather than accumulating repeated conditioning sets', () => {
  expect(r.get('session.conditioning.slot').default_structure.start_moving).toBe('continuous');
  const items = plan.templates.flatMap(t => t.items).filter(i => i.prescription?.block === 'conditioning');
  expect(items.length).toBeGreaterThan(0);
  for (const item of items) {
    expect(item.sets).toBe(1);
    expect(item.prescription?.structure).toBe('straight');
  }
});
