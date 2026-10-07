import { seedLegacyPlan } from './helpers/legacy-plan';
import { test, expect } from '@playwright/test';
test.use({locale:'en-US'});
test.setTimeout(20000);
test('catalog metric mismatch rejects atomically',async({page})=>{
 await page.goto('/plans');const result=await page.evaluate(async()=>{const path='/tests/e2e/helpers/plans-browser.ts';const fixture=await import(/* @vite-ignore */ path);return fixture.rejectMetricMismatch(`fitness-test-metrics-${crypto.randomUUID()}`);});
 expect(result).toEqual({code:'INVALID',plans:0,versions:0,schedules:0,unchanged:true});
});
test('retained canonical targets are read-only and manual creation is absent',async({page})=>{
 await page.goto('/plans');
 await page.evaluate(async()=>{
  const {profileService}=await import(String('/src/application/profile.ts'));
  const {planService}=await import(String('/src/application/plans.ts'));
  await profileService.initialize('en');
  await planService.savePlan({name:'Metric boundary',source:'manual',startDate:'2026-10-05',scheduleTimeZone:'UTC',goalSnapshot:{goal:''},durationWeeks:1,daysPerWeek:1,days:[{dayId:crypto.randomUUID(),weekIndex:1,dayOfWeek:1,exercises:[
   {exerciseId:'d16325d9-fc00-4c41-88a1-000000000001',order:0,targetSets:[{metricType:'reps_load',reps:10,loadGrams:1250}]},
   {exerciseId:'d16325d9-fc00-4c41-88a1-000000000002',order:1,targetSets:[{metricType:'duration_distance',durationSeconds:600,distanceMeters:1200}]}]}]});
 });
 await page.reload();
 await expect(page.getByLabel('Plan name',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'view schedule',exact:true}).click();
 const view=page.getByRole('region',{name:'read-only schedule'});
 await expect(view).toContainText('1.25 kg');
 await expect(view).toContainText('1.2 km');
 const targets=await page.evaluate(async()=>{const path='/tests/e2e/helpers/plans-browser.ts';return (await import(/* @vite-ignore */ path)).readActiveTargets();});
 expect(targets).toEqual([{metricType:'reps_load',reps:10,loadGrams:1250},{metricType:'duration_distance',durationSeconds:600,distanceMeters:1200}]);
});

test('real IndexedDB plans preserve snapshots and force drafts during training',async({page})=>{
 await page.goto('/plans');const result=await page.evaluate(async()=>{const path='/tests/e2e/helpers/plans-browser.ts';const fixture=await import(/* @vite-ignore */ path);return fixture.exercisePlans(`fitness-test-plans-${crypto.randomUUID()}`);});
 expect(result).toEqual({oldStatus:'archived',activeCount:1,draftStatus:'draft',blocked:true,originalDate:'2026-10-07',scheduledDate:'2026-10-08',conflict:true,immutable:true,invalid:true,rolledBack:true,activeEditBlocked:true,editPreservesVersion:true});
});
test('retained legacy replacement and schedule controls preserve original date',async({page})=>{
 await page.goto('/plans');
 await seedLegacyPlan(page,'First');
 await seedLegacyPlan(page,'Second');
 await page.reload();
 await expect(page.getByRole('list',{name:'Saved plans'})).toContainText('First · archived');
 await expect(page.getByRole('list',{name:'Saved plans'})).toContainText('Second · active');
 const row=page.getByRole('list',{name:'Schedule'}).getByRole('listitem').first();
 await row.getByLabel('New date').fill('2026-10-08');await row.getByRole('button',{name:'Reschedule',exact:true}).click();
 await expect(row).toContainText('2026-10-05 → 2026-10-08');
 await row.getByRole('button',{name:'Skip',exact:true}).click(); await expect(row).toContainText('skipped');
 await page.reload();await expect(page.getByRole('list',{name:'Schedule'})).toContainText('2026-10-05 → 2026-10-08');
});
