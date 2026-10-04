import { test, expect } from '@playwright/test';
test('day schedule coexistence and completed-hidden slot preserve facts and memo', async ({page})=>{
  await page.goto('/');
  const facts=await page.evaluate(async()=>{
    const p='/src/application/profile.ts';const {profileService}=await import(/* @vite-ignore */ p);const profile=await profileService.initialize('en');
    const d='/src/application/day-plans.ts';const {dayPlanService}=await import(/* @vite-ignore */ d);
    const w='/src/application/workouts.ts';const {workoutService}=await import(/* @vite-ignore */ w);
    const r='/src/persistence/repository.ts';const {repository}=await import(/* @vite-ignore */ r);
    const b='/src/application/backup.ts';const {backupService}=await import(/* @vite-ignore */ b);
    const item={exerciseId:'d16325d9-fc00-4c41-88a1-000000000003',order:0,targetSets:[{metricType:'reps',reps:12}],notes:'计划备注'};
    const first=await dayPlanService.saveDayPlan({date:'2027-01-04',timeZone:profile.timeZone,name:'A',exercises:[item]});
    await dayPlanService.saveDayPlan({date:'2027-02-02',timeZone:profile.timeZone,name:'B',exercises:[item]});
    const available=(await workoutService.listAvailableSchedule()).length;
    let session=await workoutService.startWorkout({sessionId:crypto.randomUUID(),localDate:'2027-01-05',timeZone:profile.timeZone,scheduledWorkoutId:first.task.id});
    session=await workoutService.recordSet(session.id,{id:crypto.randomUUID(),exerciseInstanceId:session.exerciseSnapshots[0].exerciseInstanceId,order:0,metricType:'reps',reps:11,completed:true,notes:'实际备注'},session.revision);
    session=await workoutService.completeWorkout(session.id,session.revision);
    const task=await repository.db.scheduledWorkouts.get(first.task.id);await dayPlanService.hideDayPlan(task.id,task.revision);
    const blocked=await dayPlanService.saveDayPlan({date:'2027-01-04',timeZone:profile.timeZone,name:'duplicate',exercises:[item]}).then(()=>'bad',(e:{code:string})=>e.code);
    const blob=await backupService.exportBackup();const preview=await backupService.validateBackup(new File([blob],'day.json'));await backupService.importBackup(preview,{backupExported:true,replacementConfirmed:true,expectedRevision:preview.expectedRevision});
    const saved=await repository.db.sessions.get(session.id);const memo=await repository.db.trainingMemo.get(1);
    return {available,blocked,status:saved.status,snapshot:saved.originalExerciseSnapshots[0].notes,actualDate:saved.localDate,completedTask:(await repository.db.scheduledWorkouts.get(first.task.id)).completedSessionId,
      id:session.id,memoNote:memo.sessions[0].sets[0].notes,model:memo.sessions[0].planVersionSnapshot.model};
  });
  expect(facts).toMatchObject({available:2,blocked:'CONFLICT',status:'completed',snapshot:'计划备注',actualDate:'2027-01-05',memoNote:'实际备注',model:'date-day'});
  expect(facts.completedTask).toBe(facts.id);
});
