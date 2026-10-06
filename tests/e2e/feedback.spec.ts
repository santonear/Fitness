import { test, expect, type Page } from '@playwright/test';

test.use({ locale: 'en-US' });
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect.poll(() => page.evaluate(async () => {
    const { database } = await import(String('/src/persistence/db.ts'));
    return database.profiles.count();
  })).toBe(1);
});

async function facts(page: Page) {
  return page.evaluate(async () => {
    const { database } = await import(String('/src/persistence/db.ts'));
    return JSON.stringify(await Promise.all([database.planVersions, database.scheduledWorkouts,
      database.sessions, database.sets, database.trainingMemo].map(table => table.toArray())));
  });
}

for (const locale of ['en', 'zh'] as const) {
  const text = (en: string, zh: string) => locale === 'zh' ? zh : en;
  test(locale + ': retained legacy plan is read-only and blocked deletion reports one error', async ({ page }) => {
    if (locale === 'zh') await page.getByLabel('Language', { exact: true }).selectOption('zh');
    await page.goto('/plans');
    await page.evaluate(async () => {
      const { planService } = await import(String('/src/application/plans.ts'));
      await planService.savePlan({ name: 'Original plan', source: 'manual', startDate: '2026-10-05',
        scheduleTimeZone: 'UTC', goalSnapshot: { goal: '' }, durationWeeks: 1, daysPerWeek: 1, status: 'active',
        days: [{ dayId: crypto.randomUUID(), weekIndex: 1, dayOfWeek: 1, exercises: [{
          exerciseId: 'd16325d9-fc00-4c41-88a1-000000000003', order: 0,
          targetSets: [{ metricType: 'reps', reps: 10 }],
        }] }],
      });
    });
    await page.reload();
    const list = page.getByRole('list', { name: text('Saved plans', '已保存计划'), exact: true });
    await expect(list).toContainText('Original plan');
    await expect(list.getByRole('button', { name: text('Edit', '编辑'), exact: true })).toHaveCount(0);
    await page.evaluate(async () => {
      const { database } = await import(String('/src/persistence/db.ts'));
      const { workoutService } = await import(String('/src/application/workouts.ts'));
      const row = (await database.scheduledWorkouts.toArray())[0];
      await workoutService.startWorkout({ sessionId: crypto.randomUUID(), scheduledWorkoutId: row.id,
        localDate: row.originalDate, timeZone: 'UTC' });
    });
    page.once('dialog', dialog => dialog.accept());
    await list.getByRole('button', { name: text('Delete', '删除'), exact: true }).click();
    await expect(page.getByRole('alert')).toHaveCount(1);
    await expect(page.getByRole('alert')).toContainText('WORKOUT_IN_PROGRESS');
    await expect(list).toContainText('Original plan');
  });

  test(locale + ': new and saved-set validation clears old success while drafts and facts survive', async ({ page }) => {
    if (locale === 'zh') await page.getByLabel('Language', { exact: true }).selectOption('zh');
    await page.goto('/workout');
    await page.evaluate(async () => {
      const { workoutService } = await import(String('/src/application/workouts.ts'));
      await workoutService.startWorkout({ sessionId: crypto.randomUUID(), localDate: '2026-10-03', timeZone: 'UTC',
        exerciseIds: ['d16325d9-fc00-4c41-88a1-000000000003', 'd16325d9-fc00-4c41-88a1-000000000003'] });
    });
    await page.reload();
    const a = page.locator('.workout-exercise').nth(0);
    const b = page.locator('.workout-exercise').nth(1);
    const next = a.getByRole('group', { name: text('Next set', '下一组'), exact: true });
    const reps = text('Reps', '次数'), notes = text('Set notes', '组备注');
    await b.getByLabel(reps, { exact: true }).fill('23');
    await b.getByLabel(notes, { exact: true }).fill('Keep other draft');
    await next.getByLabel(reps, { exact: true }).fill('11');
    await next.getByRole('button', { name: text('Record set', '记录组'), exact: true }).click();
    await expect(page.getByRole('status')).toHaveText(text('Set saved', '组已保存'));
    const before = await facts(page);
    await next.getByLabel(reps, { exact: true }).fill('-1');
    await next.getByLabel(notes, { exact: true }).fill('Keep invalid draft');
    await next.getByRole('button', { name: text('Record set', '记录组'), exact: true }).click();
    await expect(next.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('status')).toHaveText('');
    await expect(next.getByLabel(reps, { exact: true })).toHaveValue('-1');
    await expect(next.getByLabel(notes, { exact: true })).toHaveValue('Keep invalid draft');
    await expect(b.getByLabel(reps, { exact: true })).toHaveValue('23');
    await expect(b.getByLabel(notes, { exact: true })).toHaveValue('Keep other draft');
    expect(await facts(page)).toBe(before);
    const saved = a.getByRole('group', { name: text('Saved set', '已保存组'), exact: true });
    await saved.getByLabel(reps, { exact: true }).fill('12');
    await saved.getByRole('button', { name: text('Update set', '更新组'), exact: true }).click();
    await expect(page.getByRole('status')).toHaveText(text('Set saved', '组已保存'));
    const afterUpdate = await facts(page);
    await saved.getByLabel(reps, { exact: true }).fill('-2');
    await saved.getByRole('button', { name: text('Update set', '更新组'), exact: true }).click();
    await expect(saved.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('status')).toHaveText('');
    await expect(saved.getByLabel(reps, { exact: true })).toHaveValue('-2');
    expect(await facts(page)).toBe(afterUpdate);
    await expect(b.getByLabel(reps, { exact: true })).toHaveValue('23');
    await saved.getByLabel(reps, { exact: true }).fill('13');
    await saved.getByRole('button', { name: text('Update set', '更新组'), exact: true }).click();
    await expect(page.getByRole('status')).toHaveText(text('Set saved', '组已保存'));
    const beforeRequired = await facts(page);
    await next.getByLabel(reps, { exact: true }).fill('');
    await next.getByRole('button', { name: text('Record set', '记录组'), exact: true }).click();
    expect(await next.getByLabel(reps, { exact: true }).evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
    await expect(page.getByRole('status')).toHaveText('');
    await expect(b.getByLabel(notes, { exact: true })).toHaveValue('Keep other draft');
    expect(await facts(page)).toBe(beforeRequired);
    // A real out-of-date session revision exercises the existing service failure path.
    await page.evaluate(async () => {
      const { workoutService } = await import(String('/src/application/workouts.ts'));
      const session = (await workoutService.getActiveWorkout())!;
      await workoutService.recordSet(session.id, { id: crypto.randomUUID(), exerciseInstanceId: session.exerciseSnapshots[0].exerciseInstanceId,
        order: 1, metricType: 'reps', reps: 15, completed: true }, session.revision);
    });
    const beforeConflict = await facts(page);
    await next.getByLabel(reps, { exact: true }).fill('17');
    await next.getByRole('button', { name: text('Record set', '记录组'), exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'CONFLICT' })).toHaveCount(1);
    await expect(page.getByRole('status')).toHaveText('');
    await expect(next.getByLabel(reps, { exact: true })).toHaveValue('17');
    await expect(b.getByLabel(notes, { exact: true })).toHaveValue('Keep other draft');
    expect(await facts(page)).toBe(beforeConflict);
  });
}
