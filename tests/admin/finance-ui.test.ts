import { expect, it } from 'vitest';
import { aggregateTaskCosts } from '../../src/ui/admin/finance/TaskCostChart';
import { configReview, canDismissBudget } from '../../src/ui/admin/finance/config-review';
import { recentUsage } from '../../src/ui/admin/finance/AssistantUsagePage';
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
it('today usage covers 7 local days across a month end with counts and estimated cost only', () => {
  const row = (day: string, user: string, fen: number | null) => ({
    day,
    subject_short_id: user,
    estimated_fen: fen,
  });
  const usage = recentUsage(
    [
      row('2026-11-02', 'aaaaaaaa', 12),
      row('2026-11-02', 'aaaaaaaa', null),
      row('2026-11-02', 'bbbbbbbb', 3),
      row('2026-10-28', 'aaaaaaaa', 5),
      row('2026-10-26', 'aaaaaaaa', 99),
    ],
    '2026-11-02',
  );
  expect(usage.days.map(d => d.day)).toEqual([
    '2026-10-27',
    '2026-10-28',
    '2026-10-29',
    '2026-10-30',
    '2026-10-31',
    '2026-11-01',
    '2026-11-02',
  ]);
  expect(usage.today).toEqual({ day: '2026-11-02', calls: 3, fen: 15, unknown: true, users: 2 });
  expect(usage.days[1]).toMatchObject({ calls: 1, fen: 5, unknown: false });
  expect(usage.empty).toBe(false);
  expect(recentUsage([row('2026-10-01', 'aaaaaaaa', 1)], '2026-11-02').empty).toBe(true);
});
