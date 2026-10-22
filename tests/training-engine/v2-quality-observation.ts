import { expect } from 'vitest';
import type { EnginePlan, EngineProfile } from '../../src/engine/contracts';
import { Rules } from '../../src/engine/data';
import { scorePlan } from '../../src/engine/score';
import { independentElapsedAllocation } from '../unit/engine/reference/training-engine-goal-share';
/** V2 keeps actual share deviations observable; these targets are not admission gates. */
export function verifyObservedGoalShares(plan: EnginePlan, p: EngineProfile, r = new Rules()) {
  const allocation = independentElapsedAllocation(plan),
    id = `goal.params.${p.goal}`,
    rule = r.byId.get(id)!,
    row = scorePlan(plan, p, r).perRule.find(row => row.id === id);
  expect(rule.severity).toBe('target');
  expect(row).toBeDefined();
  expect(allocation.total).toBeGreaterThan(0);
  const deviations = Object.entries(rule.value!.time_share).filter(([category, bounds]) => {
    const [low, high] = bounds as number[],
      actual = allocation[category as 'resistance' | 'aerobic' | 'mobility'] / allocation.total;
    return actual < low || actual > high;
  });
  if (deviations.length) expect(row!.satisfaction).toBeLessThan(1);
  const falseDisplay = structuredClone(plan);
  for (const t of falseDisplay.templates) {
    t.estimatedMinutes = 9999;
    t.estimatedSeconds = 999999;
  }
  expect(independentElapsedAllocation(falseDisplay)).toEqual(allocation);
  expect(scorePlan(falseDisplay, p, r).perRule.find(row => row.id === id)).toEqual(row);
  return { allocation, deviations, row: row! };
}
