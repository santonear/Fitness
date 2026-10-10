import { authorizeLegacyOperation, type LegacyConfirmation } from './legacy-collisions';
import type { Plan, PlanInput, LocalDate } from '../domain/models';
import { repository, type Repository } from '../persistence/repository';
import { DomainError } from '../domain/errors';
import { planSchema, legacyPlanVersionSchema, localDateSchema } from '../domain/schemas';
import { expandSchedule } from '../domain/calendar';
import { exercises } from '../catalog/exercises';
import { assertLegacyPlanEditable } from '../persistence/v8-access';
export function createPlanService(repo: Repository) {
 const db=repo.db;
 async function requireUnmanaged(id:string) {
  await assertLegacyPlanEditable(repo, id);
  const guided=await db.guidedStates.get('guided');
  if(guided?.programs.some(program=>program.planIds.includes(id))) throw new DomainError('CONFLICT','This plan belongs to a retained phase; use phase controls instead');
 }
 async function renamePlan(id: string, name: string, expectedRevision: number): Promise<Plan> {
  return repo.write(async () => {
   await assertLegacyPlanEditable(repo, id);
   const plan = await db.plans.get(id);
   if (!plan || plan.deletedAt) throw new DomainError('INVALID', 'Plan not found or deleted');
   if (plan.revision !== expectedRevision) throw new DomainError('CONFLICT', 'Plan changed; reload before saving');
   if (plan.status === 'active' && await db.sessions.where('status').equals('in_progress').count()) {
    throw new DomainError('WORKOUT_IN_PROGRESS', 'Finish or abandon the current training before editing the active plan');
   }
   const updated = planSchema.safeParse({ ...plan, name, revision: plan.revision + 1, updatedAt: new Date().toISOString() });
   if (!updated.success) throw new DomainError('INVALID', 'Invalid plan name');
   await db.plans.put(updated.data);
   return updated.data;
  });
 }
 async function archiveOthers(id:string,now:string) {
  const retained = (await db.v8State.get('v8'))?.legacyPlanIds ?? [];
  for(const plan of await db.plans.where('status').equals('active').toArray()) if(plan.id!==id&&!plan.model&&!retained.includes(plan.id)) { await requireUnmanaged(plan.id); await db.plans.put({...plan,status:'archived',updatedAt:now,revision:plan.revision+1}); }
 }
 async function savePlan(input: PlanInput, expectedRevision?: number, confirmation?: LegacyConfirmation): Promise<Plan> {
  return repo.write(async()=>{
   const old=input.id ? await db.plans.get(input.id):undefined;
   if(input.id)await requireUnmanaged(input.id);
   if(input.id && !old) throw new DomainError('INVALID','Plan not found');
   if(old?.model)throw new DomainError('INVALID','Use the day plan editor');
   if(old?.deletedAt) throw new DomainError('INVALID','This plan was deleted');
   if(old && (expectedRevision===undefined || old.revision!==expectedRevision)) throw new DomainError('CONFLICT','Plan changed; reload before saving');
   if(input.status!==undefined && input.status!=='draft' && input.status!=='active') throw new DomainError('INVALID','Invalid plan status');
   const ongoing=await db.sessions.where('status').equals('in_progress').count();
   if(ongoing && old?.status==='active') throw new DomainError('WORKOUT_IN_PROGRESS','Finish or abandon the current training before editing the active plan');
   const now=new Date().toISOString();const id=old?.id??crypto.randomUUID();
   const previous=old?await db.planVersions.get(old.currentVersionId):undefined;
   const parsed=legacyPlanVersionSchema.safeParse({id:crypto.randomUUID(),planId:id,createdAt:now,updatedAt:now,revision:0,versionNumber:(previous?.versionNumber??0)+1,goalSnapshot:input.goalSnapshot,startDate:input.startDate,scheduleTimeZone:input.scheduleTimeZone,durationWeeks:input.durationWeeks,daysPerWeek:input.daysPerWeek,days:input.days,generationMetadata:input.generationMetadata});
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
   if(status==='active'){await authorizeLegacyOperation({type:'save',input},confirmation,repo);await archiveOthers(id,now);}
   await db.planVersions.add(version);await db.plans.put(candidate.data);await db.scheduledWorkouts.bulkAdd(schedule);
   return candidate.data;
  });
 }
 async function activateDraftPlan(id: string, revision: number, confirmation?: LegacyConfirmation): Promise<Plan> {
  return repo.write(async()=>{
   await assertLegacyPlanEditable(repo, id);
   const plan=await db.plans.get(id);if(!plan || plan.revision!==revision)throw new DomainError('CONFLICT','Plan changed');
   if(plan.model)throw new DomainError('INVALID','Day plans do not use legacy draft activation');
   if(plan.deletedAt)throw new DomainError('INVALID','This plan was deleted');
   if(plan.status!=='draft')throw new DomainError('INVALID','Only drafts can be activated');
   if(await db.sessions.where('status').equals('in_progress').count())throw new DomainError('WORKOUT_IN_PROGRESS','Finish or abandon current training first');
   await authorizeLegacyOperation({type:'activate',id},confirmation,repo);const now=new Date().toISOString();await archiveOthers(id,now);const updated:Plan={...plan,status:'active',revision:plan.revision+1,updatedAt:now};await db.plans.put(updated);return updated;
  });
 }
 async function updateSchedule(id:string,revision:number,date?:LocalDate,confirmation?: LegacyConfirmation) {
  await repo.write(async()=>{
   const row=await db.scheduledWorkouts.get(id);if(!row || row.revision!==revision)throw new DomainError('CONFLICT','Schedule changed');
   if(row.hiddenAt)throw new DomainError('INVALID','This schedule was hidden');
   const version=await db.planVersions.get(row.planVersionId);
   if (version) await assertLegacyPlanEditable(repo, version.planId);
   if(version&&!('durationWeeks' in version))throw new DomainError('INVALID','Use the day plan schedule operation');
   if(!version || (await db.plans.get(version.planId))?.deletedAt)throw new DomainError('INVALID','This plan was deleted');
   if(row.completedSessionId)throw new DomainError('SESSION_READ_ONLY','Completed training is read only');
   if(date!==undefined && !localDateSchema.safeParse(date).success)throw new DomainError('INVALID','Invalid date');
   if(date===undefined && await db.sessions.where('status').equals('in_progress').filter(session=>session.planVersionId===row.planVersionId&&session.plannedDayId===row.plannedDayId).count())throw new DomainError('WORKOUT_IN_PROGRESS','Finish or abandon this training before skipping it');
   if(date!==undefined)await authorizeLegacyOperation({type:'reschedule',id,date},confirmation,repo);
   await db.scheduledWorkouts.put({...row,scheduledDate:date??row.scheduledDate,status:date===undefined?'skipped':'pending',revision:row.revision+1,updatedAt:new Date().toISOString()});
  });
 }
 async function rescheduleWorkout(id:string,date:LocalDate,revision:number,confirmation?: LegacyConfirmation):Promise<void>{return updateSchedule(id,revision,date,confirmation);}
 async function skipWorkout(id:string,revision:number):Promise<void>{return updateSchedule(id,revision);}
 async function hideScheduledWorkout(id: string, revision: number): Promise<void> {
  await repo.write(async () => {
   const row = await db.scheduledWorkouts.get(id);
   if (!row || row.revision !== revision) throw new DomainError('CONFLICT', 'Schedule changed; reload before deleting');
   if (row.hiddenAt) throw new DomainError('INVALID', 'This schedule was hidden');
   const version = await db.planVersions.get(row.planVersionId);
   if (version) await assertLegacyPlanEditable(repo, version.planId);
   if (!version || (await db.plans.get(version.planId))?.deletedAt) throw new DomainError('INVALID', 'This plan was deleted');
   if (await db.sessions.where('status').equals('in_progress').filter(session => session.planVersionId === row.planVersionId && session.plannedDayId === row.plannedDayId).count()) {
    throw new DomainError('WORKOUT_IN_PROGRESS', 'Finish or abandon this training before deleting its schedule');
   }
   const now = new Date().toISOString();
   await db.scheduledWorkouts.put({ ...row, hiddenAt: now, updatedAt: now, revision: row.revision + 1 });
  });
 }
 async function deletePlan(id: string, revision: number): Promise<void> {
  await repo.write(async () => {
   await requireUnmanaged(id);
   const plan = await db.plans.get(id);
   if (!plan || plan.revision !== revision) throw new DomainError('CONFLICT', 'Plan changed; reload before deleting');
   if (plan.deletedAt) throw new DomainError('INVALID', 'This plan was deleted');
   const versions = await db.planVersions.where('planId').equals(id).toArray();
   const versionIds = versions.map(version => version.id);
   const sessions = await db.sessions.where('planVersionId').anyOf(versionIds).toArray();
   if (sessions.some(session => session.status === 'in_progress')) {
    throw new DomainError('WORKOUT_IN_PROGRESS', 'Finish or abandon this training before deleting its plan');
   }
   if (sessions.length) {
    const now = new Date().toISOString();
    await db.plans.put({ ...plan, status: 'archived', deletedAt: now, updatedAt: now, revision: plan.revision + 1 });
   } else {
    await db.scheduledWorkouts.where('planVersionId').anyOf(versionIds).delete();
    await db.planVersions.bulkDelete(versionIds);
    await db.plans.delete(id);
   }
  });
 }
 return {savePlan,renamePlan,activateDraftPlan,rescheduleWorkout,skipWorkout,hideScheduledWorkout,deletePlan};
}
export const planService=createPlanService(repository);
export const {savePlan,activateDraftPlan,rescheduleWorkout,skipWorkout}=planService;
