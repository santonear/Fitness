export { default as Dexie } from 'dexie';
import { repository, createRepository, type Repository } from '../../../src/persistence/repository';
import { createDatabase } from '../../../src/persistence/db';
import { createProfileService } from '../../../src/application/profile';
import { createPlanService } from '../../../src/application/plans';
import { createDayPlanService } from '../../../src/application/day-plans';
import { createWorkoutService } from '../../../src/application/workouts';
import { createBackupService } from '../../../src/application/backup';
import { exercises } from '../../../src/catalog/exercises';
import type { PlannedExercise, SetInput } from '../../../src/domain/models';

export function canonicalFacts(value: unknown): string {
  function stable(value: unknown): unknown {
    if(Array.isArray(value)){const entries=value.map(stable);const key=(entry:unknown)=>typeof entry==='object'&&entry!==null?'id' in entry?String(entry.id):'session' in entry?String((entry.session as {id:string}).id):null:null;
      if(entries.every(entry=>key(entry)!==null))entries.sort((a,b)=>key(a)!<key(b)!?-1:key(a)!>key(b)!?1:0);return entries;}
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>[key,stable(value)]));return value;
  }
  const data=structuredClone(value) as Record<string,unknown>;
  data.guidedStates ??= [];
  const metadata=data.metadata as Record<string,unknown>;for(const key of ['revision','dataRevision','restoreGeneration','importedAt','upgradedAt','schemaVersion'])delete metadata[key];
  const memo=data.trainingMemo as Record<string,unknown>;for(const key of ['revision','sourceRevision','updatedAt'])delete memo[key];
  return JSON.stringify(stable(data));
}
export async function seedCalLibrary(repo:Repository=repository){
  const profileService=createProfileService(repo);let profile=await profileService.initialize('en');profile=await profileService.saveProfile({locale:'en',timeZone:'UTC',units:'metric'},profile.revision);
  const plans=createPlanService(repo),days=createDayPlanService(repo),workouts=createWorkoutService(repo),backup=createBackupService(repo);
  const targets=[{metricType:'reps_load',reps:8,loadGrams:0},{metricType:'duration_distance',durationSeconds:90,distanceMeters:0},{metricType:'reps',reps:10},{metricType:'duration',durationSeconds:60}] as const;
  const items:PlannedExercise[]=exercises.slice(0, 4).map((exercise,order)=>({exerciseId:exercise.id as PlannedExercise['exerciseId'],order,targetSets:[{...targets[order]}],notes:`计划备注 ${order}`}));
  const legacy=await plans.savePlan({name:'Legacy',source:'manual',startDate:'2027-01-04',scheduleTimeZone:'UTC',goalSnapshot:{goal:'旧目标'},durationWeeks:1,daysPerWeek:1,
    days:[{dayId:crypto.randomUUID(),weekIndex:1,dayOfWeek:1,exercises:[items[2]]}]});
  const legacyTask=(await repo.db.scheduledWorkouts.where('planVersionId').equals(legacy.currentVersionId).first())!;
  let oldSession=await workouts.startWorkout({sessionId:crypto.randomUUID(),localDate:'2027-01-05',timeZone:'UTC',scheduledWorkoutId:legacyTask.id});
  oldSession=await workouts.recordSet(oldSession.id,{id:crypto.randomUUID(),exerciseInstanceId:oldSession.exerciseSnapshots[0].exerciseInstanceId,order:0,metricType:'reps',reps:9,completed:true,notes:'旧实际备注'},oldSession.revision);
  await workouts.completeWorkout(oldSession.id,oldSession.revision);const oldTask=(await repo.db.scheduledWorkouts.get(legacyTask.id))!;await plans.hideScheduledWorkout(oldTask.id,oldTask.revision);
  // Explicit legacy v2 fixture: fields follow the previous contract; header/runtime metadata are historical.
  const old=JSON.parse(await (await backup.exportBackup()).text());old.schemaVersion=2;old.data.metadata.schemaVersion=3;delete old.data.guidedStates;delete old.data.v8;delete old.data.nutritionRecords;delete old.data.activityImportReceipts;const oldJson=JSON.stringify(old);
  let day=await days.saveDayPlan({name:'Day',date:'2027-01-07',timeZone:'UTC',exercises:items});const taskId=day.task.id;const oldVersion=day.version.id;
  const edited=structuredClone(items);edited[0].notes='新版本备注';day=await days.saveDayPlan({id:day.plan.id,expectedRevision:day.plan.revision,name:'Day revised',date:'2027-01-07',timeZone:'UTC',exercises:edited});
  if(day.task.id!==taskId||day.version.id===oldVersion)throw new Error('Version/task fidelity failed');
  let session=await workouts.startWorkout({sessionId:crypto.randomUUID(),localDate:'2027-01-08',timeZone:'UTC',scheduledWorkoutId:day.task.id});
  for(let i=0;i<4;i++)session=await workouts.recordSet(session.id,{id:crypto.randomUUID(),exerciseInstanceId:session.exerciseSnapshots[i].exerciseInstanceId,order:0,completed:true,notes:`实际备注 ${i}`,...targets[i]} as SetInput,session.revision);
  await workouts.completeWorkout(session.id,session.revision);
  const ongoing=await workouts.startWorkout({sessionId:crypto.randomUUID(),localDate:'2027-01-09',timeZone:'UTC',exerciseIds:[exercises[1].id]});
  const stamp='2027-01-09T00:00:00Z';await repo.write(async()=>{
    await repo.db.bodyWeights.add({id:crypto.randomUUID(),createdAt:stamp,updatedAt:stamp,revision:0,localDate:'2027-01-09',timeZone:'UTC',weightGrams:65000});
    await repo.db.aiMemoryNotes.add({id:crypto.randomUUID(),createdAt:stamp,updatedAt:stamp,revision:0,memoRevision:1,generatorVersion:'synthetic',locale:'en',suggestion:'既有备注',explanation:'独立保留'});
    await repo.db.timers.add({id:crypto.randomUUID(),createdAt:stamp,updatedAt:stamp,revision:0,sessionId:ongoing.id,exerciseInstanceId:ongoing.exerciseSnapshots[0].exerciseInstanceId,kind:'exercise',status:'paused',accumulatedMs:1000});
    await repo.db.mediaAssets.add({id:'synthetic-asset',type:'image',provider:'r2',creator:'synthetic',language:'en',altText:{en:'Fixture',zh:'夹具'},caption:{en:'Fixture',zh:'夹具'},source:'synthetic',license:'fixture',attribution:'fixture',embeddingStatus:'unreviewed',version:1});
  });
  return {oldJson,taskId,oldVersion,dayPlanId:day.plan.id};
}
export async function verifyIsolatedRestore(text:string){
  const name=`cal-restore-${crypto.randomUUID()}`,db=createDatabase(name),repo=createRepository(db);
  try{await createProfileService(repo).initialize('en');const backup=createBackupService(repo);await backup.exportBackup();
    const validated=await backup.validateBackup(new File([text],'downloaded.json'));await backup.importBackup(validated,{backupExported:true,replacementConfirmed:true,expectedRevision:validated.expectedRevision});
    const output=JSON.parse(await (await backup.exportBackup()).text());const source=JSON.parse(text);const comparable=structuredClone(output.data);if(source.schemaVersion<7){if(output.data.nutritionRecords.length||output.data.activityImportReceipts.length)throw new Error("Legacy restore invented lifestyle records");delete comparable.nutritionRecords;delete comparable.activityImportReceipts;}if(source.schemaVersion<6){if(output.data.v8.plans.length!==source.data.plans.filter((plan:{deletedAt?:string})=>!plan.deletedAt).length)throw new Error('Legacy plans were not migrated');delete comparable.v8;}return {same:canonicalFacts(source.data)===canonicalFacts(comparable),version:output.schemaVersion,metadata:output.data.metadata.schemaVersion};
  }finally{if(!db.name.startsWith('cal-restore-'))throw new Error('Unexpected fixture DB');db.close();await db.delete();}
}
