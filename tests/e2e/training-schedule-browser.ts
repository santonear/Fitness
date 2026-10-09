import Dexie from 'dexie';
import { createDatabase } from '../../src/persistence/db';
import { createRepository } from '../../src/persistence/repository';
import { createProfileService } from '../../src/application/profile';
import { createGuidedService } from '../../src/application/guided';
import { createBackupService } from '../../src/application/backup';
import { createWorkoutService } from '../../src/application/workouts';
import { EXERCISE_IDS } from '../../src/catalog/exercises';
import type { ProgramCandidate } from '../../src/domain/guided-contracts';

export async function verifySchedule() {
  const name=`schedule-${crypto.randomUUID()}`, db=createDatabase(name), repo=createRepository(db);
  const profile=await createProfileService(repo).initialize('en'), guided=createGuidedService(repo), backup=createBackupService(repo);
  const rejects=async(operation:()=>Promise<unknown>)=>operation().then(()=>false,()=>true);
  try {
    const times=['12:00','14:00','09:00','20:00'];
    const candidate:ProgramCandidate={id:crypto.randomUUID(),name:'Timing fixture',goal:'Synthetic only',startDate:'2099-01-01',endDate:'2099-01-04',timeZone:profile.timeZone,createdAt:new Date().toISOString(),restoreGeneration:0,...await guided.captureDependencies(),explanation:'Fixture',days:times.map((startTime,index)=>({date:`2099-01-0${index+1}`,startTime,durationMinutes:30,exercises:[{exerciseId:EXERCISE_IDS.bodyweightSquat,order:0,targetSets:[{metricType:'reps',reps:8}],setTimings:[{durationSeconds:40,restSeconds:60}]}]}))};
    await guided.retainCandidate(candidate,0);
    const planContextProtected=await rejects(async()=>guided.applyCandidate(candidate.id,(await guided.read()).revision,14,'outdated'));
    await guided.applyCandidate(candidate.id,(await guided.read()).revision,14,await guided.capturePlanContext());
    const rows=(await db.scheduledWorkouts.toArray()).sort((a,b)=>a.scheduledDate.localeCompare(b.scheduledDate));
    const initial=rows.map(row=>row.startTime);
    const revision=(await guided.read()).revision;
    const midnight=await rejects(()=>guided.rescheduleTime(rows[0].id,'23:45',rows[0].revision,revision,0));
    await guided.rescheduleTime(rows[0].id,'14:00',rows[0].revision,revision,0);
    const stale=await rejects(()=>guided.rescheduleTime(rows[0].id,'16:00',rows[0].revision,revision,0));
    const file=await backup.exportBackup(); const envelope=JSON.parse(await file.text());
    const checked=await backup.validateBackup(new File([file],'schedule.json'));
    await backup.importBackup(checked,{backupExported:true,replacementConfirmed:true,expectedRevision:checked.expectedRevision});
    const state=await guided.read(), restored=(await db.scheduledWorkouts.toArray()).sort((a,b)=>a.scheduledDate.localeCompare(b.scheduledDate));
    const restoreStale=await rejects(()=>guided.rescheduleTime(restored[1].id,'16:00',restored[1].revision,state.revision,0));
    const session=await createWorkoutService(repo).startWorkout({sessionId:crypto.randomUUID(),localDate:restored[1].scheduledDate,timeZone:profile.timeZone,scheduledWorkoutId:restored[1].id});
    const before=JSON.stringify(await db.sessions.toArray());
    const activeProtected=await rejects(async()=>guided.rescheduleTime(restored[1].id,'16:00',restored[1].revision,(await guided.read()).revision,1));
    const historyPreserved=before===JSON.stringify(await db.sessions.toArray());
    return {initial,midnight,stale,restoreStale,activeProtected,historyPreserved,planContextProtected,version:envelope.schemaVersion,metadata:(await repo.readMetadata()).schemaVersion,times:restored.map(row=>row.startTime),programRevision:state.programs[0].revision,event:state.events.at(-1)?.action,estimated:session.exerciseSnapshots[0].setTimings};
  } finally {db.close();await Dexie.delete(name);}
}

export async function verifyLegacyTime() {
  const name=`schedule-legacy-${crypto.randomUUID()}`, db=createDatabase(name), repo=createRepository(db);
  try {
    const profile=await createProfileService(repo).initialize('en'), guided=createGuidedService(repo), backups=createBackupService(repo);
    const candidate:ProgramCandidate={id:crypto.randomUUID(),name:'Legacy',goal:'Fixture',startDate:'2099-01-01',endDate:'2099-01-01',timeZone:profile.timeZone,createdAt:new Date().toISOString(),restoreGeneration:0,...await guided.captureDependencies(),explanation:'Fixture',days:[{date:'2099-01-01',exercises:[{exerciseId:EXERCISE_IDS.bodyweightSquat,order:0,targetSets:[{metricType:'reps',reps:8}]}]}]};
    await guided.retainCandidate(candidate,0);await guided.applyCandidate(candidate.id,(await guided.read()).revision,14);
    const old=JSON.parse(await (await backups.exportBackup()).text());old.schemaVersion=4;old.data.metadata.schemaVersion=5;delete old.data.v8;
    const checked=await backups.validateBackup(new File([JSON.stringify(old)],'legacy-v4.json'));
    await backups.importBackup(checked,{backupExported:true,replacementConfirmed:true,expectedRevision:checked.expectedRevision});
    const task=(await db.scheduledWorkouts.toArray())[0];const unknown=task.startTime===undefined&&task.durationMinutes===undefined;
    await guided.rescheduleTime(task.id,'09:00',task.revision,(await guided.read()).revision,1,30);
    const next=(await db.scheduledWorkouts.get(task.id))!;
    return {unknown,start:next.startTime,duration:next.durationMinutes,setsPreserved:JSON.stringify((await db.planVersions.toArray())[0].days[0].exercises)===JSON.stringify(candidate.days[0].exercises)};
  } finally {db.close();await Dexie.delete(name);}
}
