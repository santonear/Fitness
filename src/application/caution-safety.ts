import {z} from 'zod';
import {DomainError} from '../domain/errors';
import type {Repository} from '../persistence/repository';
import type {WorkoutRecord} from '../domain/v8/contracts';
import type {TrainingCheckinRow} from './training-checkin';
import {Rules,calendarDay} from '../engine/data';
import {v8StateSchema} from '../domain/schemas';
import {historyDangerReview,painQuestionKeys} from './pain-events';
import {unresolvedReview} from './training-pain';
import { DAY_MS, DEFAULT_TIME_ZONE, addDays } from '../domain/local-date';
export const cautionJoints=['knee','back','shoulder','wrist'] as const;
export type CautionJoint=typeof cautionJoints[number];
export type CautionLevels=Partial<Record<CautionJoint,{level:0|1|2;changedAt:string}>>;
export interface CautionMorning {workoutId:string;joint:CautionJoint;painLastedToNextMorning:boolean}
export type CautionCheckinRow=TrainingCheckinRow&{cautionMorning?:CautionMorning};
export interface CautionFollowup {pattern:string;appliedAt:string;sourceWorkoutId:string;cautionLevelDelta:number}
const rules=new Rules(),jointSchema=z.enum(cautionJoints),invalid=(message:string):never=>{throw new DomainError('INVALID',message);};
const morningSchema=z.strictObject({workoutId:z.uuid(),joint:jointSchema,painLastedToNextMorning:z.boolean()});
const reviewSchema=z.strictObject({joint:jointSchema,level:z.union([z.literal(0),z.literal(1)]),answers:z.record(z.string(),z.boolean()),requestedAt:z.iso.datetime()});
function onFollowingLocalDate(answeredAt:string,endedAt:string,zone:string){const day=calendarDay(endedAt,zone),answer=calendarDay(answeredAt,zone);return !!day&&!!answer&&answer===addDays(day,1);}
/** Existing high-pain facts remain effective even before a dedicated level state was introduced. */
export function effectiveCautionLevels(stored:CautionLevels|undefined,history:readonly WorkoutRecord[],followups:readonly CautionFollowup[]=[],activeJoints:readonly string[]=[]):CautionLevels {
 const levels={...stored},threshold=rules.get('pain.rule').bands[1].when.all[1].lte;
 const raise=(joint:CautionJoint,at:string)=>{if(Number.isFinite(Date.parse(at))&&(!levels[joint]||Date.parse(at)>Date.parse(levels[joint]!.changedAt)))levels[joint]={level:2,changedAt:at};};
 for(const record of history)for(const event of record.setFeedbackEvents??[])if(cautionJoints.includes(event.painArea as CautionJoint)&&event.painScore!==undefined&&Number.isFinite(event.painScore)&&event.painScore>threshold&&record.sets.some(set=>set.exerciseId===event.exerciseId&&set.itemIndex===event.itemIndex&&set.setIndex===event.setIndex))raise(event.painArea as CautionJoint,event.createdAt);
 for(const applied of followups){
  if(applied.cautionLevelDelta<=0)continue;const record=history.find(row=>row.id===applied.sourceWorkoutId);if(!record)continue;
  const sets=record.sets.filter(set=>rules.byExercise.get(set.exerciseId)?.primary_pattern===applied.pattern);
  const areas=[...new Set((record.setFeedbackEvents??[]).filter(event=>cautionJoints.includes(event.painArea as CautionJoint)&&sets.some(set=>set.exerciseId===event.exerciseId&&set.itemIndex===event.itemIndex&&set.setIndex===event.setIndex)).map(event=>event.painArea as CautionJoint))];
  // Old applied followups lack the original joint link after TTL. Restrict potentially affected active joints, never invent an answer.
  for(const joint of areas.length?areas:cautionJoints.filter(joint=>activeJoints.includes(joint)&&sets.some(set=>(rules.byExercise.get(set.exerciseId)?.joint_load[joint]??0)>0)))raise(joint,applied.appliedAt);
 }
 return levels;
}
/** Independent engine callers can use the same predicate without treating one low report as an entire low-pain workout. */
export function allPerformedJointSetsLow(record:WorkoutRecord,joint:CautionJoint,source=rules):boolean {
 if(record.sets.some(set=>!source.byExercise.has(set.exerciseId)))return false;
 const sets=record.sets.filter(set=>(source.byExercise.get(set.exerciseId)?.joint_load[joint]??0)>0),keys=new Set(sets.map(set=>`${set.itemIndex}:${set.setIndex}:${set.exerciseId}`));
 if(!sets.length||keys.size!==sets.length)return false;
 const reports=(record.setFeedbackEvents??[]).filter(event=>event.painArea===joint&&keys.has(`${event.itemIndex}:${event.setIndex}:${event.exerciseId}`)),threshold=source.get('pain.rule').bands[0].when.all[0].lte;
 return sets.every(set=>reports.some(event=>event.exerciseId===set.exerciseId&&event.itemIndex===set.itemIndex&&event.setIndex===set.setIndex&&event.painScore!==undefined))&&!reports.some(event=>event.painScore===undefined||!Number.isFinite(event.painScore)||event.painScore<0||event.painScore>threshold);
}
/** Scores belong to actual performed sets. One low score never masks another high score or a skipped answer. */
export function deriveCautionEvidence(history:readonly WorkoutRecord[],rows:readonly CautionCheckinRow[],joint:CautionJoint,input:{now:string;timeZone:string;since?:string}){
 const zero={consecutiveSessionsLte3:0,latestWorkoutId:undefined as string|undefined,latestMorningNoPain:false,mayIncreaseLoad:false,mayStepUp:false,canLowerTo1:false};
 const now=Date.parse(input.now);if(!Number.isFinite(now)||input.since&&!Number.isFinite(Date.parse(input.since))||new Set(history.map(row=>row.id)).size!==history.length)return zero;
 const relevant=history.filter(row=>['complete','partial'].includes(row.status)&&row.endedAt&&Date.parse(row.endedAt)<=now&&(!input.since||Date.parse(row.endedAt)>=Date.parse(input.since))).flatMap(record=>{
  const unknown=record.sets.some(set=>!rules.byExercise.has(set.exerciseId)),sets=record.sets.filter(set=>(rules.byExercise.get(set.exerciseId)?.joint_load[joint]??0)>0);
  return sets.length||unknown?[{record,sets,unknown}]:[];
 }).sort((a,b)=>Date.parse(b.record.endedAt!)-Date.parse(a.record.endedAt!)||a.record.id.localeCompare(b.record.id));
 let count=0;
 for(const {record}of relevant){
  if(!allPerformedJointSetsLow(record,joint))break;
  count++;
 }
 const latest=relevant[0]?.record,valid=latest?rows.filter(row=>row.cautionMorning?.workoutId===latest.id&&row.cautionMorning.joint===joint&&Date.parse(row.recordedAt)<=now&&Date.parse(row.expiresAt)>now&&onFollowingLocalDate(row.recordedAt,latest.endedAt!,input.timeZone)):[];
 const noPain=valid.some(row=>row.cautionMorning?.painLastedToNextMorning===false)&&!valid.some(row=>row.cautionMorning?.painLastedToNextMorning===true);
 return {consecutiveSessionsLte3:count,latestWorkoutId:latest?.id,latestMorningNoPain:noPain,mayIncreaseLoad:count>=rules.get('caution.progression_gate').hold_load_until.gte,mayStepUp:count>=rules.get('caution.progression_gate').ladder_step_up_requires.gte,canLowerTo1:count>=rules.get('caution.level_down').when.all[0].gte&&noPain};
}
export function createCautionSafety(repo:Repository){
 async function reconcileInside(){
  const state=await repo.db.v8State.get('v8');if(!state?.coachProfile)return;
  const stored=(state as typeof state&{cautionLevels?:CautionLevels}).cautionLevels,history=await repo.db.v8Workouts.toArray(),current=effectiveCautionLevels(stored,history,state.painFollowupRestrictions,state.coachProfile.cautions);
  const now=new Date().toISOString();await repo.db.trainingCheckins.where('expiresAt').belowOrEqual(now).delete();
  const profile=await repo.db.profiles.toCollection().first(),rows=await repo.db.trainingCheckins.toArray(),next={...current};let changed=cautionJoints.some(joint=>stored?.[joint]?.level!==current[joint]?.level||stored?.[joint]?.changedAt!==current[joint]?.changedAt);
  for(const joint of cautionJoints)if(state.coachProfile.healthStorageConsent?.acceptedAt&&current[joint]?.level===2&&deriveCautionEvidence(history,rows,joint,{now,timeZone:profile?.timeZone??DEFAULT_TIME_ZONE,since:current[joint]!.changedAt}).canLowerTo1){next[joint]={level:1,changedAt:now};changed=true;}
  if(changed)await repo.db.v8State.put(v8StateSchema.parse({...state,cautionLevels:next}));
 }
 async function review(input:z.infer<typeof reviewSchema>,revision?:number){const value=reviewSchema.parse(input);return repo.write(async()=>{
  const state=await repo.db.v8State.get('v8'),profile=state?.coachProfile;if(!state||!profile)return invalid('PROFILE_REQUIRED');
  const at=new Date().toISOString();if(Date.parse(value.requestedAt)>Date.parse(at))return invalid('INVALID_CAUTION_REVIEW_TIME');
  const history=await repo.db.v8Workouts.toArray(),levels=effectiveCautionLevels((state as typeof state&{cautionLevels?:CautionLevels}).cautionLevels,history,state.painFollowupRestrictions,profile.cautions),prior=levels[value.joint],level=prior?.level??(profile.cautions.includes(value.joint)?1:0),keys=painQuestionKeys([value.joint]);
  if(Object.keys(value.answers).some(key=>!keys.includes(key)))return invalid('RED_FLAG_ANSWERS_REQUIRED');
  const positive=Object.values(value.answers).some(Boolean);
  if(!positive&&!keys.every(key=>typeof value.answers[key]==='boolean'))return invalid('RED_FLAG_ANSWERS_REQUIRED');
  const retainedReview=historyDangerReview(history,profile.screening?.redFlagReview),pending=unresolvedReview(retainedReview);
  if(positive||pending){
   const nextLevel=level===2?2:1;
   const areas=[...new Set([...(pending?retainedReview?.areas??[]:[]),value.joint])],answers={...(pending?retainedReview?.answers:{}),...value.answers};
   if(pending)for(const [key,answer]of Object.entries(retainedReview?.answers??{}))if(answer)answers[key]=true;
   await repo.db.v8State.put(v8StateSchema.parse({...state,trainingPause:positive?{requiredAt:at}:state.trainingPause??{requiredAt:at},cautionLevels:{...levels,[value.joint]:{level:nextLevel,changedAt:at}},...(positive&&profile.healthStorageConsent&&profile.screening?{coachProfile:{...profile,cautions:[...new Set([...profile.cautions,value.joint])],screening:{...profile.screening,redFlagReview:{requiredAt:value.requestedAt,answeredAt:at,areas,questionKeys:painQuestionKeys(areas),answers}}}}:{})}));
   return {status:'blocked' as const,level:nextLevel};
  }
  if(!profile.healthStorageConsent?.acceptedAt)return invalid('HEALTH_STORAGE_CONSENT_REQUIRED');
  if(prior&&Date.parse(value.requestedAt)<Date.parse(prior.changedAt))return invalid('STALE_CAUTION_REVIEW');
  if(level===2&&value.level===0)return invalid('CAUTION_LEVEL_TWO_REVIEW_REQUIRED');
  const nextLevel=level===2?2:value.level;
  await repo.db.v8State.put(v8StateSchema.parse({...state,cautionLevels:{...levels,[value.joint]:{level:nextLevel,changedAt:at}},coachProfile:{...profile,cautions:nextLevel===0?profile.cautions.filter(joint=>joint!==value.joint):[...new Set([...profile.cautions,value.joint])],...(profile.screening?{screening:{...profile.screening,redFlagReview:{requiredAt:value.requestedAt,answeredAt:at,areas:[value.joint],questionKeys:keys,answers:value.answers}}}:{})}}));
  return {status:'applied' as const,level:nextLevel};
 },revision);}
 async function reportMorning(input:CautionMorning,revision?:number){const value=morningSchema.parse(input);return repo.write(async()=>{
  const state=await repo.db.v8State.get('v8');if(!state?.coachProfile?.healthStorageConsent?.acceptedAt)return invalid('HEALTH_STORAGE_CONSENT_REQUIRED');
  const record=await repo.db.v8Workouts.get(value.workoutId),at=new Date(),local=await repo.db.profiles.toCollection().first(),zone=local?.timeZone??DEFAULT_TIME_ZONE;
  if(!record||!['complete','partial'].includes(record.status)||!record.endedAt||!record.sets.some(set=>(rules.byExercise.get(set.exerciseId)?.joint_load[value.joint]??0)>0)||!onFollowingLocalDate(at.toISOString(),record.endedAt,zone))return invalid('CAUTION_MORNING_WORKOUT_REQUIRED');
  await repo.db.trainingCheckins.where('expiresAt').belowOrEqual(at.toISOString()).delete();
  const id=`caution-morning:${record.id}:${value.joint}`,prior=await repo.db.trainingCheckins.get(id) as CautionCheckinRow|undefined;
  if(prior?.cautionMorning?.painLastedToNextMorning===true&&!value.painLastedToNextMorning)return invalid('CAUTION_MORNING_ALREADY_POSITIVE');
  const row:CautionCheckinRow={id,recordedAt:at.toISOString(),expiresAt:new Date(at.getTime()+rules.get('deload.checkin.inputs').retain_days*DAY_MS).toISOString(),answers:{},cautionMorning:value};
  await repo.db.trainingCheckins.put(row);
  if(value.painLastedToNextMorning){
   const levels=(state as typeof state&{cautionLevels?:CautionLevels}).cautionLevels??{},patterns=[...new Set(record.sets.filter(set=>(rules.byExercise.get(set.exerciseId)?.joint_load[value.joint]??0)>0).map(set=>rules.byExercise.get(set.exerciseId)!.primary_pattern))],source=rules.get('pain.rule').bands.find((band:{action:string})=>band.action==='drop_pattern'),followups=[...state.painFollowupRestrictions??[]];
   for(const pattern of patterns)if(!followups.some(row=>row.sourceWorkoutId===record.id&&row.pattern===pattern))followups.push({pattern,sourceWorkoutId:record.id,cautionLevelDelta:source.caution_level_delta,appliedAt:at.toISOString()});
   const previous=historyDangerReview(await repo.db.v8Workouts.toArray(),state.coachProfile.screening?.redFlagReview),areas=[...new Set([...(previous?.areas??[]),value.joint])],answers=Object.fromEntries(Object.entries(previous?.answers??{}).filter(([,answer])=>answer===true)),profile=state.coachProfile;
   await repo.db.v8State.put(v8StateSchema.parse({...state,...(!profile.screening?{trainingPause:state.trainingPause??{requiredAt:at.toISOString()}}:{}),painFollowupRestrictions:followups,cautionLevels:{...levels,[value.joint]:{level:2,changedAt:at.toISOString()}},...(profile.screening?{coachProfile:{...profile,screening:{...profile.screening,redFlagReview:{requiredAt:at.toISOString(),areas,questionKeys:painQuestionKeys(areas),...(Object.keys(answers).length?{answers}:{})}}}}:{})}));
  }
  else await reconcileInside();
 },revision);}
 return {review,reportMorning,reconcile:(revision?:number)=>repo.write(reconcileInside,revision)};
}
