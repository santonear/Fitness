import { expect, test } from '@playwright/test';
test('V3 manual batch exceeding backup capacity rolls back every write and revision', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => { const path = '/tests/e2e/v31-day-plan-safety-browser.ts'; return (await import(/* @vite-ignore */ path)).verifyDayPlanSafety('capacity'); });
  expect(result).toEqual({ error: 'BACKUP_TOO_LARGE', unchanged: true, priorStillExportable: true });
});
test('V3 known active and rest seconds fit the effective duration without inventing missing timing', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => { const path = '/tests/e2e/v31-day-plan-safety-browser.ts'; return (await import(/* @vite-ignore */ path)).verifyDayPlanSafety('duration'); });
  expect(result).toEqual({ excessive: 'INVALID', allRolledBack: true, knownTarget: 'INVALID', boundaryDuration: 1, inherited: 'INVALID', unknownTimingPreserved: true, exportable: true });
});
