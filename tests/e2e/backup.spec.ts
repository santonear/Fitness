import { expect, test } from '@playwright/test';
test.use({ locale: 'en-US' });
test.setTimeout(30_000);
// Preserve the real IndexedDB contract after retiring the legacy presentation.
test.beforeEach(async({page})=>{await page.goto("/tests/e2e/helpers/capacity-entry.html");});
test('whole-store restore preserves facts, rebuilds memo, rejects invalid data, and rolls back failures', async ({ page }) => {
  await page.goto('/tests/e2e/helpers/capacity-entry.html');
  const result = await page.evaluate(async () => {
    const path = '/tests/e2e/helpers/backup-browser.ts';
    return (await import(/* @vite-ignore */ path)).verifyBackup(`backup-${crypto.randomUUID()}`);
  });
  expect(result).toEqual({ restored: true, memoRebuilt: true, notesPreserved: true, invalidRejected: true, confirmations: true, stalePreview: true, rollback: true, staleWriter: true, monotonic: true });
});
