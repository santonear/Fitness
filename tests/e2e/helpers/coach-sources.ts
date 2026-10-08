import {createDatabase} from '../../../src/persistence/db';
import {createRepository} from '../../../src/persistence/repository';
import {createProfileService} from '../../../src/application/profile';
import {createGuidedService} from '../../../src/application/guided';
import {createWorkoutService} from '../../../src/application/workouts';
import {createCoachReminderService} from '../../../src/application/coach-reminders';
import {createBackupService} from '../../../src/application/backup';
import {createDayPlanService} from '../../../src/application/day-plans';
import {zonedMinute} from '../../../src/domain/coach-reminders';
import {exercises,EXERCISE_IDS} from '../../../src/catalog/exercises';

function canonical(value:unknown):string{return JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);}
export async function verifyCoachSources(){
 const db=createDatabase('coach-source-'+crypto.randomUUID()),repo=createRepository(db);
 try{
  await createProfileService(repo).initialize('en');const guided=createGuidedService(repo),state=await guided.read();
  await repo.write(()=>db.guidedStates.put({...state,onboarding:{id:crypto.randomUUID(),step:0,answers:{},completed:true,updatedAt:new Date().toISOString()}}));
  const profile=(await db.profiles.toArray())[0],coach=createCoachReminderService(repo),workouts=createWorkoutService(repo),backup=createBackupService(repo);
  const prefs=(await coach.preferences()).preferences;await coach.preferences({...prefs,quietStart:'00:00',quietEnd:'00:00',side:'left'});
  const evaluate=(now:number,chat=false)=>coach.evaluate({now,foreground:true,focused:true,chat,modal:false,idleSince:now});
  const before=await evaluate(Date.now());const exercise=exercises.find(e=>e.metricType==='reps'&&e.equipment==='none')!;
  const session=await workouts.startWorkout({sessionId:crypto.randomUUID(),localDate:zonedMinute(Date.now(),profile.timeZone).day,timeZone:profile.timeZone,exerciseIds:[exercise.id]});
  const training=await evaluate(Date.now());const recorded=await workouts.recordSet(session.id,{id:crypto.randomUUID(),exerciseInstanceId:session.exerciseSnapshots[0].exerciseInstanceId,order:0,metricType:'reps',reps:8,completed:true},session.revision);await workouts.completeWorkout(session.id,recorded.revision);
  const completed=await evaluate(Date.now()+1000);const record=completed.record!;
  const blob=await backup.exportBackup(),checked=await backup.validateBackup(new File([blob],'coach.json'));
  const original=canonical(await db.sessions.toArray());await backup.importBackup(checked,{backupExported:true,replacementConfirmed:true,expectedRevision:checked.expectedRevision});
  const restored=await evaluate(Date.now()+2000,true);const ledger=await coach.preferences();
  // An actual scheduled day is invalidated when its start time changes; its old reminder is not replayed.
  const now=Date.now()+2*86400000,slot=zonedMinute(now+3600000,profile.timeZone);
  const saved=await createDayPlanService(repo).saveDayPlan({name:'Actual task',date:slot.day,timeZone:profile.timeZone,startTime:slot.time,durationMinutes:30,exercises:[{exerciseId:EXERCISE_IDS.bodyweightSquat,order:0,targetSets:[{metricType:'reps',reps:8}]}]});
  const due=await evaluate(now);const snapshot=await guided.read();const later=zonedMinute(now+7200000,profile.timeZone);
  await guided.rescheduleTime(saved.task.id,later.time,saved.task.revision,snapshot.revision,(await repo.readMetadata()).restoreGeneration??0);
  const moved=await evaluate(now+1000);const final=await evaluate(now+3600000);
  return {noInventedCompletion:!before.record,trainingSuppressed:training.suppressed&&!training.record,completionIsReal:record.kind==='completion'&&record.sessionId===session.id,
   restoredFacts:original===canonical(await db.sessions.toArray()),restoredCancelled:restored.ledger.records.find(r=>r.id===record.id)?.status==='cancelled',preferencesPreserved:ledger.preferences.side==='left',countPreserved:ledger.records.length===1,
   actualTask:due.record?.taskId===saved.task.id,movedCancelled:moved.ledger.records.find(r=>r.id===due.record?.id)?.status==='cancelled',noReplay:!final.record};
 }finally{db.close();await db.delete();}
}
