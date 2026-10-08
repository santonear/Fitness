import { expect, test } from '@playwright/test';

test('viewing dates never creates plans; independent manual dates save with their own times and content', async ({ page }) => {
  await page.goto('/plans');
  await page.getByRole('tab', { name: 'Calendar', exact: true }).waitFor();
  const calendar = page.getByRole('tabpanel', { name: 'Calendar', exact: true });
  const dates = await calendar.locator('[data-plan-date]:not(.outside-month)').evaluateAll(elements => elements.slice(2, 4).map(element => element.getAttribute('data-plan-date')!));
  await calendar.locator(`[data-plan-date="${dates[0]}"]`).click();
  const count = () => page.evaluate(async () => { const path = '/src/persistence/db.ts'; const { database } = await import(/* @vite-ignore */ path); return database.plans.count(); });
  expect(await count()).toBe(0);
  await calendar.getByRole('button', { name: '+ Arrange training', exact: true }).click();
  for (const date of dates) await calendar.locator(`[data-plan-date="${date}"]`).click();
  expect(await count()).toBe(0);
  await calendar.getByRole('button', { name: 'Create for these dates', exact: true }).click();
  for (let index = 0; index < dates.length; index++) {
    const day = page.getByRole('group', { name: dates[index], exact: true });
    await day.getByLabel('Plan name', { exact: true }).fill(`Day ${index + 1}`);
    await day.getByLabel('Start time', { exact: true }).fill(index === 0 ? '12:00' : '14:00');
    await day.getByLabel('Duration (minutes)', { exact: true }).fill(index === 0 ? '30' : '45');
    await day.getByLabel('Exercise notes (optional)').fill(index === 0 ? 'first independent notes' : 'second independent notes');
  }
  // A theme change must not remount the form or write the draft.
  await page.getByRole('combobox', { name: 'Switch layout', exact: true }).selectOption('orbit');
  await expect(page.getByRole('group', { name: dates[1], exact: true }).getByLabel('Plan name', { exact: true })).toHaveValue('Day 2');
  await page.getByRole('tab', { name: 'Upcoming', exact: true }).click();
  await page.getByRole('tab', { name: 'Create plan', exact: true }).click();
  await expect(page.getByRole('group', { name: dates[0], exact: true }).getByLabel('Plan name', { exact: true })).toHaveValue('Day 1');
  await expect(page.getByRole('button', { name: 'Confirm and save all dates' })).toBeDisabled();
  await page.getByRole('checkbox', { name: /I reviewed the times/ }).check();
  await page.getByRole('button', { name: 'Confirm and save all dates' }).click();
  await expect(page.getByRole('status')).toContainText('Saved 2 independent day plans.');
  const result = await page.evaluate(async () => { const path = '/src/persistence/db.ts'; const { database } = await import(/* @vite-ignore */ path); return { tasks: (await database.scheduledWorkouts.toArray()).sort((a: {scheduledDate:string}, b: {scheduledDate:string}) => a.scheduledDate.localeCompare(b.scheduledDate)).map((task: {startTime:string;durationMinutes:number}) => [task.startTime, task.durationMinutes]), notes: (await database.planVersions.toArray()).map((version: {days:{exercises:{notes:string}[]}[]}) => version.days[0].exercises[0].notes).sort() }; });
  expect(result.tasks).toEqual([['12:00', 30], ['14:00', 45]]);
  expect(result.notes).toEqual(['first independent notes', 'second independent notes']);
});

test('occupied dates reject selection; cross-month drafts survive navigation and mobile drag is explicit', async ({ page }) => {
  await page.goto('/plans');
  await page.getByRole('tab', { name: 'Calendar', exact: true }).waitFor();
  const calendar = page.getByRole('tabpanel', { name: 'Calendar', exact: true });
  const date = await calendar.locator('[data-plan-date]:not(.outside-month)').nth(5).getAttribute('data-plan-date');
  await page.evaluate(async date => { const p = '/src/application/profile.ts'; const { profileService } = await import(/* @vite-ignore */ p); const profile = await profileService.getProfile(); const path = '/src/application/day-plans.ts'; const { dayPlanService } = await import(/* @vite-ignore */ path); await dayPlanService.saveDayPlan({ name: 'Occupied', date, timeZone: profile.timeZone, exercises: [{exerciseId: 'd16325d9-fc00-4c41-88a1-000000000003', order: 0, targetSets: [{metricType: 'reps', reps: 10}]}] }); }, date);
  await expect(calendar.locator(`[data-plan-date="${date}"]`)).toHaveClass(/occupied/);
  await calendar.getByRole('button', { name: '+ Arrange training', exact: true }).click();
  await calendar.locator(`[data-plan-date="${date}"]`).click();
  await expect(calendar.getByRole('status').first()).toContainText('occupied');
  await expect(calendar.locator(`[data-plan-date="${date}"]`)).toHaveAttribute('aria-pressed', 'false');
  const first = calendar.locator('[data-plan-date]:not(.outside-month):not(.occupied)').first();
  const picked = await first.getAttribute('data-plan-date'); await first.click();
  await calendar.getByRole('button', { name: 'Next month', exact: true }).click();
  await calendar.locator('[data-plan-date]:not(.outside-month)').nth(10).click();
  await calendar.getByRole('button', { name: 'Previous month', exact: true }).click();
  await expect(calendar.locator(`[data-plan-date="${picked}"]`)).toHaveAttribute('aria-pressed', 'true');
  const drag = calendar.getByRole('button', { name: 'Enable drag selection', exact: true });
  await expect(drag).toHaveAttribute('aria-pressed', 'false'); await drag.click();
  await expect(calendar.locator('.v31-calendar-grid')).toHaveClass(/v31-touch-paint/);
  await calendar.getByRole('button', { name: 'View mode', exact: true }).click();
  await expect(calendar.locator('.v31-calendar-grid')).not.toHaveClass(/v31-touch-paint/);
});

test('manual batch conflict keeps all drafts and performs zero partial writes', async ({ page }) => {
  await page.goto('/plans');
  await page.getByRole('tab', { name: 'Create plan', exact: true }).click();
  await page.getByRole('button', { name: 'Create manually', exact: true }).click();
  const create = page.getByRole('tabpanel', { name: 'Create plan', exact: true });
  const dates = await create.locator('[data-plan-date]:not(.outside-month)').evaluateAll(elements => elements.slice(10, 12).map(element => element.getAttribute('data-plan-date')!));
  for (const date of dates) { await create.locator(`[data-plan-date="${date}"]`).click(); await page.getByRole('group', { name: date, exact: true }).getByLabel('Plan name', { exact: true }).fill('Keep this draft'); }
  await page.evaluate(async date => { const p = '/src/application/profile.ts'; const { profileService } = await import(/* @vite-ignore */ p); const profile = await profileService.getProfile(); const path = '/src/application/day-plans.ts'; const { dayPlanService } = await import(/* @vite-ignore */ path); await dayPlanService.saveDayPlan({ name: 'Concurrent plan', date, timeZone: profile.timeZone, exercises: [{exerciseId: 'd16325d9-fc00-4c41-88a1-000000000003', order: 0, targetSets: [{metricType: 'reps', reps: 10}]}] }); }, dates[1]);
  await page.getByRole('checkbox', { name: /I reviewed the times/ }).check();
  await page.getByRole('button', { name: 'Confirm and save all dates' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(await page.evaluate(async () => { const path = '/src/persistence/db.ts'; const { database } = await import(/* @vite-ignore */ path); return database.plans.count(); })).toBe(1);
  await expect(page.getByRole('group', { name: dates[0], exact: true }).getByLabel('Plan name', { exact: true })).toHaveValue('Keep this draft');
});

test('moving a manual workout time waits for confirmation and updates the saved plan', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/plans');
  await page.getByRole('tab', { name: 'Calendar', exact: true }).waitFor();
  const seeded = await page.evaluate(async () => { const p = '/src/application/profile.ts'; const { profileService } = await import(/* @vite-ignore */ p); const profile = await profileService.getProfile(); const d = '/src/application/progress.ts'; const { dateInZone } = await import(/* @vite-ignore */ d); const date = dateInZone(Date.now(), profile.timeZone); const path = '/src/application/day-plans.ts'; const { dayPlanService } = await import(/* @vite-ignore */ path); const result = await dayPlanService.saveDayPlan({ name: 'Timed manual workout', date, timeZone: profile.timeZone, startTime: '12:00', durationMinutes: 30, exercises: [{exerciseId: 'd16325d9-fc00-4c41-88a1-000000000003', order: 0, targetSets: [{metricType: 'reps', reps: 10}]}] }); return { id: result.task.id, planId: result.plan.id, revision: result.plan.revision }; });
  await page.getByRole('button', { name: 'View month / day timeline and adjust training time' }).click();
  await page.getByRole('button', { name: 'day', exact: true }).click();
  const handle = page.getByRole('button', { name: 'Drag to change training time', exact: true });
  await handle.focus(); await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Confirm training time change' });
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(page.getByLabel('New start time', { exact: true })).toBeFocused();
  for (let index = 0; index < 8; index++) { await page.keyboard.press('Tab'); expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true); }
  for (const button of await dialog.getByRole('button').all()) { const target = await button.boundingBox(); expect(target!.height).toBeGreaterThanOrEqual(44); expect(target!.width).toBeGreaterThanOrEqual(44); }
  await page.screenshot({path:`outputs/v31-time-dialog-${info.project.name}-1440.png`});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`outputs/v31-time-dialog-${info.project.name}-390.png`});
  await page.setViewportSize({width:1440,height:1000});
  await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible(); await expect(handle).toBeFocused();
  await handle.scrollIntoViewIfNeeded(); const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 96, { steps: 6 }); await page.mouse.up();
  await expect(page.getByRole('dialog', { name: 'Confirm training time change' })).toBeVisible();
  await expect(page.getByLabel('New start time', { exact: true })).toHaveValue('14:00');
  const read = () => page.evaluate(async id => { const path = '/src/persistence/db.ts'; const { database } = await import(/* @vite-ignore */ path); return (await database.scheduledWorkouts.get(id)).startTime; }, seeded.id);
  expect(await read()).toBe('12:00');
  await page.getByRole('button', { name: 'Confirm change', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Confirm training time change' })).not.toBeVisible();
  expect(await read()).toBe('14:00');
  expect(await page.evaluate(async id => { const path = '/src/persistence/db.ts'; const { database } = await import(/* @vite-ignore */ path); return (await database.plans.get(id)).revision; }, seeded.planId)).toBe(seeded.revision + 1);
});

test('retained phase controls pause and resume offline; cancellation preserves active workout and original tasks', async ({ page, context }) => {
  await page.goto('/plans?tab=legacy');
  await page.getByRole('tabpanel', { name: 'Legacy plans' }).waitFor();
  const seeded = await page.evaluate(async () => {
    const p = '/src/application/profile.ts'; const { profileService } = await import(/* @vite-ignore */ p); const profile = await profileService.initialize('en');
    const path = '/src/application/guided.ts'; const { guidedService } = await import(/* @vite-ignore */ path);
    const candidate = { id: crypto.randomUUID(), name: 'Retained phase fixture', goal: 'Strength', startDate: '2099-01-01', endDate: '2099-01-03', timeZone: profile.timeZone, days: ['2099-01-01', '2099-01-03'].map(date => ({ date, exercises: [{exerciseId: 'd16325d9-fc00-4c41-88a1-000000000003', order: 0, targetSets: [{metricType: 'reps', reps: 10}]}] })), explanation: 'Preserve the existing phase', createdAt: new Date().toISOString(), restoreGeneration: 0, ...(await guidedService.captureDependencies()) };
    await guidedService.retainCandidate(candidate, (await guidedService.read()).revision);
    const id = await guidedService.applyCandidate(candidate.id, (await guidedService.read()).revision, 14);
    const program = (await guidedService.read()).programs.find((item: {id:string}) => item.id === id);
    const w = '/src/application/workouts.ts'; const { workoutService } = await import(/* @vite-ignore */ w);
    const workout = await workoutService.startWorkout({ sessionId: crypto.randomUUID(), localDate: '2099-01-01', timeZone: profile.timeZone, scheduledWorkoutId: program.taskIds[0] });
    return { id, taskIds: program.taskIds, sessionId: workout.id };
  });
  const region = page.getByRole('region', { name: 'Retained training phases' });
  await expect(region.getByRole('heading', { name: 'Retained phase fixture' })).toBeVisible();
  const read = () => page.evaluate(async seeded => { const path = '/src/persistence/db.ts'; const { database } = await import(/* @vite-ignore */ path); const program = (await database.guidedStates.get('guided')).programs.find((value: {id:string}) => value.id === seeded.id); return { status: program.status, taskIds: program.taskIds, tasks: await database.scheduledWorkouts.count(), workoutStatus: (await database.sessions.get(seeded.sessionId)).status }; }, seeded);
  await context.setOffline(true);
  await region.getByRole('button', { name: 'pause plan', exact: true }).click();
  expect((await read()).status).toBe('active');
  await page.getByRole('dialog').getByRole('button', { name: 'confirm', exact: true }).click();
  await expect(region.getByRole('button', { name: 'resume plan', exact: true })).toBeVisible();
  expect((await read()).status).toBe('paused');
  await page.getByRole('tab', { name: 'Upcoming', exact: true }).click();
  const upcoming = page.getByRole('tabpanel', { name: 'Upcoming', exact: true });
  await expect(upcoming.getByText('Phase paused; resume before starting training.')).toHaveCount(2);
  await expect(upcoming.getByRole('link', { name: 'Start workout', exact: true })).toHaveCount(0);
  await expect(upcoming.getByRole('link', { name: 'Continue workout', exact: true })).toHaveAttribute('href', '/workout');
  await page.getByRole('tab', { name: 'Legacy plans', exact: true }).click();
  await region.getByRole('button', { name: 'resume plan', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'confirm', exact: true }).click();
  await expect(region.getByRole('button', { name: 'pause plan', exact: true })).toBeVisible();
  expect((await read()).status).toBe('active');
  await region.getByRole('button', { name: 'cancel plan', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'continue cancellation', exact: true }).click();
  expect((await read()).status).toBe('active');
  await page.getByRole('dialog').getByRole('button', { name: 'confirm', exact: true }).click();
  await expect(region.getByRole('button', { name: 'pause plan', exact: true })).toHaveCount(0);
  expect(await read()).toEqual({ status: 'terminated', taskIds: seeded.taskIds, tasks: 2, workoutStatus: 'in_progress' });
  await context.setOffline(false);
});
