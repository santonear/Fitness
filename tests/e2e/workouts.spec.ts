import { test, expect } from '@playwright/test';
test.use({ locale: 'en-US' });
test.setTimeout(20000);
// Preserve the real IndexedDB contract after retiring the legacy presentation.
test.beforeEach(async({page})=>{await page.goto("/tests/e2e/helpers/capacity-entry.html");});
test('two connections serialize starts and revisions; facts, memo and global revision roll back together', async ({ page }) => {
 await page.goto('/tests/e2e/helpers/capacity-entry.html');
 const result = await page.evaluate(async () => { const path='/tests/e2e/helpers/workouts-browser.ts'; return (await import(/* @vite-ignore */ path)).verifyWorkoutTransactions(`fitness-test-workouts-${crypto.randomUUID()}`); });
 expect(result).toEqual({ starts:1, conflicts:1, sets:1, memoSets:1, rolledBack:true, completed:true, readonly:true, mismatch:true, replacementConfirmed:true, originalPreserved:true, abandoned:true, rebuilt:true });
});
