import { test,expect } from '@playwright/test';
test('V3 batch writes are atomic; candidate saves are independent, deduplicated and restore-safe',async({page})=>{
  await page.goto('/');
  const result=await page.evaluate(async()=>{const path='/tests/e2e/v31-transactions-browser.ts';return (await import(/* @vite-ignore */path)).transactions()});
  expect(result).toEqual({collision:true,rollback:true,preserved:true,duplicate:true,count:2,times:['12:00','14:00','19:00'],tooLong:true,restoreBlocked:true,backupVersion:6});
});
