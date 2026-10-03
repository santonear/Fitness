import { test, expect } from '@playwright/test';
test.use({locale:'en-US'});
test.setTimeout(20000);
test('catalog metric mismatch rejects atomically',async({page})=>{
 await page.goto('/plans');const result=await page.evaluate(async()=>{const path='/tests/e2e/helpers/plans-browser.ts';const fixture=await import(/* @vite-ignore */ path);return fixture.rejectMetricMismatch(`fitness-test-metrics-${crypto.randomUUID()}`);});
 expect(result).toEqual({code:'INVALID',plans:0,versions:0,schedules:0,unchanged:true});
});
test('manual editor converts kg and optional km into canonical saved targets',async({page})=>{
 await page.goto('/plans');await page.getByLabel('Plan name').fill('Metric boundary',{timeout:5000});
 await page.getByLabel('Choose exercise').selectOption('d16325d9-fc00-4c41-88a1-000000000001');
 await page.getByLabel('Load (kg)').fill('1.25',{timeout:5000});
 await page.getByRole('button',{name:'Add exercise',exact:true}).click();await page.getByLabel('Choose exercise').nth(1).selectOption('d16325d9-fc00-4c41-88a1-000000000002');
 await page.getByLabel('Distance (km, optional)').fill('1.2');await page.getByRole('button',{name:'Save plan',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Plan saved');
 const targets=await page.evaluate(async()=>{const path='/tests/e2e/helpers/plans-browser.ts';return (await import(/* @vite-ignore */ path)).readActiveTargets();});
 expect(targets).toEqual([{metricType:'reps_load',reps:10,loadGrams:1250},{metricType:'duration_distance',durationSeconds:600,distanceMeters:1200}]);
 await page.reload();await page.getByRole('list',{name:'Saved plans'}).getByRole('button',{name:'Edit',exact:true}).click();await expect(page.getByLabel('Load (kg)')).toHaveValue('1.25');await expect(page.getByLabel('Distance (km, optional)')).toHaveValue('1.2');
});
test('real IndexedDB plans preserve snapshots and force drafts during training',async({page})=>{
 await page.goto('/plans');const result=await page.evaluate(async()=>{const path='/tests/e2e/helpers/plans-browser.ts';const fixture=await import(/* @vite-ignore */ path);return fixture.exercisePlans(`fitness-test-plans-${crypto.randomUUID()}`);});
 expect(result).toEqual({oldStatus:'archived',activeCount:1,draftStatus:'draft',blocked:true,originalDate:'2026-10-07',scheduledDate:'2026-10-08',conflict:true,immutable:true,invalid:true,rolledBack:true,activeEditBlocked:true,editPreservesVersion:true});
});
test('manual plans need no profile and atomically replace active plans; reschedule preserves original date',async({page})=>{
 await page.goto('/plans');
 await page.getByLabel('Plan name').fill('First',{timeout:5000});
 await page.getByLabel('Start date').fill('2026-10-07');
 await page.getByRole('button',{name:'Save plan',exact:true}).click();
 await expect(page.getByRole('status')).toHaveText('Plan saved');
 await page.getByLabel('Plan name').fill('Second');
 await page.getByRole('button',{name:'Save plan',exact:true}).click();
 await expect(page.getByRole('list',{name:'Saved plans'})).toContainText('First · archived');
 await expect(page.getByRole('list',{name:'Saved plans'})).toContainText('Second · active');
 const row=page.getByRole('list',{name:'Schedule'}).getByRole('listitem').first();
 await row.getByLabel('New date').fill('2026-10-08');await row.getByRole('button',{name:'Reschedule',exact:true}).click();
 await expect(row).toContainText('2026-10-07 → 2026-10-08');
 await row.getByRole('button',{name:'Skip',exact:true}).click(); await expect(row).toContainText('skipped');
 await page.reload();await expect(page.getByRole('list',{name:'Schedule'})).toContainText('2026-10-07 → 2026-10-08');
});
