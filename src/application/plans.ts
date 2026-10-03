import type { Plan, PlanInput, LocalDate } from '../domain/models';
import { repository, type Repository } from '../persistence/repository';
import { DomainError } from '../domain/errors';
import { planSchema, planVersionSchema, localDateSchema } from '../domain/schemas';
import { expandSchedule } from '../domain/calendar';
import { exercises } from '../catalog/exercises';
export function createPlanService(repo: Repository) {
 const db=repo.db;
 async function archiveOthers(id:string,now:string) {
  for(const plan of await db.plans.where('status').equals('active').toArray()) if(plan.id!==id) await db.plans.put({...plan,status:'archived',updatedAt:now,revision:plan.revision+1});
 }
 async function savePlan(input: PlanInput, expectedRevision?: number): Promise<Plan> {
  return repo.write(async()=>{
   const old=input.id ? await db.plans.get(input.id):undefined;
   if(input.id && !old) throw new DomainError('INVALID','Plan not found');
   if(old && (expectedRevision===undefined || old.revision!==expectedRevision)) throw new DomainError('CONFLICT','Plan changed; reload before saving');
   if(input.status!==undefined && input.status!=='draft' && input.status!=='active') throw new DomainError('INVALID','Invalid plan status');
   const ongoing=await db.sessions.where('status').equals('in_progress').count();
   if(ongoing && old?.status==='active') throw new DomainError('WORKOUT_IN_PROGRESS','Finish or abandon the current training before editing the active plan');
   const now=new Date().toISOString();const id=old?.id??crypto.randomUUID();
   const previous=old?await db.planVersions.get(old.currentVersionId):undefined;
   const parsed=planVersionSchema.safeParse({id:crypto.randomUUID(),planId:id,createdAt:now,updatedAt:now,revision:0,versionNumber:(previous?.versionNumber??0)+1,goalSnapshot:input.goalSnapshot,durationWeeks:input.durationWeeks,daysPerWeek:input.daysPerWeek,days:input.days,generationMetadata:input.generationMetadata});
   if(!parsed.success) throw new DomainError('INVALID','Invalid plan exercises, targets, or cycle');
   const version=parsed.data;
   for(const day of version.days)for(const exercise of day.exercises){
    const catalogExercise=exercises.find(entry=>entry.id===exercise.exerciseId);
    if(!catalogExercise || exercise.targetSets.some(target=>target.metricType!==catalogExercise.metricType))throw new DomainError('INVALID','Target metrics must match the selected exercise');
   }
   const schedule=expandSchedule(version,input.startDate,input.scheduleTimeZone);
   const status=ongoing?'draft':input.status??'active';
   const candidate=planSchema.safeParse({id,createdAt:old?.createdAt??now,updatedAt:now,revision:old?old.revision+1:0,name:input.name,source:input.source,status,currentVersionId:version.id,startDate:input.startDate,scheduleTimeZone:input.scheduleTimeZone});
   if(!candidate.success) throw new DomainError('INVALID','Invalid plan name, start date, or time zone');
   if(status==='active')await archiveOthers(id,now);
   await db.planVersions.add(version);await db.plans.put(candidate.data);await db.scheduledWorkouts.bulkAdd(schedule);
   return candidate.data;
  });
 }
 async function activateDraftPlan(id: string, revision: number): Promise<Plan> {
  return repo.write(async()=>{
   const plan=await db.plans.get(id);if(!plan || plan.revision!==revision)throw new DomainError('CONFLICT','Plan changed');
   if(plan.status!=='draft')throw new DomainError('INVALID','Only drafts can be activated');
   if(await db.sessions.where('status').equals('in_progress').count())throw new DomainError('WORKOUT_IN_PROGRESS','Finish or abandon current training first');
   const now=new Date().toISOString();await archiveOthers(id,now);const updated:Plan={...plan,status:'active',revision:plan.revision+1,updatedAt:now};await db.plans.put(updated);return updated;
  });
 }
 async function updateSchedule(id:string,revision:number,date?:LocalDate) {
  await repo.write(async()=>{
   const row=await db.scheduledWorkouts.get(id);if(!row || row.revision!==revision)throw new DomainError('CONFLICT','Schedule changed');
   if(row.completedSessionId)throw new DomainError('SESSION_READ_ONLY','Completed training is read only');
   if(date!==undefined && !localDateSchema.safeParse(date).success)throw new DomainError('INVALID','Invalid date');
   await db.scheduledWorkouts.put({...row,scheduledDate:date??row.scheduledDate,status:date===undefined?'skipped':'pending',revision:row.revision+1,updatedAt:new Date().toISOString()});
  });
 }
 async function rescheduleWorkout(id:string,date:LocalDate,revision:number):Promise<void>{return updateSchedule(id,revision,date);}
 async function skipWorkout(id:string,revision:number):Promise<void>{return updateSchedule(id,revision);}
 return {savePlan,activateDraftPlan,rescheduleWorkout,skipWorkout};
}
export const planService=createPlanService(repository);
export const {savePlan,activateDraftPlan,rescheduleWorkout,skipWorkout}=planService;
