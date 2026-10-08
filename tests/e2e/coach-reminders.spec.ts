import {test,expect} from '@playwright/test';
import {completedPlanningProfile} from './planning-profile-fixture';
test('real reminder sources: atomic claims, edits, training suppression, snooze and portable backup isolation',async({page,context})=>{
 await completedPlanningProfile(page);
 const fixture=await page.evaluate(async()=>{
  const r='/src/persistence/repository.ts',d='/src/application/day-plans.ts',c='/src/application/coach-reminders.ts',e='/src/catalog/exercises.ts',t='/src/domain/coach-reminders.ts';
  const {repository}=await import(/* @vite-ignore */r),{createDayPlanService}=await import(/* @vite-ignore */d),{coachReminderService}=await import(/* @vite-ignore */c),{exercises}=await import(/* @vite-ignore */e),{zonedMinute}=await import(/* @vite-ignore */t);
  const p=await repository.db.profiles.toCollection().first(),now=Date.now()+2*86400000,slot=zonedMinute(now+3600000,p.timeZone),exercise=exercises.find((x:any)=>x.metricType==='reps'&&x.equipment==='none');
  const saved=await createDayPlanService(repository).saveDayPlan({name:'Reminder fixture',date:slot.day,timeZone:p.timeZone,startTime:slot.time,durationMinutes:30,exercises:[{exerciseId:exercise.id,order:0,targetSets:[{metricType:'reps',reps:8}]}]});
  const l=await coachReminderService.preferences();await coachReminderService.preferences({...l.preferences,quietStart:'00:00',quietEnd:'00:00'});
  return {now,taskId:saved.task.id,profileId:p.id};
 });
 const sibling=await context.newPage();await sibling.goto('/settings');
 const claim=async(p:typeof page)=>p.evaluate(async(now)=>{const path='/src/application/coach-reminders.ts';const{coachReminderService:s}=await import(/* @vite-ignore */path);return s.evaluate({now,foreground:true,focused:true,chat:false,modal:false,idleSince:now});},fixture.now);
 const results=await Promise.all([claim(page),claim(sibling)]);expect(results.filter(r=>r.record).length).toBe(1);const record=results.find(r=>r.record)!.record!;expect(record.taskId).toBe(fixture.taskId);
 const checked=await page.evaluate(async({record,now})=>{const c='/src/application/coach-reminders.ts',r='/src/persistence/repository.ts',b='/src/application/backup.ts';const{coachReminderService:s}=await import(/* @vite-ignore */c),{repository}=await import(/* @vite-ignore */r),{createBackupService}=await import(/* @vite-ignore */b);await s.act(record.id,'snoozed',now);const ledger=await s.preferences();const backup=JSON.parse(await (await createBackupService(repository).exportBackup()).text());const before=await repository.readMetadata();await s.evaluate({now:now+1000,foreground:true,focused:true,chat:false,modal:false,idleSince:0});const after=await repository.readMetadata();return{snooze:ledger.snoozeUntil,record:ledger.records.find((x:any)=>x.id===record.id),backupKeys:Object.keys(backup.data),sameRevision:before.dataRevision===after.dataRevision};},{record,now:fixture.now});
 expect(checked.snooze).toBe(fixture.now+4*3600000);expect(checked.record.status).toBe('snoozed');expect(checked.backupKeys).not.toContain('coachDevice');expect(checked.sameRevision).toBe(true);
 await sibling.close();
});
test('coach lifecycle rejects stale confirmation and retains scheduled task facts',async({page})=>{
 await completedPlanningProfile(page);
 const result=await page.evaluate(async()=>{
 const r='/src/persistence/repository.ts',d='/src/application/day-plans.ts',c='/src/application/coach-plans.ts',g='/src/application/guided.ts',e='/src/catalog/exercises.ts';
 const {repository}=await import(/* @vite-ignore */r),{createDayPlanService}=await import(/* @vite-ignore */d),{coachPlanService}=await import(/* @vite-ignore */c),{guidedService}=await import(/* @vite-ignore */g),{exercises}=await import(/* @vite-ignore */e);
 const p=await repository.db.profiles.toCollection().first(),exercise=exercises.find((x:any)=>x.metricType==='reps'&&x.equipment==='none');
 const saved=await createDayPlanService(repository).saveDayPlan({name:'Coach lifecycle',date:'2027-01-01',timeZone:p.timeZone,startTime:'12:00',durationMinutes:30,exercises:[{exerciseId:exercise.id,order:0,targetSets:[{metricType:'reps',reps:8}]}]});
 const gen=(await repository.readMetadata()).restoreGeneration??0,ctx=await guidedService.capturePlanContext();await coachPlanService.lifecycle(saved.plan.id,saved.plan.revision,gen,'paused','User confirmed',ctx);
 let stale=false;try{await coachPlanService.lifecycle(saved.plan.id,saved.plan.revision,gen,'terminated','Stale confirmation',ctx);}catch{stale=true;}
 const paused=(await guidedService.read()).programs.find((x:any)=>x.planIds.includes(saved.plan.id)).status;
 await coachPlanService.lifecycle(saved.plan.id,saved.plan.revision,gen,'terminated','Confirmed cancellation',await guidedService.capturePlanContext());
 const task=await repository.db.scheduledWorkouts.get(saved.task.id);return{paused,stale,taskStatus:task.status,planStatus:(await repository.db.plans.get(saved.plan.id)).status};
 });expect(result).toEqual({paused:'paused',stale:true,taskStatus:'pending',planStatus:'archived'});
});

test('real completion, restore, changed-time cancellation and same-task deduplication',async({page})=>{
 await page.goto('/settings');const result=await page.evaluate(async()=>{const p='/tests/e2e/helpers/coach-sources.ts';return(await import(/* @vite-ignore */p)).verifyCoachSources();});
 expect(result).toEqual({noInventedCompletion:true,trainingSuppressed:true,completionIsReal:true,restoredFacts:true,restoredCancelled:true,preferencesPreserved:true,countPreserved:true,actualTask:true,movedCancelled:true,noReplay:true});
});
