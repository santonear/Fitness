import { expect, test } from '@playwright/test';
test.use({ locale: 'en-US' });
test.beforeEach(async ({ page }) => {
  await page.goto('/plans?tab=legacy');
  await expect.poll(() => page.evaluate(async () => {
    const { database } = await import(String('/src/persistence/db.ts'));
    return database.profiles.count();
  })).toBe(1);
});

for (const locale of ['en', 'zh'] as const) {
  test(`${locale}: deleting a schedule confirms, hides after reload and preserves completed facts and backup`, async ({ page }) => {
    if (locale === 'zh') await page.getByLabel('Language', { exact: true }).selectOption('zh');
    const seed = await page.evaluate(async () => {
      const { planService } = await import(String('/src/application/plans.ts'));
      const { workoutService } = await import(String('/src/application/workouts.ts'));
      const { database } = await import(String('/src/persistence/db.ts'));
      const plan = await planService.savePlan({ name: 'Schedule test', source: 'manual', startDate: '2026-10-05', scheduleTimeZone: 'UTC', goalSnapshot: { goal: '' }, durationWeeks: 1, daysPerWeek: 2, days: [1, 3].map(dayOfWeek => ({ dayId: crypto.randomUUID(), weekIndex: 1, dayOfWeek, exercises: [{ exerciseId: 'd16325d9-fc00-4c41-88a1-000000000003', order: 0, targetSets: [{ metricType: 'reps', reps: 10 }] }] })) });
      const rows = await database.scheduledWorkouts.where('planVersionId').equals(plan.currentVersionId).sortBy('originalDate');
      let session = await workoutService.startWorkout({ sessionId: crypto.randomUUID(), scheduledWorkoutId: rows[0].id, localDate: rows[0].originalDate, timeZone: 'UTC' });
      session = await workoutService.recordSet(session.id, { id: crypto.randomUUID(), exerciseInstanceId: session.exerciseSnapshots[0].exerciseInstanceId, order: 0, metricType: 'reps', reps: 8, completed: true }, session.revision);
      await workoutService.completeWorkout(session.id, session.revision);
      await planService.skipWorkout(rows[1].id, rows[1].revision);
      return rows[0].id;
    });
    await page.reload();
    const list = page.getByRole('list', { name: locale === 'zh' ? '日程' : 'Schedule', exact: true });
    await expect(list.locator('li')).toHaveCount(2);
    const snapshot = () => page.evaluate(async () => {
      const { database } = await import(String('/src/persistence/db.ts'));
      return JSON.stringify(await Promise.all([database.plans, database.planVersions, database.sessions, database.sets, database.trainingMemo].map(table => table.toArray())));
    });
    const before = await snapshot();
    page.once('dialog', dialog => dialog.dismiss());
    await list.locator('li').first().getByRole('button', { name: locale === 'zh' ? '删除' : 'Delete', exact: true }).click({ timeout: 5000 });
    await expect(list.locator('li')).toHaveCount(2);
    page.once('dialog', dialog => dialog.accept());
    await list.locator('li').first().getByRole('button', { name: locale === 'zh' ? '删除' : 'Delete', exact: true }).click();
    await expect(list.locator('li')).toHaveCount(1);
    expect(await snapshot()).toBe(before);
    await page.reload();
    await expect(list.locator('li')).toHaveCount(1);
    const restored = await page.evaluate(async id => {
      const { backupService } = await import(String('/src/application/backup.ts'));
      const { database } = await import(String('/src/persistence/db.ts'));
      const backup = await backupService.validateBackup(new File([await backupService.exportBackup()], 'schedule.json'));
      await backupService.importBackup(backup, { backupExported: true, replacementConfirmed: true, expectedRevision: backup.expectedRevision });
      return { hidden: Boolean((await database.scheduledWorkouts.get(id)).hiddenAt), rows: await database.scheduledWorkouts.count(), sets: await database.sets.count() };
    }, seed);
    expect(restored).toEqual({ hidden: true, rows: 2, sets: 1 });
    await expect(list.locator('li')).toHaveCount(1);
    page.once('dialog', dialog => dialog.accept());
    await list.getByRole('button', { name: locale === 'zh' ? '删除' : 'Delete', exact: true }).click();
    await expect(list.locator('li')).toHaveCount(0);
  });
}

test('schedule hide preserves completion statistics, guards concurrent and ongoing writes and rejects hidden starts', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { planService } = await import(String('/src/application/plans.ts'));
    const { workoutService } = await import(String('/src/application/workouts.ts'));
    const { database } = await import(String('/src/persistence/db.ts'));
    const { progressService } = await import(String('/src/application/progress.ts'));
    const { backupService } = await import(String('/src/application/backup.ts'));
    const plan = await planService.savePlan({ name: 'Pending', source: 'manual', startDate: '2026-10-05', scheduleTimeZone: 'UTC', goalSnapshot: { goal: '' }, durationWeeks: 1, daysPerWeek: 1, days: [{ dayId: crypto.randomUUID(), weekIndex: 1, dayOfWeek: 1, exercises: [{ exerciseId: 'd16325d9-fc00-4c41-88a1-000000000003', order: 0, targetSets: [{ metricType: 'reps', reps: 10 }] }] }] });
    const row = (await database.scheduledWorkouts.toArray())[0];
    const originalBackup = await (await backupService.exportBackup()).text();
    const stale = await planService.hideScheduledWorkout(row.id, row.revision + 1).then(() => 'accepted', (e: { code: string }) => e.code);
    const session = await workoutService.startWorkout({ sessionId: crypto.randomUUID(), scheduledWorkoutId: row.id, localDate: row.originalDate, timeZone: 'UTC' });
    const ongoing = await planService.hideScheduledWorkout(row.id, row.revision).then(() => 'accepted', (e: { code: string }) => e.code);
    const forged = JSON.parse(await (await backupService.exportBackup()).text());
    forged.data.scheduledWorkouts[0].hiddenAt = new Date().toISOString();
    const forgedRejected = await backupService.validateBackup(new File([JSON.stringify(forged)], 'forged.json')).then(() => false, (e: { code: string }) => e.code === 'BACKUP_REFERENCE_INVALID');
    await workoutService.abandonWorkout(session.id, session.revision);
    row.revision = (await database.scheduledWorkouts.get(row.id)).revision;
    const snapshot = async () => JSON.stringify(await Promise.all(database.tables.map((table: { toArray: () => Promise<unknown[]> }) => table.toArray())));
    const beforeFailure = await snapshot();
    const originalPut = database.scheduledWorkouts.put;
    database.scheduledWorkouts.put = () => Promise.reject(new Error('Injected schedule write failure'));
    const failed = await planService.hideScheduledWorkout(row.id, row.revision).then(() => false, () => true);
    database.scheduledWorkouts.put = originalPut;
    const rolledBack = beforeFailure === await snapshot();
    const range = { from: '2026-10-01', to: '2026-10-31', timeZone: 'UTC', nowMs: Date.parse('2026-11-01T00:00:00Z') };
    const before = await progressService.queryProgress(range, range.nowMs);
    await planService.hideScheduledWorkout(row.id, row.revision);
    const after = await progressService.queryProgress(range, range.nowMs);
    const start = await workoutService.startWorkout({ sessionId: crypto.randomUUID(), scheduledWorkoutId: row.id, localDate: row.originalDate, timeZone: 'UTC' }).then(() => 'accepted', (e: { code: string }) => e.code);
    const direct = await workoutService.startWorkout({ sessionId: crypto.randomUUID(), planVersionId: plan.currentVersionId, plannedDayId: row.plannedDayId, localDate: row.originalDate, timeZone: 'UTC' }).then(() => 'accepted', (e: { code: string }) => e.code);
    const oldBackupAccepted = Boolean(await backupService.validateBackup(new File([originalBackup], 'old.json')));
    return { stale, ongoing, forgedRejected, failed, rolledBack, start, direct, available: (await workoutService.listAvailableSchedule()).length, unchanged: JSON.stringify(before) === JSON.stringify(after), oldBackupAccepted };
  });
  expect(result).toEqual({ stale: 'CONFLICT', ongoing: 'WORKOUT_IN_PROGRESS', forgedRejected: true, failed: true, rolledBack: true, start: 'INVALID', direct: 'INVALID', available: 0, unchanged: true, oldBackupAccepted: true });
});


