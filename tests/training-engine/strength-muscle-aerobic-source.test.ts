import { runGates } from '../../src/engine/gates';
import { assertBoundedDuration } from '../unit/engine/assert-bounded-duration';
import { verifyObservedGoalShares } from './v2-quality-observation';
import { scorePlan } from '../../src/engine/score';
import { expect, it } from 'vitest';
import { generatePlan, validatePlan } from '../../src/engine';
import { sampledProfiles } from '../../tools/eval/training-engine-profiles';
import { externalIssues } from '../../tools/eval/training-engine-invariants';
import { Rules } from '../../src/engine/data';
import { actualWarmupSeconds, blockSeconds, weeklyElapsedAllocation } from '../../src/engine/fit/elapsed-time';

it('measures actual muscle aerobic share and warmup/cooldown targets without requiring V1 fixed allocations', () => {
  const profile = sampledProfiles()[5],
    before = structuredClone(profile),
    plan = generatePlan(profile),
    rules = new Rules();
  expect(validatePlan(plan, profile).filter(issue => issue.severity === 'error')).toEqual([]);
  expect(externalIssues(plan, profile).filter(issue => issue.severity === 'error')).toEqual([]);
  expect(plan.quality?.issues.filter(issue => issue.severity === 'error')).toEqual([]);
  assertBoundedDuration(plan, profile, rules);
  expect(plan.gates.some(g => g.status === 'blocked')).toBe(false);
  const allocation = weeklyElapsedAllocation(plan.templates, rules),
    range = rules.get('goal.params.muscle').time_share.aerobic;
  expect(range).toHaveLength(2);
  verifyObservedGoalShares(plan, profile, rules);
  if (allocation.aerobic === 0)
    expect(
      scorePlan(plan, profile, rules).perRule.find(row => row.id === 'goal.params.muscle')!.satisfaction,
    ).toBeLessThan(1);
  // Explicit stripped counterexample: the reviewed ramp now supplies these blocks in the generated plan.
  const missing = structuredClone(plan.templates[0]);
  missing.items = missing.items.filter(item => !['cooldown', 'conditioning'].includes(item.prescription?.block ?? ''));
  expect(missing.items.some(item => item.prescription?.block === 'cooldown')).toBe(false);
  expect(
    missing.items.some(
      item => item.prescription?.block === 'conditioning' || item.prescription?.structure === 'circuit',
    ),
  ).toBe(false);
  expect(rules.byId.get('session.cooldown.stretch')?.severity).toBe('target');
  expect(rules.byId.get('session.cooldown.stretch')?.type).toBe('default');
  expect(
    scorePlan({ ...plan, templates: [missing] }, profile, rules).perRule.find(
      row => row.id === 'session.cooldown.stretch',
    )!.satisfaction,
  ).toBeLessThan(1);
  expect(profile).toEqual(before);
});

it('counts a real generated aerobic cooldown, keeps phase order, and loses safety credit when stripped', () => {
  const profile = sampledProfiles()[9],
    before = structuredClone(profile),
    plan = generatePlan(profile),
    rules = new Rules(),
    day = plan.templates[2];
  assertBoundedDuration(plan, profile, rules);
  const cardio = day.items.filter(
      item =>
        item.prescription?.block === 'conditioning' && rules.byExercise.get(item.exerciseId)?.modality === 'cardio',
    ),
    cooldownIndex = day.items.findIndex(item => item.prescription?.block === 'cooldown');
  expect(cardio.length).toBeGreaterThan(0);
  expect(cooldownIndex).toBeGreaterThanOrEqual(0);
  expect(day.items.every((item, index) => item.prescription?.block !== 'conditioning' || index < cooldownIndex)).toBe(
    true,
  );
  for (const item of cardio) {
    const e = rules.byExercise.get(item.exerciseId)!,
      source = rules.get('duration.cardio.cap'),
      light = rules.get('aerobic.intensity.rpe_scale').light_max;
    const low =
      source.explicit_low_intensity_slugs.includes(e.slug) ||
      (e.flags.includes(source.low_intensity.required_flag) && e.impact === source.low_intensity.impact);
    const allowed = low
      ? [[light, light], rules.get('session.conditioning.slot').continuous_intensity.rpe]
      : [rules.get('session.conditioning.slot').continuous_intensity.rpe];
    expect(
      allowed.map(range => range.map((value: number) => Math.min(value, runGates(profile, rules).restrictions.maxRpe))),
    ).toContainEqual(item.prescription?.targetRpe);
  }
  expect(
    cardio.some(
      item => (item.prescription?.targetRpe?.[1] ?? 0) >= rules.get('aerobic.intensity.rpe_scale').moderate[0],
    ),
  ).toBe(true);
  expect(actualWarmupSeconds(day, profile, rules)).toBeGreaterThan(0);
  expect(blockSeconds(day, 'cooldown', rules)).toBeGreaterThan(0);
  const safety = rules.byId.get('safety.session.warmup_cooldown')!;
  expect(safety.severity).toBe('target');
  expect(safety.value!.cooldown_min_minutes).toBe(5);
  const stripped = structuredClone(plan);
  stripped.templates[2].items = stripped.templates[2].items.filter(
    item => !['warmup', 'cooldown'].includes(item.prescription?.block ?? ''),
  );
  const score = (value: typeof plan) =>
    scorePlan(value, profile, rules).perRule.find(row => row.id === 'safety.session.warmup_cooldown')!.satisfaction;
  expect(score(stripped)).toBeLessThan(score(plan));
  expect(profile).toEqual(before);
});

it('retains frequency and carry deficits in target scoring without restoring obsolete hard errors', () => {
  const profile = sampledProfiles()[15],
    plan = generatePlan(profile),
    issues = validatePlan(plan, profile).filter(issue => issue.severity === 'error');
  expect(issues.some(issue => ['goal_frequency_min', 'carry_ground_gap'].includes(issue.code))).toBe(false);
  const rules = new Rules();
  expect(rules.byId.get('goal.params.' + profile.goal)?.severity).toBe('target');
  verifyObservedGoalShares(plan, profile, rules);
  expect(
    scorePlan(plan, profile, rules).perRule.find(row => row.id === 'goal.params.' + profile.goal)!.satisfaction,
  ).toBeLessThan(1);
});
