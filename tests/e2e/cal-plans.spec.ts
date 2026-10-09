import { expect, test } from '@playwright/test';
test('day plans preserve distinct content, slot identities and backups', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const path = '/src/application/day-plans.ts'; const { dayPlanService } = await import(/* @vite-ignore */ path);
    const p = '/src/persistence/repository.ts'; const { repository } = await import(/* @vite-ignore */ p);
    const b = '/src/application/backup.ts'; const { backupService } = await import(/* @vite-ignore */ b);
    const f = '/src/application/profile.ts'; const { profileService } = await import(/* @vite-ignore */ f); await profileService.initialize('en');
    const profile = await repository.db.profiles.toCollection().first();
    const item = { exerciseId: 'd16325d9-fc00-4c41-88a1-000000000003', order: 0, targetSets: [{ metricType: 'reps', reps: 10 }], notes: '原备注' };
    const first = await dayPlanService.saveDayPlan({ date: '2027-01-04', timeZone: profile.timeZone, name: 'A', exercises: [item] });
    const second = await dayPlanService.saveDayPlan({ date: '2027-02-02', timeZone: profile.timeZone, name: 'B', exercises: [{ ...item, notes: '独立备注' }] });
    const conflict = await dayPlanService.saveDayPlan({ date: '2027-01-04', timeZone: profile.timeZone, name: 'duplicate', exercises: [item] }).then(() => 'bad', (e: {code:string}) => e.code);
    await dayPlanService.skipDayPlan(first.task.id, first.task.revision);
    const replacement = await dayPlanService.saveDayPlan({ date: '2027-01-04', timeZone: profile.timeZone, name: 'C', exercises: [item] });
    const saved = await backupService.exportBackup(); const preview = await backupService.validateBackup(new File([saved], 'cal.json'));
    await backupService.importBackup(preview, { backupExported: true, replacementConfirmed: true, expectedRevision: preview.expectedRevision });
    return { conflict, separate: first.task.id !== replacement.task.id, plans: await repository.db.plans.count(), rows: await repository.db.scheduledWorkouts.count(),
      notes: (await repository.db.planVersions.get(second.plan.currentVersionId)).days[0].exercises[0].notes, version: JSON.parse(await saved.text()).schemaVersion };
  });
  expect(result).toEqual({ conflict: 'CONFLICT', separate: true, plans: 3, rows: 3, notes: '独立备注', version: 6 });
});
test('legacy collision requires a current explicit confirmation and preserves both tasks', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const a = '/src/application/profile.ts'; const { profileService } = await import(/* @vite-ignore */ a); const profile = await profileService.initialize('en');
    const d = '/src/application/day-plans.ts'; const { dayPlanService } = await import(/* @vite-ignore */ d);
    const p = '/src/application/plans.ts'; const { planService } = await import(/* @vite-ignore */ p);
    const r = '/src/persistence/repository.ts'; const { repository } = await import(/* @vite-ignore */ r);
    const c = '/src/application/legacy-collisions.ts'; const { prepareLegacyOperation } = await import(/* @vite-ignore */ c);
    const item = { exerciseId: 'd16325d9-fc00-4c41-88a1-000000000003', order: 0, targetSets: [{ metricType: 'reps', reps: 10 }] };
    const legacy = await planService.savePlan({ name: 'legacy', source: 'manual', startDate: '2027-01-04', scheduleTimeZone: profile.timeZone, goalSnapshot: {goal:''}, durationWeeks: 1, daysPerWeek: 1, days: [{dayId:crypto.randomUUID(),weekIndex:1,dayOfWeek:1,exercises:[item]}] });
    const row = await repository.db.scheduledWorkouts.where('planVersionId').equals(legacy.currentVersionId).first();
    await planService.skipWorkout(row.id,row.revision);
    const day = await dayPlanService.saveDayPlan({ name:'new',date:'2027-01-04',timeZone:profile.timeZone,exercises:[item] });
    const revision = (await repository.db.scheduledWorkouts.get(row.id)).revision;
    const missing = await planService.rescheduleWorkout(row.id,'2027-01-04',revision).then(()=> 'bad',(e:{code:string})=>e.code);
    const preview = await prepareLegacyOperation({type:'reschedule',id:row.id,date:'2027-01-04'});
    await planService.rescheduleWorkout(row.id,'2027-01-04',revision,preview.confirmation);
    const stale = await planService.rescheduleWorkout(row.id,'2027-01-04',revision+1,preview.confirmation).then(()=> 'bad',(e:{code:string})=>e.code);
    return {missing,stale,collisions:preview.collisions.length,rows:await repository.db.scheduledWorkouts.count(),newPlanPresent:Boolean(await repository.db.plans.get(day.plan.id))};
  });
  expect(result).toEqual({missing:'LEGACY_CONFIRMATION_REQUIRED',stale:'CONFLICT',collisions:1,rows:2,newPlanPresent:true});
});
