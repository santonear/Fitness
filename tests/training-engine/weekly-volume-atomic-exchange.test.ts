import { assertBoundedDuration } from '../unit/engine/assert-bounded-duration';
import { legacySampledProfile } from './v1-inputs';
import { baseProfile } from '../../tools/eval/training-engine-profiles';
import { expect, it } from 'vitest';
import { validatePlan } from '../../src/engine';
import { generatePlan } from '../../src/engine/pipeline';

import { DATA, Rules } from '../../src/engine/data';
import { checkHard } from '../../src/engine/hard-checks';
import { runGates } from '../../src/engine/gates';
import { scorePlan } from '../../src/engine/score';

it('retains source hard caps on the original coupled-deficit input without requiring a V1 atomic repair proof', () => {
  const legacy = legacySampledProfile(63),
    original = structuredClone(legacy);
  expect(runGates(legacy).status).toBe('blocked');
  expect(generatePlan(legacy).templates).toEqual([]);
  expect(legacy).toEqual(original);
  const profile = baseProfile({ ...structuredClone(legacy), screening: baseProfile().screening }),
    before = structuredClone(profile),
    plan = generatePlan(profile);
  expect(plan.templates).toHaveLength(profile.daysPerWeek);
  expect(plan.templates[0].items.length).toBeGreaterThan(0);
  expect(
    plan.templates.flatMap(t => t.items).filter(i => ['main', 'accessory'].includes(i.prescription?.block ?? ''))
      .length,
  ).toBeGreaterThan(0);
  const issues = validatePlan(plan, profile);
  expect(
    issues.filter(issue =>
      [
        'weekly_volume_floor',
        'weekly_volume_cap',
        'session_volume_cap',
        'excluded_exercise',
        'intensity_cap',
        'isometric_hold_bounds',
      ].includes(issue.code),
    ),
  ).toEqual([]);
  const rows = scorePlan(plan, profile).perRule.filter(row =>
    ['progression.new.weekly_sets', 'dose.sets_week.goal_matrix'].includes(row.id),
  );
  expect(rows.length).toBeGreaterThan(0);
  expect(rows.every(row => row.satisfaction >= 0 && row.satisfaction <= 1)).toBe(true);
  const invalid = structuredClone(plan);
  for (const item of invalid.templates[0].items)
    if (['main', 'accessory'].includes(item.prescription?.block ?? '')) item.sets = 4;
  expect(
    validatePlan(invalid, profile).some(
      issue =>
        issue.severity === 'error' && ['intro_week_volume', 'session_volume_cap', 'intro_dose'].includes(issue.code),
    ),
  ).toBe(true);
  expect(profile).toEqual(before);
});

it('does not add a supplement when the original source exercise cap leaves no slot', () => {
  const data = structuredClone(DATA),
    row = data.rules.find(rule => rule.id === 'progression.new.week_caps')!;
  row.value!.week_1.exercises_per_session[1] = 4;
  const rules = new Rules(data),
    profile = baseProfile({ ...legacySampledProfile(63), screening: baseProfile().screening }),
    plan = generatePlan(profile, { rules });
  expect(plan.templates).toHaveLength(profile.daysPerWeek);
  expect(plan.templates[0].items.length).toBeGreaterThan(0);
  expect(
    plan.templates.flatMap(t => t.items).filter(i => ['main', 'accessory'].includes(i.prescription?.block ?? ''))
      .length,
  ).toBeGreaterThan(0);
  expect(
    plan.templates.every(
      template =>
        template.items.filter(item => ['main', 'accessory'].includes(item.prescription?.block ?? '')).length <= 4,
    ),
  ).toBe(true);
  expect(rules.get('progression.new.week_caps').week_1.exercises_per_session[1]).toBe(4);
  assertBoundedDuration(plan, profile, rules);
  const measured = scorePlan(plan, profile, rules).perRule.find(row => row.id === 'dose.sets_week.goal_matrix');
  expect(measured).toBeDefined();
  expect(measured!.satisfaction).toBeLessThan(1);
});
