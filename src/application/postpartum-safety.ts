import {z} from 'zod';
import {DomainError} from '../domain/errors';
import {v8StateSchema,v8WorkoutSchema} from '../domain/schemas';
import type {PostpartumSafetyState,PlannedItem,CoachProfile} from '../domain/v8/contracts';
import type {Repository} from '../persistence/repository';
import {DATA,calendarDay,condition} from '../engine/data';
import { DEFAULT_TIME_ZONE, addDays } from '../domain/local-date';
const urgentKeys=DATA.rules.find(r=>r.id==='postpartum.urgent')!.value!.items as string[];
const symptomKeys=DATA.rules.find(r=>r.id==='postpartum.symptom_regression')!.value!.when.contains_any as string[];
export const postpartumReportSchema=z.strictObject({urgent:z.record(z.string(),z.boolean()),regression:z.record(z.string(),z.boolean())}).superRefine((input,ctx)=>{
 for(const [group,keys] of [['urgent',urgentKeys],['regression',symptomKeys]] as const)if(Object.keys(input[group]).some(key=>!keys.includes(key)))ctx.addIssue({code:'custom',path:[group],message:'Unknown source symptom'});
 const positive=Object.values(input.urgent).some(Boolean)||Object.values(input.regression).some(Boolean),complete=urgentKeys.every(key=>typeof input.urgent[key]==='boolean')&&symptomKeys.every(key=>typeof input.regression[key]==='boolean');if(!positive&&!complete)ctx.addIssue({code:'custom',message:'Symptom-free evidence requires explicit answers to every source symptom'});
});export type PostpartumReport=z.infer<typeof postpartumReportSchema>;
const invalid=(message:string):never=>{throw new DomainError('INVALID',message);};
export function assertPostpartumItems(items:Pick<PlannedItem,'exerciseId'>[],state?:PostpartumSafetyState){
 if(state?.urgentAt)invalid('POSTPARTUM_PROFESSIONAL_REQUIRED');
 if(!state?.regression)return;
 for(const item of items){const e=DATA.exercises.find(e=>e.id===item.exerciseId);if(!e||state.regression.phase===1&&!condition(DATA.rules.find(row=>row.id==='postpartum.phase1')!.value!.allow_only_if,e,{})||e.impact>=1||e.flags.some(flag=>['valsalva_prone','heavy_axial_load'].includes(flag)))invalid('POSTPARTUM_REGRESSION_RESTRICTED');}
}
function phase(profile:CoachProfile):1|2|3 {
 const pop=profile.population;if(pop?.kind!=='postpartum')return invalid('POSTPARTUM_CONTEXT_REQUIRED');
 const source=DATA.rules.find(r=>r.id==='postpartum.phase.boundaries')!.value!,buffer=pop.delivery==='cesarean'||pop.delivery==='assisted_or_tear'||pop.perinealTrauma?source.buffer_weeks_if.default:0;
 return !pop.cleared?1:pop.weeksSinceBirth>=source.base_weeks.phase3_from+buffer?3:pop.weeksSinceBirth>=source.base_weeks.phase2[0]+buffer?2:1;
}
/** Source-required consecutive local dates; a missing date cannot be inferred or backfilled. */
export function twoSymptomFreeWeeks(dates:string[],today:string){const days=new Set(dates),weeks=DATA.rules.find(r=>r.id==='postpartum.symptom_regression')!.value!.no_auto_progress_until.any.find((row:{user?:string})=>row.user==='symptom_free_consecutive_weeks').gte;return Array.from({length:weeks*7},(_,n)=>addDays(today,-n)).every(day=>days.has(day));}
export function createPostpartumSafety(repo:Repository){
 async function report(workoutId:string|undefined,input:PostpartumReport,expectedRevision?:number){
  const answers=postpartumReportSchema.parse(input);
  return repo.write(async()=>{
   const state=await repo.db.v8State.get('v8'),profile=state?.coachProfile;if(!state||!profile)return invalid('PROFILE_REQUIRED');
   if(profile.population?.kind!=='postpartum'&&!state.postpartumSafety?.urgentAt&&!state.postpartumSafety?.regression)return invalid('POSTPARTUM_CONTEXT_REQUIRED');
   const record=workoutId?await repo.db.v8Workouts.get(workoutId):undefined;if(workoutId&&(!record||record.status!=='in_progress'))return invalid('TRAINING_ENDED');
   const at=new Date().toISOString(),local=await repo.db.profiles.toCollection().first(),zone=local?.timeZone??record?.timeZone??DEFAULT_TIME_ZONE,today=calendarDay(at,zone)!;
   const urgent=urgentKeys.filter(key=>answers.urgent[key]),regression=symptomKeys.filter(key=>answers.regression[key]),prior=state.postpartumSafety??{};let next:PostpartumSafetyState={...prior};
   if(urgent.length||regression.length){next.lastSymptomAt=at;if(prior.regression)next.regression={...prior.regression,requiredAt:at,symptomFreeDates:[]};}
   if(urgent.length)next.urgentAt=prior.urgentAt??at;
   if(regression.length){const current=prior.regression?.phase??phase(profile);next.regression={requiredAt:at,phase:prior.regression?.phase??Math.max(1,current-1) as 1|2|3,symptomFreeDates:[]};}
   if(!urgent.length&&!regression.length&&prior.regression){
    if(!profile.healthStorageConsent?.acceptedAt)return invalid('HEALTH_STORAGE_CONSENT_REQUIRED');
    const requiredDay=calendarDay(prior.regression.requiredAt,zone)!;
    const dates=today>requiredDay?[...new Set([...prior.regression.symptomFreeDates,today])].sort():prior.regression.symptomFreeDates;
    next.regression={...prior.regression,symptomFreeDates:dates};if(twoSymptomFreeWeeks(dates,today))delete next.regression;
   }
   if(record){const clinical=profile.healthStorageConsent?.acceptedAt?{postpartumSymptoms:[...record.postpartumSymptoms??[],{recordedAt:at,urgent,regression}]}:{};await repo.db.v8Workouts.put(v8WorkoutSchema.parse({...record,...clinical,...(urgent.length?{status:record.sets.length?'partial':'not_started',endedAt:at}:{})}));}
   if(urgent.length)for(const active of await repo.db.v8Workouts.where('status').equals('in_progress').toArray())await repo.db.v8Workouts.put(v8WorkoutSchema.parse({...active,status:active.sets.length?'partial':'not_started',endedAt:at}));
   const {nextWorkoutOverride:_,...retained}=state;await repo.db.v8State.put(v8StateSchema.parse({...retained,postpartumSafety:next,...(urgent.includes('chest_pain')?{cardiacPause:{requiredAt:at}}:{})}));return next;
  },expectedRevision);
 }
 async function confirmProfessionalSeen(expectedRevision?:number){return repo.write(async()=>{const state=await repo.db.v8State.get('v8');if(!state?.postpartumSafety?.urgentAt&&!state?.postpartumSafety?.regression)return invalid('POSTPARTUM_REVIEW_NOT_REQUIRED');const at=new Date().toISOString();if([state.postpartumSafety.urgentAt,state.postpartumSafety.regression?.requiredAt].some(required=>required&&Date.parse(at)<Date.parse(required)))return invalid('POSTPARTUM_CONFIRMATION_TOO_EARLY');await repo.db.v8State.put(v8StateSchema.parse({...state,postpartumSafety:{lastSymptomAt:state.postpartumSafety.lastSymptomAt,professionalSeenAt:at}}));},expectedRevision);}
 return {report,confirmProfessionalSeen};
}
