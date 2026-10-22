import { expect, it } from 'vitest';
import { generatePlan, validatePlan } from '../../src/engine';
import { sampledProfiles } from '../../tools/eval/training-engine-profiles';
import { externalIssues } from '../../tools/eval/training-engine-invariants';
import { effectiveGoalRole } from '../../src/engine/dose';
import { Rules } from '../../src/engine/data';
it('preserves the actual auxiliary role and dose when replacing a source main-container exercise', () => {
  const p = sampledProfiles()[15],
    before = structuredClone(p),
    r = new Rules(),
    plan = generatePlan(p);
  expect(p.goal).toBe('strength');
  expect(externalIssues(plan, p).filter(i => i.code === 'external_strength_role')).toEqual([]);
  expect(
    validatePlan(plan, p).filter(i => ['strength_main_count', 'strength_accessory_reps'].includes(i.code)),
  ).toEqual([]);
  const auxiliary = plan.templates
    .flatMap(t => t.items)
    .filter(i => i.prescription?.block === 'main' && effectiveGoalRole(i, p, r) === 'accessory');
  expect(auxiliary.length).toBeGreaterThan(0);
  for (const i of auxiliary)
    if ('reps' in i.target) {
      expect(i.target.reps).toBeGreaterThanOrEqual(8);
      expect(i.target.reps).toBeLessThanOrEqual(12);
    }
  expect(p).toEqual(before);
});
