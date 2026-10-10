import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

for (const name of ['v5-plans-weight', 'v62-plans-weight', 'v71-plans-weight', 'v71-coach-plan']) {
  test(`DB7 upgrade and old/V8 restore preserve real UI backup ${name}`, async ({ page }) => {
    const envelope = JSON.parse(readFileSync(new URL(`../fixtures/legacy-backups/${name}.json`, import.meta.url), 'utf8'));
    await page.goto('/');
    const result = await page.evaluate(async source => {
      const path = '/tests/e2e/helpers/v8-migration-browser.ts';
      return (await import(/* @vite-ignore */ path)).verifyV8Migration(source);
    }, envelope);
    expect(result).toEqual({ unchanged: true, idempotent: true, readOnly: true, schemaVersion: 9, envelopeVersion: 7,
      planCount: envelope.data.plans.filter((plan: { deletedAt?: string }) => !plan.deletedAt).length,
      noticeCount: envelope.data.plans.filter((plan: { deletedAt?: string }) => !plan.deletedAt).length,
      noticeCleared: true, historyCount: envelope.data.sessions.length, oldRestoreSame: true, roundTrip: true, reminderPreserved: true, restoreRejected: true, restoreRolledBack: true, invalidDurationsExcluded: true, notesPreserved: true });
  });
}
test('failed DB upgrade rolls back all tables and retains schema 7', async ({ page }) => {
  const envelope = JSON.parse(readFileSync(new URL('../fixtures/legacy-backups/v71-coach-plan.json', import.meta.url), 'utf8'));
  await page.goto('/');
  const result = await page.evaluate(async source => {
    const path = '/tests/e2e/helpers/v8-migration-browser.ts';
    return (await import(/* @vite-ignore */ path)).verifyV8Migration(source, true);
  }, envelope);
  expect(result).toEqual({ rejected: true, unchanged: true, version: 7 });
});

test('historical duration anomalies survive upgrade and restore without entering elapsed statistics', async ({ page }) => {
  const envelope = JSON.parse(readFileSync(new URL('../fixtures/legacy-backups/v71-plans-weight.json', import.meta.url), 'utf8'));
  for (const [index, elapsed] of [-1000, 43201000].entries()) envelope.data.sessions[index].completedAt = new Date(Date.parse(envelope.data.sessions[index].startedAt) + elapsed).toISOString();
  envelope.data.scheduledWorkouts[0].durationMinutes = 'historical unknown';
  envelope.data.scheduledWorkouts[1].durationMinutes = 32.5;
  await page.goto('/');
  const result = await page.evaluate(async source => {
    const path = '/tests/e2e/helpers/v8-migration-browser.ts';
    return (await import(/* @vite-ignore */ path)).verifyV8Migration(source);
  }, envelope);
  expect(result).toMatchObject({ unchanged: true, invalidDurationsExcluded: true, oldRestoreSame: true, roundTrip: true, restoreRolledBack: true, notesPreserved: true });
});
