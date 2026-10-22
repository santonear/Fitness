import { expect, it } from 'vitest';
import { aggregateTaskCosts } from '../../src/ui/admin/finance/TaskCostChart';
import { configReview, canDismissBudget } from '../../src/ui/admin/finance/config-review';
it('preserves task totals across days without merging different tasks', () => {
  expect(
    aggregateTaskCosts([
      { task: 'generate', settledFen: 10, pendingFen: 0 },
      { task: 'review', settledFen: 0, pendingFen: 20 },
      { task: 'generate', settledFen: 30, pendingFen: 40 },
    ]),
  ).toEqual([
    { task: 'generate', settledFen: 40, pendingFen: 40 },
    { task: 'review', settledFen: 0, pendingFen: 20 },
  ]);
});
it('restore confirmation includes both added and removed optional quotas', () => {
  const before = {
      quotaUnderstand: 1,
      quotaGenerate: 1,
      monthlyBudgetFen: 3000,
      reservationFen: 300,
      maxConcurrent: 1,
      retentionDays: 30,
    },
    after = { ...before, quotaSummary: 3 };
  expect(configReview(before, after)).toContainEqual({ field: 'quotaSummary', before: undefined, after: 3 });
  expect(configReview(after, before)).toContainEqual({ field: 'quotaSummary', before: 3, after: undefined });
});
it('only current undismissed 50 percent reminder has a dismissal affordance', () => {
  expect(canDismissBudget(40, 10, 100, false)).toBe(true);
  expect(canDismissBudget(50, 0, 100, true)).toBe(false);
  expect(canDismissBudget(80, 0, 100, false)).toBe(false);
  expect(canDismissBudget(100, 0, 100, false)).toBe(false);
  expect(canDismissBudget(1, 0, 0, false)).toBe(false);
});
