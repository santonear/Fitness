import { expect, test } from '@playwright/test';

test('concurrent dates, transaction failure and restored stale actions preserve the library', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path);
    const { profileService } = await load('/src/application/profile.ts'); const profile = await profileService.initialize('en');
    const { dayPlanService } = await load('/src/application/day-plans.ts');
    const { repository } = await load('/src/persistence/repository.ts'); const { backupService } = await load('/src/application/backup.ts');
    const input = { name:'Safety', date:'2027-04-03', timeZone:profile.timeZone, exercises:[{exerciseId:'d16325d9-fc00-4c41-88a1-000000000003',order:0,targetSets:[{metricType:'reps',reps:10}]}] };
    const attempts = await Promise.allSettled([dayPlanService.saveDayPlan(input),dayPlanService.saveDayPlan(input)]);
    const saved = attempts.find(value=>value.status==='fulfilled')! as PromiseFulfilledResult<any>;
    const snapshot = () => repository.db.transaction('r',repository.db.tables,async()=>JSON.stringify(await Promise.all(repository.db.tables.map((table:any)=>table.toArray()))));
    const factsBefore = await snapshot(); const before = await backupService.exportBackup();
    const add = repository.db.planVersions.add; repository.db.planVersions.add = async () => {throw new DOMException('Synthetic quota failure','QuotaExceededError');};
    const failure = await dayPlanService.saveDayPlan({...input,date:'2027-04-04'}).then(()=> 'bad',(error:{code:string})=>error.code);
    repository.db.planVersions.add = add;
    const factsAfter = await snapshot();
    const generation = (await repository.readMetadata()).restoreGeneration ?? 0;
    const preview = await backupService.validateBackup(new File([before],'safety.json'));
    await backupService.importBackup(preview,{backupExported:true,replacementConfirmed:true,expectedRevision:preview.expectedRevision});
    const stale = await dayPlanService.rescheduleDayPlan(saved.value.task.id,'2027-04-05',saved.value.task.revision,generation).then(()=> 'bad',(error:{code:string})=>error.code);
    return {successes:attempts.filter(value=>value.status==='fulfilled').length,failure,unchanged:factsBefore===factsAfter,stale,date:(await repository.db.scheduledWorkouts.get(saved.value.task.id)).scheduledDate};
  });
  expect(result).toEqual({successes:1,failure:'STORAGE_FULL',unchanged:true,stale:'CONFLICT',date:'2027-04-03'});
});

test('ambiguous legacy days require review only for overlapping dates', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const load = (path:string)=>import(/* @vite-ignore */ path);
    const {profileService}=await load('/src/application/profile.ts'); await profileService.initialize('en');
    const {repository}=await load('/src/persistence/repository.ts');
    await repository.write(async()=>{const profile=await repository.db.profiles.toCollection().first();await repository.db.profiles.put({...profile,timeZone:'UTC'});});
    const {planService}=await load('/src/application/plans.ts'); const {dayPlanService}=await load('/src/application/day-plans.ts');
    const item={exerciseId:'d16325d9-fc00-4c41-88a1-000000000003',order:0,targetSets:[{metricType:'reps',reps:10}]};
    // A legal legacy draft becomes an active legacy fixture without any new-day mapping.
    const legacy=await planService.savePlan({name:'Ambiguous legacy fixture',source:'manual',status:'draft',startDate:'2027-01-04',scheduleTimeZone:'Etc/GMT+12',goalSnapshot:{goal:''},durationWeeks:1,daysPerWeek:1,days:[{dayId:crypto.randomUUID(),weekIndex:1,dayOfWeek:1,exercises:[item]}]});
    await repository.write(async()=>{await repository.db.plans.update(legacy.id,{status:'active'});});
    const unrelated=await dayPlanService.saveDayPlan({name:'Unrelated',date:'2027-02-02',timeZone:'UTC',exercises:[item]}).then(()=> 'saved',(error:{code:string})=>error.code);
    const overlap=await dayPlanService.saveDayPlan({name:'Needs review',date:'2027-01-04',timeZone:'UTC',exercises:[item]}).then(()=> 'bad',(error:{code:string})=>error.code);
    return {unrelated,overlap,legacyPresent:Boolean(await repository.db.plans.get(legacy.id))};
  });
  expect(result).toEqual({unrelated:'saved',overlap:'CALENDAR_PROVENANCE_MISSING',legacyPresent:true});
});
