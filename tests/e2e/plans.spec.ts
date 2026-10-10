import { seedLegacyPlan } from './helpers/legacy-plan';
import { test, expect } from '@playwright/test';
test.use({locale:'en-US'});
test.setTimeout(20000);
// Preserve the real IndexedDB contract after retiring the legacy presentation.
test.beforeEach(async({page})=>{await page.goto("/tests/e2e/helpers/capacity-entry.html");});
test('catalog metric mismatch rejects atomically',async({page})=>{
 await page.goto('/tests/e2e/helpers/capacity-entry.html');const result=await page.evaluate(async()=>{const path='/tests/e2e/helpers/plans-browser.ts';const fixture=await import(/* @vite-ignore */ path);return fixture.rejectMetricMismatch(`fitness-test-metrics-${crypto.randomUUID()}`);});
 expect(result).toEqual({code:'INVALID',plans:0,versions:0,schedules:0,unchanged:true});
});
test('real IndexedDB plans preserve snapshots and force drafts during training',async({page})=>{
 await page.goto('/tests/e2e/helpers/capacity-entry.html');const result=await page.evaluate(async()=>{const path='/tests/e2e/helpers/plans-browser.ts';const fixture=await import(/* @vite-ignore */ path);return fixture.exercisePlans(`fitness-test-plans-${crypto.randomUUID()}`);});
 expect(result).toEqual({oldStatus:'archived',activeCount:1,draftStatus:'draft',blocked:true,originalDate:'2026-10-07',scheduledDate:'2026-10-08',conflict:true,immutable:true,invalid:true,rolledBack:true,activeEditBlocked:true,editPreservesVersion:true});
});
