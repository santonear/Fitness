import Dexie from 'dexie';
import { createDatabase } from '../../../src/persistence/db';
import { createRepository } from '../../../src/persistence/repository';
import { createProfileService } from '../../../src/application/profile';
import { createPlanService } from '../../../src/application/plans';
import type { PlanInput } from '../../../src/domain/models';
function closeTestConnections(name:string){
 // Dexie's runtime connection registry is intentionally not part of production APIs.
 const connections=(Dexie as unknown as {connections: Dexie[]}).connections;
 for(const connection of [...connections])if(connection.name===name)connection.close();
}
export async function exercisePlans(name:string) {
 const db=createDatabase(name);try {
 const repo=createRepository(db);await createProfileService(repo).initialize('en');const service=createPlanService(repo);
 const input:PlanInput={name:'First',source:'manual',startDate:'2026-10-07',scheduleTimeZone:'Asia/Shanghai',goalSnapshot:{goal:''},durationWeeks:1,daysPerWeek:1,days:[{dayId:crypto.randomUUID(),weekIndex:1,dayOfWeek:3,exercises:[{exerciseId:'d16325d9-fc00-4c41-88a1-000000000003',order:0,targetSets:[{metricType:'reps',reps:10}]}]}]};
 const first=await service.savePlan(input);const snapshot=await db.planVersions.get(first.currentVersionId);
 const second=await service.savePlan({...input,name:'Second'});
 const oldStatus=(await db.plans.get(first.id))?.status;
 const now=new Date().toISOString();await repo.write(async()=>{await db.sessions.add({id:crypto.randomUUID(),createdAt:now,updatedAt:now,revision:0,status:'in_progress',startedAt:now,localDate:'2026-10-07',timeZone:'Asia/Shanghai',originalExerciseSnapshots:[],exerciseSnapshots:[]});});
 const draft=await service.savePlan({...input,name:'Third'});
 const blocked=await service.activateDraftPlan(draft.id,draft.revision).then(()=>false,()=>true);
 const scheduled=(await db.scheduledWorkouts.where('planVersionId').equals(second.currentVersionId).first())!;
 await service.rescheduleWorkout(scheduled.id,'2026-10-08',scheduled.revision);
 const moved=(await db.scheduledWorkouts.get(scheduled.id))!;
 const conflict=await service.skipWorkout(scheduled.id,scheduled.revision).then(()=>false,()=>true);
 await service.skipWorkout(scheduled.id,moved.revision);
 const immutable=JSON.stringify(snapshot)===JSON.stringify(await db.planVersions.get(first.currentVersionId));
 const before=(await repo.readMetadata()).dataRevision;
 const invalid=await service.savePlan({...input,daysPerWeek:2}).then(()=>false,()=>true);
 const rolledBack=before===(await repo.readMetadata()).dataRevision && await db.plans.count()===3;
 const activeEditBlocked=await service.savePlan({...input,id:second.id,name:'Modified'},second.revision).then(()=>false,()=>true);
 await repo.write(async()=>{await db.sessions.clear();});
 const concurrent=await Promise.all([service.savePlan({...input,name:'Concurrent A'}),service.savePlan({...input,name:'Concurrent B'})]);
 const activeCount=await db.plans.where('status').equals('active').count();
 const current=concurrent[1];const versionBefore=await db.planVersions.get(current.currentVersionId);
 await service.savePlan({...input,id:current.id,name:'Edited'},current.revision);
 const editPreservesVersion=JSON.stringify(versionBefore)===JSON.stringify(await db.planVersions.get(current.currentVersionId));
 return await db.transaction('r',db.tables,async()=>{
  await db.plans.count();
  return {oldStatus,activeCount,draftStatus:draft.status,blocked,originalDate:moved.originalDate,scheduledDate:moved.scheduledDate,conflict,immutable,invalid,rolledBack,activeEditBlocked,editPreservesVersion};
 });
 }finally{closeTestConnections(name);db.close();await Dexie.delete(name);}
}
export async function rejectMetricMismatch(name:string){
 const db=createDatabase(name);try{
 const repo=createRepository(db);await createProfileService(repo).initialize('en');const before=(await repo.readMetadata()).dataRevision;
 const input:PlanInput={name:'Invalid metrics',source:'manual',startDate:'2026-10-07',scheduleTimeZone:'Asia/Shanghai',goalSnapshot:{goal:''},durationWeeks:1,daysPerWeek:1,days:[{dayId:crypto.randomUUID(),weekIndex:1,dayOfWeek:3,exercises:[{exerciseId:'d16325d9-fc00-4c41-88a1-000000000003',order:0,targetSets:[{metricType:'duration',durationSeconds:30}]}]}]};
 const code=await createPlanService(repo).savePlan(input).then(()=> 'accepted',error=>error.code);
 // Await the read transaction's completion, not merely its last request, before closing.
 return await db.transaction('r',db.tables,async()=>({code,plans:await db.plans.count(),versions:await db.planVersions.count(),schedules:await db.scheduledWorkouts.count(),unchanged:before===(await repo.readMetadata()).dataRevision}));
 }finally{closeTestConnections(name);db.close();await Dexie.delete(name);}
}
export async function readActiveTargets(){
 const {database}=await import('../../../src/persistence/db');const plan=await database.plans.where('status').equals('active').first();const version=await database.planVersions.get(plan!.currentVersionId);return version!.days[0].exercises.map(exercise=>exercise.targetSets[0]);
}
