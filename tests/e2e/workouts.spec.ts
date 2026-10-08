import { test, expect } from '@playwright/test';
test.use({ locale: 'en-US' });
test.setTimeout(20000);
test('sets survive reload, review returns to editing and completed facts stay readable', async ({ page }) => {
 await page.goto('/workout');
 await page.getByRole('button', { name: 'Start temporary workout', exact: true }).click({timeout:5000});
 await page.getByLabel('Reps').fill('12');
 await page.getByLabel('Load (kg)').fill('2.5');
 await page.getByLabel('Set notes').fill('Last reps felt steady');
 await page.getByRole('button', { name: 'Record set', exact: true }).click();
 await expect(page.getByRole('status')).toContainText('Set saved');
 await page.reload(); await expect(page.getByText('12 reps · 2.5 kg')).toBeVisible();
 await page.getByRole('button', { name: 'Review completion', exact: true }).click();
 await page.getByRole('button', { name: 'Return to editing', exact: true }).click();
 await page.getByRole('button', { name: 'Review completion', exact: true }).click();
 await page.getByRole('button', { name: 'Confirm completion', exact: true }).click();
 await expect(page.getByText('Workout completed', { exact: true })).toBeVisible();
 await page.goto('/settings?tab=profile'); await page.getByRole('button', { name: 'Read full training memo', exact: true }).click();
 await expect(page.getByRole('region', { name: 'Full training memo' })).toContainText('Last reps felt steady');
});
test('two connections serialize starts and revisions; facts, memo and global revision roll back together', async ({ page }) => {
 await page.goto('/workout');
 const result = await page.evaluate(async () => { const path='/tests/e2e/helpers/workouts-browser.ts'; return (await import(/* @vite-ignore */ path)).verifyWorkoutTransactions(`fitness-test-workouts-${crypto.randomUUID()}`); });
 expect(result).toEqual({ starts:1, conflicts:1, sets:1, memoSets:1, rolledBack:true, completed:true, readonly:true, mismatch:true, replacementConfirmed:true, originalPreserved:true, abandoned:true, rebuilt:true });
});
test('planned training links confirmed completion to its schedule', async ({ page }) => {
 await page.goto('/workout');
 await expect(page.getByRole('button',{name:'Start temporary workout',exact:true})).toBeVisible();
 // Retained legacy fixture: creation through a removed UI is not this regression's purpose.
 await page.evaluate(async () => {
  const { planService } = await import(String('/src/application/plans.ts'));
  const { profileService } = await import(String('/src/application/profile.ts'));
  const profile = await profileService.getProfile();
  await planService.savePlan({name:'Train today',source:'manual',startDate:'2026-10-03',scheduleTimeZone:profile.timeZone,goalSnapshot:{goal:''},durationWeeks:1,daysPerWeek:1,
   days:[{dayId:crypto.randomUUID(),weekIndex:1,dayOfWeek:6,exercises:[{exerciseId:'d16325d9-fc00-4c41-88a1-000000000001',order:0,targetSets:[{metricType:'reps_load',reps:8,loadGrams:0}]}]}]});
 });
 await page.goto('/workout'); await page.getByRole('button',{name:'Start planned workout',exact:true}).first().click();
 await page.getByLabel('Reps').fill('8');await page.getByLabel('Load (kg)').fill('0');
 await page.getByRole('button',{name:'Record set',exact:true}).click();
 await expect(page.getByRole('status')).toHaveText('Set saved');
 await page.getByRole('button',{name:'Review completion',exact:true}).click();
 await page.getByRole('button',{name:'Confirm completion',exact:true}).click();
 await expect(page.getByRole('status')).toHaveText('Workout completed');
 await page.goto('/plans?tab=legacy');await expect(page.getByRole('list',{name:'Schedule'})).toContainText('completed');
});
test('removal cancellation preserves facts; confirmed removal persists and terminal workouts have no removal controls', async ({page}) => {
 await page.goto('/workout');
 await page.getByRole('button',{name:'Start temporary workout',exact:true}).click();
 await page.getByLabel('Reps').fill('9');await page.getByLabel('Load (kg)').fill('1');
 await page.getByRole('button',{name:'Record set',exact:true}).click();
 await expect(page.getByRole('status')).toHaveText('Set saved');
 page.once('dialog',dialog=>dialog.dismiss());
 await page.getByRole('button',{name:'Remove saved set',exact:true}).click({timeout:5000});
 await expect(page.getByText('9 reps · 1 kg',{exact:true})).toBeVisible();
 await page.reload();await expect(page.getByText('9 reps · 1 kg',{exact:true})).toBeVisible();
 page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'Remove saved set',exact:true}).click();
 await expect(page.getByRole('status')).toHaveText('Saved set removed');
 await page.reload();await expect(page.getByRole('button',{name:'Remove saved set',exact:true})).toHaveCount(0);
 await page.getByLabel('Reps').fill('7');await page.getByLabel('Load (kg)').fill('0');
 await page.getByRole('button',{name:'Record set',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Set saved');
 page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'Remove exercise',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Goblet squat',exact:true})).toBeVisible();
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Remove exercise',exact:true}).click();
 await expect(page.getByRole('status')).toHaveText('Exercise removed');
 await page.reload();await expect(page.getByRole('heading',{name:'Goblet squat',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Add exercise',exact:true}).click();
 await page.getByLabel('Reps').fill('5');await page.getByLabel('Load (kg)').fill('0');
 await page.getByRole('button',{name:'Record set',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Set saved');
 await page.getByRole('button',{name:'Review completion',exact:true}).click();
 await page.getByRole('button',{name:'Confirm completion',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Workout completed');
 await expect(page.getByRole('button',{name:'Remove saved set',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Remove exercise',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Start another workout',exact:true}).click();
 await page.getByRole('button',{name:'Start temporary workout',exact:true}).click();
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Abandon workout',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Workout abandoned');
 await expect(page.getByRole('button',{name:'Remove saved set',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Remove exercise',exact:true})).toHaveCount(0);
});
