import { repository, type Repository } from '../persistence/repository';
import type { StartWorkoutInput, SetInput, Adjustment, WorkoutSession, ExerciseSnapshot, SetRecord } from '../domain/models';
import { workoutSessionSchema, exerciseSnapshotSchema, setRecordSchema } from '../domain/schemas';
import { DomainError } from '../domain/errors';
import { exercises } from '../catalog/exercises';
import { synchronizeTrainingMemo } from './training-memory';

function invalid(message:string):never{throw new DomainError('INVALID',message);}
function snapshot(id:string,order:number,instance:string=crypto.randomUUID()):ExerciseSnapshot{
 const exercise=exercises.find(e=>e.id===id);if(!exercise)invalid('Exercise not found');
 const {steps:_steps,cautions:_cautions,imageAssetId:_image,videoAssetId:_video,...facts}=exercise;
 return exerciseSnapshotSchema.parse({...facts,exerciseId:id,exerciseInstanceId:instance,order,targetSets:[]});
}
export function createWorkoutService(repo:Repository) {
 const db=repo.db;
 async function writable(id:string,revision:number){
  const session=await db.sessions.get(id);if(!session)invalid('Workout not found');
  if(session.status!=='in_progress')throw new DomainError('SESSION_READ_ONLY','Completed or abandoned training is read only');
  if(session.revision!==revision)throw new DomainError('CONFLICT','Training changed; reload before saving');return session;
 }
 async function commit(session:WorkoutSession){const next={...session,revision:session.revision+1,updatedAt:new Date().toISOString()};await db.sessions.put(next);await synchronizeTrainingMemo(repo,next);return next;}
 async function startWorkout(input:StartWorkoutInput):Promise<WorkoutSession>{return repo.write(async()=>{
  const existing=await db.sessions.get(input.sessionId);if(existing)return existing;
  if(await db.sessions.where('status').equals('in_progress').count())throw new DomainError('ACTIVE_SESSION_EXISTS','Continue or abandon the current workout');
  let actual:ExerciseSnapshot[]=[];let planVersionId=input.planVersionId,plannedDayId=input.plannedDayId;
  if(input.scheduledWorkoutId){const row=await db.scheduledWorkouts.get(input.scheduledWorkoutId);if(!row||row.completedSessionId||row.status==='skipped')invalid('Scheduled workout unavailable');
   if((planVersionId&&planVersionId!==row.planVersionId)||(plannedDayId&&plannedDayId!==row.plannedDayId))invalid('Schedule reference mismatch');planVersionId=row.planVersionId;plannedDayId=row.plannedDayId;
  }
  if(planVersionId||plannedDayId){
   if(!planVersionId||!plannedDayId)invalid('Both plan version and day are required');
   const version=await db.planVersions.get(planVersionId);const day=version?.days.find(d=>d.dayId===plannedDayId);if(!day)invalid('Plan day not found');
   if(input.exerciseIds?.length)invalid('Planned training uses plan snapshots');
   actual=day.exercises.map(e=>({...snapshot(e.exerciseId,e.order),targetSets:structuredClone(e.targetSets),notes:e.notes}));
  }else actual=(input.exerciseIds??[]).map((id,index)=>snapshot(id,index));
  const now=new Date().toISOString();const parsed=workoutSessionSchema.safeParse({id:input.sessionId,createdAt:now,updatedAt:now,revision:0,startedAt:now,status:'in_progress',localDate:input.localDate,timeZone:input.timeZone,planVersionId,plannedDayId,originalExerciseSnapshots:structuredClone(actual),exerciseSnapshots:actual});
  if(!parsed.success)invalid('Invalid workout date, zone or identity');await db.sessions.add(parsed.data);await synchronizeTrainingMemo(repo,parsed.data);return parsed.data;
 });}
 async function recordSet(id:string,input:SetInput,revision:number){return repo.write(async()=>{
  const session=await db.sessions.get(id);if(!session)invalid('Workout not found');if(session.status!=='in_progress')throw new DomainError('SESSION_READ_ONLY','Completed training is read only');
  const exercise=session.exerciseSnapshots.find(e=>e.exerciseInstanceId===input.exerciseInstanceId);if(!exercise||exercise.metricType!==input.metricType)invalid('Set metrics must match the exercise');
  const previous=await db.sets.get(input.id);if(previous&&(previous.sessionId!==id||previous.exerciseInstanceId!==input.exerciseInstanceId))invalid('Set identity belongs to another exercise');
  const inputKeys:(keyof SetInput)[]=['id','exerciseInstanceId','order','metricType','completed','reps','loadGrams','durationSeconds','distanceMeters','notes'];
  if(previous&&inputKeys.every(key=>previous[key as keyof SetRecord]===input[key]))return session;
  await writable(id,revision);
  if((await db.sets.where('[sessionId+exerciseInstanceId]').equals([id,input.exerciseInstanceId]).toArray()).some(s=>s.id!==input.id&&s.order===input.order))invalid('Set order already exists');
  const now=new Date().toISOString();const parsed=setRecordSchema.safeParse({...input,sessionId:id,createdAt:previous?.createdAt??now,updatedAt:now,revision:(previous?.revision??-1)+1});if(!parsed.success)invalid('Enter valid actual set values');await db.sets.put(parsed.data);return commit(session);
 });}
 async function adjustWorkout(id:string,command:Adjustment,revision:number){return repo.write(async()=>{
  const session=await writable(id,revision);const list=[...session.exerciseSnapshots];
  if(command.type==='add_exercise'){
   if(list.some(e=>e.exerciseInstanceId===command.exerciseInstanceId))invalid('Exercise identity exists');list.push(snapshot(command.exerciseId,list.length,command.exerciseInstanceId));
  }else if(command.type==='remove_set'){
   const set=await db.sets.get(command.setId);if(!set||set.sessionId!==id)invalid('Set not found');if(!command.confirmDeleteRecords)invalid('Confirm deleting saved records');await db.sets.delete(set.id);
  }else{
   const index=list.findIndex(e=>e.exerciseInstanceId===command.exerciseInstanceId);if(index<0)invalid('Exercise not found');const exercise=list[index];
   const sets=await db.sets.where('[sessionId+exerciseInstanceId]').equals([id,exercise.exerciseInstanceId]).toArray();
   if(command.type==='add_set'){
    if(await db.sets.get(command.setId))invalid('Set identity already exists');const now=new Date().toISOString();await db.sets.add(setRecordSchema.parse({id:command.setId,sessionId:id,exerciseInstanceId:exercise.exerciseInstanceId,order:sets.reduce((max,s)=>Math.max(max,s.order+1),0),metricType:exercise.metricType,completed:false,createdAt:now,updatedAt:now,revision:0}));
   }else if(command.type==='remove_exercise'){
    if(sets.length&&!command.confirmDeleteRecords)invalid('Confirm deleting saved records');await db.sets.bulkDelete(sets.map(s=>s.id));list.splice(index,1);
   }else{
    const replacement=snapshot(command.exerciseId,exercise.order,exercise.exerciseInstanceId);
    if(replacement.metricType!==exercise.metricType){
     if(sets.length&&!command.confirmClearMetrics)invalid('Confirm clearing incompatible saved metrics');
     for(const set of sets){const {reps:_reps,loadGrams:_load,durationSeconds:_duration,distanceMeters:_distance,...identity}=set;await db.sets.put({...identity,metricType:replacement.metricType,completed:false,revision:set.revision+1,updatedAt:new Date().toISOString()});}
    }
    list[index]={...replacement,originalExerciseId:exercise.originalExerciseId??exercise.exerciseId,targetSets:replacement.metricType===exercise.metricType?exercise.targetSets:[]};
   }
  }return commit({...session,exerciseSnapshots:list});
 });}
 async function finish(id:string,revision:number,status:'completed'|'abandoned'){return repo.write(async()=>{
  const old=await db.sessions.get(id);if(old?.status===status)return old;const session=await writable(id,revision);
  if(status==='completed'){
   const sets=await db.sets.where('sessionId').equals(id).toArray();if(!sets.some(s=>s.completed&&setRecordSchema.safeParse(s).success))throw new DomainError('EMPTY_WORKOUT','Record at least one valid completed set');
   if(session.planVersionId&&session.plannedDayId){const schedules=await db.scheduledWorkouts.where('planVersionId').equals(session.planVersionId).toArray();const row=schedules.find(r=>r.plannedDayId===session.plannedDayId);if(!row||row.completedSessionId)invalid('Scheduled workout is already completed or missing');await db.scheduledWorkouts.put({...row,completedSessionId:id,revision:row.revision+1,updatedAt:new Date().toISOString()});}
  }return commit({...session,status,...(status==='completed'?{completedAt:new Date().toISOString()}:{})});
 });}
 async function getActiveWorkout(){return db.sessions.where('status').equals('in_progress').first();}
 async function getSets(id:string){return db.sets.where('sessionId').equals(id).sortBy('order');}
 async function listAvailableSchedule(){const active=await db.plans.where('status').equals('active').first();return active?(await db.scheduledWorkouts.where('planVersionId').equals(active.currentVersionId).sortBy('scheduledDate')).filter(row=>row.status==='pending'&&!row.completedSessionId):[];}
 return {startWorkout,recordSet,adjustWorkout,completeWorkout:(id:string,revision:number)=>finish(id,revision,'completed'),abandonWorkout:(id:string,revision:number)=>finish(id,revision,'abandoned'),getActiveWorkout,getSets,listAvailableSchedule};
}
export const workoutService=createWorkoutService(repository);
export const {startWorkout,recordSet,adjustWorkout,completeWorkout,abandonWorkout}=workoutService;
