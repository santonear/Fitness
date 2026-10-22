import { expect, it } from 'vitest';
import { generatePlan } from '../../../src/engine/pipeline';
import { Rules } from '../../../src/engine/data';
import { effectiveGoalRole, strengthRoles, prescribedRepRange } from '../../../src/engine/dose';
import { runGates } from '../../../src/engine/gates';
import { baseProfile } from '../../../tools/eval/training-engine-profiles';
it('keeps generated strength source roles and their actual dose in agreement', () => {
  const p = baseProfile({
      goal: 'strength',
      level: 'intermediate',
      trainingAgeWeeks: 52,
      daysPerWeek: 3,
      sessionMinutes: 30,
      equipment: ['dumbbell'],
    }),
    r = new Rules(),
    plan = generatePlan(p),
    g = runGates(p, r);
  let checked = 0;
  for (const t of plan.templates) {
    const roles = strengthRoles(t.items, p, r);
    for (const item of t.items) {
      const role = roles.get(item);
      if (!role) continue;
      checked++;
      expect(effectiveGoalRole(item, p, r)).toBe(role);
      const e = r.byExercise.get(item.exerciseId)!,
        range = prescribedRepRange(e, p, r, g.restrictions, role);
      if ('reps' in item.target) {
        expect(item.target.reps).toBeGreaterThanOrEqual(range[0]);
        expect(item.target.reps).toBeLessThanOrEqual(range[1]);
      }
    }
  }
  expect(checked).toBeGreaterThan(0);
});
