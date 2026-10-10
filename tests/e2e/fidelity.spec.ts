import { test, expect } from '@playwright/test';
test.use({ locale: 'en-US' });
// Preserve the real IndexedDB contract after retiring the legacy presentation.
test.beforeEach(async({page})=>{await page.goto("/tests/e2e/helpers/capacity-entry.html");});
test('rename rejects stale revisions and ongoing active edits without partial writes', async ({ page }) => {
  await page.goto('/tests/e2e/helpers/capacity-entry.html');
  const result = await page.evaluate(async () => {
    const profilePath='/src/application/profile.ts';await (await import(/* @vite-ignore */ profilePath)).profileService.initialize('en');
    const { planService } = await import(String('/src/application/plans.ts'));
    const { workoutService } = await import(String('/src/application/workouts.ts'));
    const { database } = await import(String('/src/persistence/db.ts'));
    const plan = await planService.savePlan({ name: 'Original', source: 'manual', startDate: '2026-10-05', scheduleTimeZone: 'UTC', goalSnapshot: { goal: '' }, durationWeeks: 1, daysPerWeek: 1, days: [{ dayId: crypto.randomUUID(), weekIndex: 1, dayOfWeek: 1, exercises: [{ exerciseId: 'd16325d9-fc00-4c41-88a1-000000000003', order: 0, targetSets: [{ metricType: 'reps', reps: 10 }] }] }] });
    const before = JSON.stringify(await Promise.all(database.tables.filter((table:{name:string})=>table.name!=='coachDevice').map((table: { toArray: () => Promise<unknown[]> }) => table.toArray())));
    const stale = await planService.renamePlan(plan.id, 'Stale', plan.revision + 1).then(() => 'accepted', (e: { code: string }) => e.code);
    const invalid = await planService.renamePlan(plan.id, '', plan.revision).then(() => 'accepted', (e: { code: string }) => e.code);
    const unchanged = before === JSON.stringify(await Promise.all(database.tables.filter((table:{name:string})=>table.name!=='coachDevice').map((table: { toArray: () => Promise<unknown[]> }) => table.toArray())));
    await workoutService.startWorkout({ sessionId: crypto.randomUUID(), localDate: '2026-10-03', timeZone: 'UTC', exerciseIds: ['d16325d9-fc00-4c41-88a1-000000000003'] });
    const ongoing = await planService.renamePlan(plan.id, 'Blocked', plan.revision).then(() => 'accepted', (e: { code: string }) => e.code);
    return { stale, invalid, unchanged, ongoing, name: (await database.plans.get(plan.id)).name };
  });
  expect(result).toEqual({ stale: 'CONFLICT', invalid: 'INVALID', unchanged: true, ongoing: 'WORKOUT_IN_PROGRESS', name: 'Original' });
});
