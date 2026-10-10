import { seedLegacyPlan } from './helpers/legacy-plan';
import { expect, test } from '@playwright/test';
// Preserve the real IndexedDB contract after retiring the legacy presentation.
test.beforeEach(async({page})=>{await page.goto("/tests/e2e/helpers/capacity-entry.html");});
test('plan deletion preserves history, rejects stale and ongoing writes, rolls back and round-trips backups', async ({ page }) => {
  await page.goto('/tests/e2e/helpers/capacity-entry.html');
  const result = await page.evaluate(async () => {
    const path = '/tests/e2e/helpers/plan-delete-browser.ts';
    return (await import(/* @vite-ignore */ path)).verifyPlanDeletion();
  });
  expect(result).toEqual({ conflict: true, rollback: true, removed: true, blocked: true, ongoingUnchanged: true, retained: true, archived: true, cannotEdit: true, cannotStart: true, cannotReschedule: true, noActiveSchedule: true, roundTrip: true });
});
