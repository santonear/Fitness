import { test, expect } from '@playwright/test';
test.use({locale:'en-US'});
// Preserve the real IndexedDB contract after retiring the legacy presentation.
test.beforeEach(async({page})=>{await page.goto("/tests/e2e/helpers/capacity-entry.html");});
test('timer writes guard revisions and association without creating training facts',async({page})=>{
 await page.goto('/tests/e2e/helpers/capacity-entry.html');
 const result=await page.evaluate(async()=>{const path='/tests/e2e/helpers/timers-browser.ts';return (await import(/* @vite-ignore */ path)).verifyTimerWrites(`fitness-test-timer-${crypto.randomUUID()}`);});
 expect(result).toEqual({count:1,conflicts:1,invalid:true,moved:true,readonly:true,sets:0,memoSets:0});
});
