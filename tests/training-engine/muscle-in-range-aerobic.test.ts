import { verifyObservedGoalShares } from './v2-quality-observation';
import { expect, it } from 'vitest';
import { generatePlan, validatePlan } from '../../src/engine';
import { goldenProfiles } from '../../tools/eval/training-engine-profiles';
import { externalIssues } from '../../tools/eval/training-engine-invariants';
import { independentElapsedAllocation } from '../unit/engine/reference/training-engine-goal-share';
import { Rules } from '../../src/engine/data';
it('keeps actual aerobic target shortfall visible even when workout durations already fit', () => {
  const p = goldenProfiles.find(f => f.id === 'gym-intermediate-muscle4x45')!.profile,
    plan = generatePlan(p),
    r = new Rules(),
    allocation = independentElapsedAllocation(plan);
  expect(plan.templates).toHaveLength(4);
  expect(validatePlan(plan, p).filter(i => i.severity === 'error')).toEqual([]);
  expect(externalIssues(plan, p)).toEqual([]);
  const observed = verifyObservedGoalShares(plan, p, r);
  expect(observed.allocation).toEqual(allocation);
  for (const t of plan.templates) {
    expect(t.estimatedSeconds).toBeGreaterThanOrEqual(45 * 60 * 0.9);
    expect(t.estimatedSeconds).toBeLessThanOrEqual(45 * 60 * 1.1);
  }
  expect(plan.quality!.score).toBeGreaterThanOrEqual(0);
  expect(plan.quality!.score).toBeLessThanOrEqual(1);
});
