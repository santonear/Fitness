import { expect, it } from 'vitest';
import { sampledProfiles } from '../../../tools/eval/training-engine-profiles';
import { generatePlan, validatePlan } from '../../../src/engine';
import { Rules } from '../../../src/engine/data';
it('retains a real stage-one balance action on the older mobility day, not a cooldown fallback', () => {
  const p = sampledProfiles(80)[32],
    r = new Rules(),
    plan = generatePlan(p);
  const days = plan.templates.filter(t =>
    t.items.some(i => r.byExercise.get(i.exerciseId)?.primary_pattern === 'balance'),
  ).length;
  expect(days).toBeGreaterThanOrEqual(Math.min(3, p.daysPerWeek));
  expect(validatePlan(plan, p).filter(issue => issue.severity === 'error')).toEqual([]);
});
