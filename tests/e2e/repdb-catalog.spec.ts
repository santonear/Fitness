import { expect, test } from '@playwright/test';
test.use({ locale: 'en-US' });

test('RepDB filters, dual and single images, credits and three layouts', async ({ page }) => {
  await page.goto('/exercises');
  await expect(page.locator('.v31-exercise-card')).toHaveCount(24);
  await expect(page.getByText('639 exercises', { exact: true })).toBeVisible();
  await page.getByRole('searchbox').fill('Arnold');
  const card = page.locator('.v31-exercise-card').first();
  await card.getByRole('button', { name: 'View exercise details', exact: true }).click();
  await expect(card.locator('.v31-exercise-detail ol li').first()).toBeVisible();
  await expect(card.locator('.v31-exercise-detail .repdb-media img')).toHaveCount(2);
  for (const img of await card.locator('.repdb-media img').all()) await expect.poll(() => img.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
  await expect(card.locator('.v31-exercise-detail .repdb-attribution a')).toHaveAttribute('href', 'https://repdb.co/');
  await card.getByRole('button', { name: /Favorite/ }).click();
  await page.reload(); await page.getByLabel('Favorites only', { exact: true }).check();
  await expect(page.locator('.v31-exercise-card')).toHaveCount(1);
  await page.getByLabel('Favorites only', { exact: true }).uncheck();
  await page.getByRole('searchbox').fill('Air Bike');
  await expect(page.locator('.v31-exercise-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'View exercise details', exact: true }).click();
  await expect(page.locator('.v31-exercise-detail .repdb-media img')).toHaveCount(1);
  for (const theme of ['atlas', 'serene', 'orbit']) {
    await page.locator('.v31-quick-theme select').selectOption(theme);
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 850 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `outputs/repdb/${theme}-${width}-${test.info().project.name}.png`, fullPage: true });
    }
  }
  await page.goto('/settings?tab=appearance');
  await expect(page.getByRole('region', { name: 'About & credits' }).getByRole('link', { name: 'RepDB', exact: true })).toHaveAttribute('href', 'https://repdb.co/');
});

test('failed RepDB image preserves details and attribution', async ({ page }) => {
  await page.route('**/exercise-media/repdb/*.webp', route => route.abort());
  await page.goto('/exercises'); await page.getByRole('searchbox').fill('Arnold');
  await page.getByRole('button', { name: 'View exercise details', exact: true }).first().click();
  const detail = page.locator('.v31-exercise-detail');
  await expect(detail.getByText('Image unavailable. Read the exercise instructions.').first()).toBeVisible();
  await expect(detail.locator('ol li').first()).toBeVisible();
  await expect(detail.getByRole('link', { name: 'RepDB', exact: true })).toBeVisible();
});

test('new manual movement survives backup round trip alongside an existing plan', async ({ page }) => {
  await page.goto('/exercises');
  const result = await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path);
    const { profileService } = await load('/src/application/profile.ts');
    const { dayPlanService } = await load('/src/application/day-plans.ts');
    const { backupService } = await load('/src/application/backup.ts');
    const { repository } = await load('/src/persistence/repository.ts');
    const { exercises } = await load('/src/catalog/exercises.ts');
    const profile = await profileService.initialize('en');
    const old = { exerciseId: exercises[2].id, order: 0, targetSets: [{ metricType: 'reps', reps: 8 }] };
    const added = exercises.find((row: { name: { en: string } }) => row.name.en === 'Arnold Press');
    if (!added) throw Error('Missing imported exercise');
    await dayPlanService.saveDayPlan({ date: '2027-01-04', timeZone: profile.timeZone, name: 'Legacy preserved', exercises: [old] });
    await dayPlanService.saveDayPlan({ date: '2027-01-05', timeZone: profile.timeZone, name: 'Imported movement', exercises: [{ exerciseId: added.id, order: 0, targetSets: [{ metricType: 'reps_load', reps: 8, loadGrams: 2000 }] }] });
    const backup = await backupService.exportBackup(); const serialized = await backup.text();
    const preview = await backupService.validateBackup(new File([backup], 'catalog.json'));
    await backupService.importBackup(preview, { backupExported: true, replacementConfirmed: true, expectedRevision: preview.expectedRevision });
    const versions = await repository.db.planVersions.toArray();
    return { ids: versions.flatMap((v: { days: { exercises: { exerciseId: string }[] }[] }) => v.days.flatMap(d => d.exercises.map(e => e.exerciseId))), added: added.id, old: old.exerciseId, providerInBackup: /exercise-media|sourceVersion|RepDB/.test(serialized) };
  });
  expect(result.ids).toEqual(expect.arrayContaining([result.added, result.old]));
  expect(result.providerInBackup).toBe(false);
});
