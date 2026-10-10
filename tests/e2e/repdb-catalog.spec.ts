import { expect, test } from '@playwright/test';
test.use({ locale: 'en-US' });
// Preserve the real IndexedDB contract after retiring the legacy presentation.
test.beforeEach(async({page})=>{await page.goto("/tests/e2e/helpers/capacity-entry.html");});
test('new manual movement survives backup round trip alongside an existing plan', async ({ page }) => {
  await page.goto('/tests/e2e/helpers/capacity-entry.html');
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
