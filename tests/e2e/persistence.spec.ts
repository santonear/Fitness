import { test, expect } from '@playwright/test';
test.use({ locale: 'en-US' });
test.setTimeout(15_000);
// Preserve the real IndexedDB contract after retiring the legacy presentation.
test.beforeEach(async({page})=>{await page.goto("/tests/e2e/helpers/capacity-entry.html");});
test('real IndexedDB serializes revisions and rolls back failed writes', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const path = '/tests/e2e/helpers/persistence-browser.ts';
    const helper = await import(/* @vite-ignore */ path);
    return helper.exerciseConcurrency(`fitness-test-${crypto.randomUUID()}`);
  });
  expect(result).toEqual({ profileCount: 1, fulfilled: 1, codes: ['CONFLICT'], before: 3, after: 3, weights: 1, illegalIdentity: 'INVALID' });
});
test('existing version upgrades preserve facts and failed upgrades roll back', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const path = '/tests/e2e/helpers/persistence-browser.ts';
    const helper = await import(/* @vite-ignore */ path);
    return helper.exerciseUpgrade(`fitness-test-${crypto.randomUUID()}`);
  });
  expect(result).toEqual({ kept: 65000, rejected: true, intact: 65000, upgradedRevision: 4 });
});
