import { expect, it } from 'vitest';
import { DATA, Rules } from '../../src/engine/data';
import { generatePlan } from '../../src/engine/pipeline';
import { checkHard } from '../../src/engine/hard-checks';
import { runGates } from '../../src/engine/gates';
import { goldenProfiles } from '../../tools/eval/training-engine-profiles';
import { externalIssues } from '../../tools/eval/training-engine-invariants';

it('uses the authored V2 allocation formula without retry proofs or additional user days', () => {
  const profile = goldenProfiles.find(f => f.id === 'bands-fat-loss3x45')!.profile,
    before = structuredClone(profile),
    r = new Rules(),
    frequency = r.get('goal.params.fat_loss').rt_sessions_week;
  expect(frequency).toEqual({ min: 2, default: 3, max: 4 });
  const forced = structuredClone(DATA),
    goal = forced.rules.find(rule => rule.id === 'goal.params.fat_loss')!;
  goal.value!.rt_sessions_week = { min: frequency.default, default: frequency.default, max: frequency.default };
  const forcedRules = new Rules(forced),
    defaultOnly = generatePlan(profile, { rules: forcedRules });
  expect(checkHard(defaultOnly, profile, runGates(profile, forcedRules), forcedRules)).toEqual([]);
  const plan = generatePlan(profile, { rules: r });
  expect(plan.templates).toHaveLength(profile.daysPerWeek);
  const rt = plan.templates.filter(t =>
    t.items.some(
      i =>
        i.prescription?.block === 'main' &&
        ['strength', 'isometric'].includes(r.byExercise.get(i.exerciseId)!.modality),
    ),
  );
  expect(rt).toHaveLength(Math.min(profile.daysPerWeek, frequency.max));
  expect(checkHard(plan, profile, runGates(profile, r), r)).toEqual([]);
  expect(externalIssues(plan, profile)).toEqual([]);
  expect(profile).toEqual(before);
  const allocation = plan.trace.find(
    t => t.ruleId === 'week.days.allocation' && t.reason === 'source_rotation_and_goal_allocation',
  );
  expect(allocation?.details?.rtDays).toBe(Math.min(profile.daysPerWeek, frequency.default));
});
