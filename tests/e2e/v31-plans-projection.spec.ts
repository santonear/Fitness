import { expect, test, type Page } from '@playwright/test';

async function seed(page: Page, ambiguous = false, future = false) {
  await page.goto('/plans');
  return page.evaluate(async ({ ambiguous, future }) => {
    const p = '/src/application/profile.ts'; const { profileService } = await import(/* @vite-ignore */ p);
    const d = '/src/application/progress.ts'; const { dateInZone } = await import(/* @vite-ignore */ d);
    const s = '/src/application/plans.ts'; const { planService } = await import(/* @vite-ignore */ s);
    const g = '/src/application/guided.ts'; const { guidedService } = await import(/* @vite-ignore */ g);
    const b = '/src/persistence/db.ts'; const { database } = await import(/* @vite-ignore */ b);
    const sourceZone = ambiguous ? 'Etc/GMT-12' : 'Pacific/Kiritimati'; const calendarZone = ambiguous ? 'UTC' : 'Pacific/Honolulu';
    let profile = await profileService.initialize('en');
    profile = await profileService.saveProfile({ locale: 'en', units: 'metric', timeZone: sourceZone }, profile.revision);
    const today = dateInZone(Date.now(), calendarZone); const value = new Date(`${today}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + (future ? 1 : 0)); const shown = value.toISOString().slice(0, 10); value.setUTCDate(value.getUTCDate() + (ambiguous ? 0 : 1)); const sourceDate = value.toISOString().slice(0, 10);
    const plan = await planService.savePlan({ name: 'Source-zone workout', source: 'manual', startDate: sourceDate, scheduleTimeZone: sourceZone, goalSnapshot: { goal: '' }, durationWeeks: 1, daysPerWeek: 1, days: [{ dayId: crypto.randomUUID(), weekIndex: 1, dayOfWeek: (value.getUTCDay() + 6) % 7 + 1, exercises: [{ exerciseId: 'd16325d9-fc00-4c41-88a1-000000000003', order: 0, targetSets: [{ metricType: 'reps', reps: 10 }] }] }] });
    const task = await database.scheduledWorkouts.where('planVersionId').equals(plan.currentVersionId).first();
    await guidedService.rescheduleTime(task.id, '12:00', task.revision, (await guidedService.read()).revision, 0, 30);
    await profileService.saveProfile({ locale: 'en', units: 'metric', timeZone: calendarZone }, profile.revision);
    return { taskId: task.id, sourceDate, shown, sourceZone, calendarZone };
  }, { ambiguous, future });
}

test('cross-zone occupancy, detail and Today use the same projected date without rewriting source time', async ({ page }) => {
  const seeded = await seed(page);
  await page.goto(`/plans?date=${seeded.shown}`);
  const calendar = page.getByRole('tabpanel', { name: 'Calendar', exact: true });
  await expect(calendar.locator(`[data-plan-date="${seeded.shown}"]`)).toHaveClass(/occupied/);
  await expect(calendar.locator('.v31-calendar-side')).toContainText('Source-zone workout');
  await expect(calendar.locator('.v31-calendar-side')).toContainText(seeded.sourceZone);
  await calendar.getByRole('button', { name: 'View month / day timeline and adjust training time' }).click();
  await calendar.getByRole('button', { name: 'day', exact: true }).click();
  await expect(calendar.getByText(/Cross-zone dragging is disabled/)).toBeVisible();
  await expect(calendar.getByRole('button', { name: 'Drag to change training time' })).toHaveCount(0);
  await expect(calendar.getByRole('button', { name: 'Set training time', exact: true })).toBeDisabled();
  await page.goto('/');
  await expect(page.locator('.v31-hero')).toContainText('Source-zone workout');
  await expect(page.locator('.v31-hero')).toContainText(seeded.sourceZone);
  await expect(page.getByRole('link', { name: 'Start workout', exact: true })).toHaveAttribute('href', `/workout?scheduledWorkoutId=${seeded.taskId}`);
  const original = await page.evaluate(async id => { const b = '/src/persistence/db.ts'; const { database } = await import(/* @vite-ignore */ b); const task = await database.scheduledWorkouts.get(id); return { scheduledDate: task.scheduledDate, originalDate: task.originalDate, startTime: task.startTime }; }, seeded.taskId);
  expect(original).toEqual({ scheduledDate: seeded.sourceDate, originalDate: seeded.sourceDate, startTime: '12:00' });
});

test('future cross-zone links navigate to the projected day', async ({ page }) => {
  const seeded = await seed(page, false, true);
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'View', exact: true })).toHaveAttribute('href', `/plans?date=${seeded.shown}`);
  await page.getByRole('link', { name: 'View', exact: true }).click();
  await expect(page.locator('.v31-calendar-side')).toContainText(seeded.shown);
  await expect(page.locator('.v31-calendar-side')).toContainText('Source-zone workout');
});

test('Today continues the active workout with its own exercise snapshot instead of another scheduled task', async ({ page }) => {
  const seeded = await seed(page);
  const activeName = await page.evaluate(async ({ shown, calendarZone }) => {
    const w = '/src/application/workouts.ts'; const { workoutService } = await import(/* @vite-ignore */ w);
    const c = '/src/catalog/exercises.ts'; const { exercises } = await import(/* @vite-ignore */ c);
    const exercise = exercises.find((item: { id: string }) => item.id !== 'd16325d9-fc00-4c41-88a1-000000000003');
    await workoutService.startWorkout({ sessionId: crypto.randomUUID(), localDate: shown, timeZone: calendarZone, exerciseIds: [exercise.id] });
    return exercise.name.en;
  }, seeded);
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Continue workout', exact: true })).toHaveAttribute('href', '/workout');
  await expect(page.locator('.v31-hero .v31-workout-summary')).toContainText(activeName);
  await expect(page.locator('.v31-hero')).not.toContainText('Source-zone workout');
  await expect(page.locator('.v31-hero')).not.toContainText('12:00');
});

test('ambiguous projected dates require review and cannot be selected or saved as new plans', async ({ page }) => {
  const seeded = await seed(page, true);
  await page.goto('/plans');
  await expect(page.getByRole('alert')).toContainText('ambiguous date');
  const review = page.getByRole('region', { name: 'Schedules needing date review' });
  await expect(review).toContainText(seeded.sourceDate); await expect(review).toContainText(seeded.sourceZone);
  await expect(page.getByRole('button', { name: '+ Arrange training', exact: true })).toBeDisabled();
  await page.getByRole('tab', { name: 'Create plan', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Create manually', exact: true })).toBeDisabled();
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('schedules need time-zone review');
  await expect(page.getByRole('link', { name: 'Start workout', exact: true })).toHaveCount(0);
});
