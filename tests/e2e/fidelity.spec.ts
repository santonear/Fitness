import { test, expect } from '@playwright/test';
test.use({ locale: 'en-US' });
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // Controls render before the asynchronous IndexedDB profile initialization finishes.
  await expect.poll(() => page.evaluate(async () => {
    const { database } = await import(String('/src/persistence/db.ts'));
    return await database.profiles.count();
  })).toBe(1);
});

for (const entry of ['service', 'JSON'] as const) {
  test(`${entry}: renaming a varied plan preserves versions, adjusted schedule and completed facts`, async ({ page }) => {
    await page.goto('/plans');
    const seed = await page.evaluate(async () => {
      const { planService } = await import(String('/src/application/plans.ts'));
      const { workoutService } = await import(String('/src/application/workouts.ts'));
      const { backupService } = await import(String('/src/application/backup.ts'));
      const { database } = await import(String('/src/persistence/db.ts'));
      const plan = await planService.savePlan({ name: 'Varied plan', source: 'manual', startDate: '2026-10-05', scheduleTimeZone: 'UTC', goalSnapshot: { goal: 'Preserve' }, durationWeeks: 2, daysPerWeek: 2, status: 'active', days: [1, 2].flatMap(weekIndex => [1, 3].map(dayOfWeek => ({ dayId: crypto.randomUUID(), weekIndex, dayOfWeek, exercises: [{ exerciseId: 'd16325d9-fc00-4c41-88a1-000000000003', order: 0, targetSets: [{ metricType: 'reps' as const, reps: weekIndex * dayOfWeek * 10 }], notes: `Week ${weekIndex}, day ${dayOfWeek}` }] }))) });
      const rows = await database.scheduledWorkouts.where('planVersionId').equals(plan.currentVersionId).sortBy('originalDate');
      let session = await workoutService.startWorkout({ sessionId: crypto.randomUUID(), scheduledWorkoutId: rows[0].id, localDate: rows[0].originalDate, timeZone: 'UTC' });
      session = await workoutService.recordSet(session.id, { id: crypto.randomUUID(), exerciseInstanceId: session.exerciseSnapshots[0].exerciseInstanceId, order: 0, metricType: 'reps', reps: 7, completed: true, notes: 'Actual fact' }, session.revision);
      await workoutService.completeWorkout(session.id, session.revision);
      await planService.rescheduleWorkout(rows[1].id, '2026-10-08', rows[1].revision);
      return { id: plan.id, backup: await (await backupService.exportBackup()).text() };
    });
    if (entry === 'JSON') {
      await page.goto('/settings');
      await page.getByLabel('Restore JSON file', { exact: true }).setInputFiles({ name: 'varied.json', mimeType: 'application/json', buffer: Buffer.from(seed.backup) });
      await expect(page.getByText('Backup validated', { exact: true })).toBeVisible();
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download current data before replacement', exact: true }).click();
      await download;
      await page.getByLabel('I have downloaded and kept the current backup', { exact: true }).check();
      await page.getByLabel('I confirm replacing all local data', { exact: true }).check();
      await page.getByRole('button', { name: 'Replace local data', exact: true }).click();
      await expect(page.getByText('Backup validated', { exact: true })).toHaveCount(0);
    }
    await page.goto('/plans');
    const snapshot = async () => page.evaluate(async id => {
      const { database } = await import(String('/src/persistence/db.ts'));
      const plan = (await database.plans.get(id))!;
      return { currentVersionId: plan.currentVersionId, source: plan.source, status: plan.status, versions: await database.planVersions.toArray(), schedules: await database.scheduledWorkouts.toArray(), sessions: await database.sessions.toArray(), sets: await database.sets.toArray(), memo: await database.trainingMemo.toArray() };
    }, seed.id);
    const before = await snapshot();
    await page.evaluate(async id => {
      const { database } = await import(String('/src/persistence/db.ts'));
      const { planService } = await import(String('/src/application/plans.ts'));
      const plan = await database.plans.get(id);
      await planService.renamePlan(id, 'Renamed only', plan.revision);
    }, seed.id);
    expect(await snapshot()).toEqual(before);
    await page.reload();
    await page.getByRole('list', { name: 'Saved plans' }).getByRole('button', { name: 'view schedule', exact: true }).click();
    await expect(page.getByRole('region', { name: 'read-only schedule' })).toBeVisible();
    await expect(page.getByLabel('Plan name', { exact: true })).toHaveCount(0);
    const valid = await page.evaluate(async () => {
      const { backupService } = await import(String('/src/application/backup.ts'));
      return !!await backupService.validateBackup(new File([await backupService.exportBackup()], 'after.json'));
    });
    expect(valid).toBe(true);
  });
}

test('saving one action preserves another draft, own success resets only its draft and replacement invalidates it', async ({ page }) => {
  await page.goto('/workout');
  await expect(page.getByRole('button', { name: 'Start temporary workout', exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const { workoutService } = await import(String('/src/application/workouts.ts'));
    await workoutService.startWorkout({ sessionId: crypto.randomUUID(), localDate: '2026-10-03', timeZone: 'UTC', exerciseIds: ['d16325d9-fc00-4c41-88a1-000000000003', 'd16325d9-fc00-4c41-88a1-000000000003'] });
  });
  await page.reload();
  const a = page.locator('.workout-exercise').nth(0), b = page.locator('.workout-exercise').nth(1);
  await b.getByLabel('Reps', { exact: true }).fill('23');
  await b.getByLabel('Set notes', { exact: true }).fill('Keep this draft');
  await a.getByLabel('Reps', { exact: true }).fill('11');
  await a.getByRole('button', { name: 'Record set', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Set saved');
  await expect(b.getByLabel('Reps', { exact: true })).toHaveValue('23');
  await expect(b.getByLabel('Set notes', { exact: true })).toHaveValue('Keep this draft');
  await expect(a.getByLabel('Reps', { exact: true }).last()).toHaveValue('');
  await a.getByLabel('Reps', { exact: true }).last().fill('12');
  await a.getByRole('button', { name: 'Record set', exact: true }).click();
  await expect(a.getByRole('button', { name: 'Update set', exact: true })).toHaveCount(2);
  await expect(b.getByLabel('Reps', { exact: true })).toHaveValue('23');
  await b.getByRole('combobox', { name: 'Replace exercise', exact: true }).selectOption('d16325d9-fc00-4c41-88a1-000000000004');
  await expect(b.getByLabel('Duration (seconds)', { exact: true })).toHaveValue('');
  await expect(b.getByLabel('Set notes', { exact: true })).toHaveValue('');
  await a.getByLabel('Reps', { exact: true }).last().fill('17');
  await b.getByLabel('Duration (seconds)', { exact: true }).fill('31');
  page.once('dialog', dialog => dialog.accept());
  await a.getByRole('button', { name: 'Remove saved set', exact: true }).last().click();
  await expect(a.getByRole('button', { name: 'Update set', exact: true })).toHaveCount(1);
  await expect(a.getByLabel('Reps', { exact: true }).last()).toHaveValue('');
  await expect(b.getByLabel('Duration (seconds)', { exact: true })).toHaveValue('31');
  await b.getByRole('button', { name: 'Remove exercise', exact: true }).click();
  await expect(page.locator('.workout-exercise')).toHaveCount(1);
  const facts = await page.evaluate(async () => { const { database } = await import(String('/src/persistence/db.ts')); return (await database.sets.toArray()).map((set: { reps: number }) => set.reps).sort((a: number, b: number) => a - b); });
  expect(facts).toEqual([11]);
  await a.getByLabel('Reps', { exact: true }).last().fill('99');
  await page.getByRole('button', { name: 'Review completion', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm completion', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Workout completed');
  await page.getByRole('button', { name: 'Start another workout', exact: true }).click();
  await page.getByRole('button', { name: 'Start temporary workout', exact: true }).click();
  await expect(page.getByLabel('Reps', { exact: true })).toHaveValue('');
});

test('rename rejects stale revisions and ongoing active edits without partial writes', async ({ page }) => {
  await page.goto('/plans');
  const result = await page.evaluate(async () => {
    const { planService } = await import(String('/src/application/plans.ts'));
    const { workoutService } = await import(String('/src/application/workouts.ts'));
    const { database } = await import(String('/src/persistence/db.ts'));
    const plan = await planService.savePlan({ name: 'Original', source: 'manual', startDate: '2026-10-05', scheduleTimeZone: 'UTC', goalSnapshot: { goal: '' }, durationWeeks: 1, daysPerWeek: 1, days: [{ dayId: crypto.randomUUID(), weekIndex: 1, dayOfWeek: 1, exercises: [{ exerciseId: 'd16325d9-fc00-4c41-88a1-000000000003', order: 0, targetSets: [{ metricType: 'reps', reps: 10 }] }] }] });
    const before = JSON.stringify(await Promise.all(database.tables.map((table: { toArray: () => Promise<unknown[]> }) => table.toArray())));
    const stale = await planService.renamePlan(plan.id, 'Stale', plan.revision + 1).then(() => 'accepted', (e: { code: string }) => e.code);
    const invalid = await planService.renamePlan(plan.id, '', plan.revision).then(() => 'accepted', (e: { code: string }) => e.code);
    const unchanged = before === JSON.stringify(await Promise.all(database.tables.map((table: { toArray: () => Promise<unknown[]> }) => table.toArray())));
    await workoutService.startWorkout({ sessionId: crypto.randomUUID(), localDate: '2026-10-03', timeZone: 'UTC', exerciseIds: ['d16325d9-fc00-4c41-88a1-000000000003'] });
    const ongoing = await planService.renamePlan(plan.id, 'Blocked', plan.revision).then(() => 'accepted', (e: { code: string }) => e.code);
    return { stale, invalid, unchanged, ongoing, name: (await database.plans.get(plan.id)).name };
  });
  expect(result).toEqual({ stale: 'CONFLICT', invalid: 'INVALID', unchanged: true, ongoing: 'WORKOUT_IN_PROGRESS', name: 'Original' });
});

test('failed save keeps drafts without success; whole-store restore invalidates both without creating facts', async ({ page }) => {
  await page.goto('/workout');
  await expect(page.getByRole('button', { name: 'Start temporary workout', exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const { workoutService } = await import(String('/src/application/workouts.ts'));
    await workoutService.startWorkout({ sessionId: crypto.randomUUID(), localDate: '2026-10-03', timeZone: 'UTC', exerciseIds: ['d16325d9-fc00-4c41-88a1-000000000003', 'd16325d9-fc00-4c41-88a1-000000000003'] });
  });
  await page.reload();
  const a = page.locator('.workout-exercise').nth(0), b = page.locator('.workout-exercise').nth(1);
  await a.getByLabel('Reps', { exact: true }).fill('9');
  await b.getByLabel('Reps', { exact: true }).fill('23');
  await page.evaluate(async () => {
    const { workoutService } = await import(String('/src/application/workouts.ts'));
    workoutService.recordSet = async () => { throw Object.assign(new Error('Injected write failure'), { code: 'STORAGE_FULL' }); };
  });
  await a.getByRole('button', { name: 'Record set', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('STORAGE_FULL');
  await expect(page.getByRole('status')).not.toHaveText('Set saved');
  await expect(a.getByLabel('Reps', { exact: true })).toHaveValue('9');
  await expect(b.getByLabel('Reps', { exact: true })).toHaveValue('23');
  const sets = await page.evaluate(async () => {
    const { backupService } = await import(String('/src/application/backup.ts'));
    const { database } = await import(String('/src/persistence/db.ts'));
    const backup = await backupService.validateBackup(new File([await backupService.exportBackup()], 'restore.json'));
    await backupService.importBackup(backup, { backupExported: true, replacementConfirmed: true, expectedRevision: backup.expectedRevision });
    return database.sets.count();
  });
  expect(sets).toBe(0);
  await expect(a.getByLabel('Reps', { exact: true })).toHaveValue('');
  await expect(b.getByLabel('Reps', { exact: true })).toHaveValue('');
});


