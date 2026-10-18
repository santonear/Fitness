import type {Repository} from '../persistence/repository';
import {DomainError} from '../domain/errors';
import {v8StateSchema,v8WorkoutSchema} from '../domain/schemas';
import type {PainAction,PlannedItem,SetFeedbackEvent,WorkoutRecord} from '../domain/v8/contracts';
import {substitute} from '../engine';
import {DATA,Rules,condition,type Exercise} from '../engine/data';
import type {Pattern} from '../engine/contracts';
import {toEngineProfile} from './engine-profile';
import {setMetricsSchema} from '../domain/schemas';
import {latestSetFeedback,painQuestionKeys,pendingPainReviews,historyDangerReview} from './pain-events';
export {latestSetFeedback,painQuestionKeys} from './pain-events';

export interface PainFeedbackPreview {action:'none'|'substitute'|'exclude';replacement?:(PlannedItem&{itemIndex:number});notices:string[];redFlagsRequired:boolean;repeatJointReferral:boolean;questions:{key:string;copyKey:string}[];blocked:boolean;applied:boolean}
const rules=new Rules();
const invalid=(message:string):never=>{throw new DomainError('INVALID',message);};
const localDate=(zone:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function effectivePainItem(record:WorkoutRecord,itemIndex:number,event?:SetFeedbackEvent):PlannedItem|undefined{
 const original=record.templateSnapshot?.items[itemIndex],planned=record.plannedExercises?.find(row=>row.itemIndex===itemIndex);
 const replacement=activePainReplacement(record,itemIndex),manual=record.substitutions?.filter(row=>row.itemIndex===itemIndex).at(-1);
 const exerciseId=event?.exerciseId??replacement?.exerciseId??manual?.toExerciseId??original?.exerciseId??planned?.exerciseId;
 const base=replacement?.exerciseId===exerciseId?replacement:original;
 if(base?.exerciseId===exerciseId)return base;
 const exercise=DATA.exercises.find(row=>row.id===exerciseId),fact=record.sets.filter(row=>row.itemIndex===itemIndex&&row.exerciseId===exerciseId).at(-1);
 if(!exercise||!fact||(!base&&!planned))return;
 const parsed=setMetricsSchema.safeParse({metricType:exercise.metricType,...(fact.reps!==undefined?{reps:fact.reps}:{}),...(fact.durationSeconds!==undefined?{durationSeconds:fact.durationSeconds}:{}),...(fact.distanceMeters!==undefined?{distanceMeters:fact.distanceMeters}:{}),...(fact.loadGrams!==undefined?{loadGrams:fact.loadGrams}:{})});
 if(!parsed.success)return;
 return{exerciseId:exercise.id,equipment:exercise.equipment_required[0]??base?.equipment??'none',sets:base?.sets??planned!.plannedSetCount,target:parsed.data,...(base?.prescription?{prescription:{...base.prescription,pattern:exercise.primary_pattern}}:{})};
}
export function unresolvedReview(review:NonNullable<NonNullable<import('../domain/v8/contracts').CoachProfile['screening']>['redFlagReview']> | undefined){
 if(!review)return false;
 if(!review.answeredAt||!review.questionKeys.every(key=>typeof review.answers?.[key]==='boolean'))return true;
 return Object.values(review.answers??{}).some(Boolean)&&(!review.professionalSeenAt||Date.parse(review.professionalSeenAt)<Math.max(Date.parse(review.requiredAt),Date.parse(review.answeredAt)));
}
export function activePainReplacement(record:WorkoutRecord,itemIndex:number){
 const action=record.painActions?.filter(row=>row.itemIndex===itemIndex&&row.replacement).at(-1),manual=record.substitutions?.filter(row=>row.itemIndex===itemIndex).at(-1);
 return action&&(!manual||Date.parse(action.appliedAt)>=Date.parse(manual.createdAt))?action.replacement:undefined;
}
function notice(key:string,locale:'zh'|'en') {const copy=DATA.copy[key];if(!copy)throw Error('MISSING_RULE_COPY');return copy[locale];}
export function createTrainingPain(repo:Repository){
 async function load(workoutId:string,eventId:string){
  const record=await repo.db.v8Workouts.get(workoutId),state=await repo.db.v8State.get('v8'),local=await repo.db.profiles.toCollection().first();
  const event=record?.setFeedbackEvents?.find(row=>row.id===eventId);
  if(!record||!event||event.effort!=='discomfort'||event.painScore===undefined||!event.painArea)return invalid('PAIN_FEEDBACK_NOT_FOUND');
  if(!latestSetFeedback(record).some(row=>row.id===event.id))return invalid('PAIN_FEEDBACK_SUPERSEDED');
  if(!state?.coachProfile?.healthStorageConsent?.acceptedAt)return invalid('HEALTH_STORAGE_CONSENT_REQUIRED');
  return{record,event,state,local};
 }
 async function assess(loaded:Awaited<ReturnType<typeof load>>,answers?:Record<string,boolean>){
  const {record,event,state,local}=loaded,locale=local?.locale??'zh';
  const band=rules.get('pain.rule').bands.find((row:{when:unknown})=>condition(row.when,{} as Exercise,{pain:{current:event.painScore}}));
  const action:PainFeedbackPreview['action']=band?.action==='drop_pattern'?'exclude':band?.action==='stop_exercise_use_next_substitute'?'substitute':'none';
  const history=await repo.db.v8Workouts.toArray(),pending=pendingPainReviews(history);
  const retained=historyDangerReview(history,state.coachProfile?.screening?.redFlagReview),retain=unresolvedReview(retained);
  const areas=[...new Set([event.painArea!,...pending.flatMap(row=>row.event.painArea?[row.event.painArea]:[]),...(retain?retained!.areas:[])])],questions=action==='none'?[]:[...new Set([...painQuestionKeys(areas),...(retain?retained!.questionKeys:[])])].map(key=>({key,copyKey:'redflag.copy.question_'+key}));
  const previous=record.painActions?.find(row=>row.eventId===event.id),allAnswers=answers??previous?.redFlagAnswers;
  const complete=questions.every(row=>typeof allAnswers?.[row.key]==='boolean');
  if(allAnswers&&Object.keys(allAnswers).some(key=>!questions.some(row=>row.key===key)))return invalid('INVALID_RED_FLAG_ANSWERS');
  const positives=[...new Set([...questions.filter(row=>allAnswers?.[row.key]===true).map(row=>row.key),...(unresolvedReview(retained)?Object.keys(retained!.answers??{}).filter(key=>retained!.answers![key]):[])])],back=rules.get('redflag.back'),shoulder=rules.get('redflag.shoulder');
  const tier=positives.some(key=>back.emergency_items.includes(key))?'redflag.copy.emergency_back':positives.some(key=>shoulder.cardiac_route_items.includes(key))?'redflag.copy.cardiac':positives.length?'redflag.copy.prompt_medical':undefined;
  const dropped=history.flatMap(row=>(row.painActions??[]).filter(item=>item.kind==='exclude').map(item=>({record:row,action:item}))).filter(row=>row.record.setFeedbackEvents?.find(feedback=>feedback.id===row.action.eventId)?.painArea===event.painArea);
  const occurrence=(workout:WorkoutRecord,feedback:SetFeedbackEvent)=>`${workout.id}:${feedback.itemIndex}:${feedback.setIndex}:${feedback.painArea}`;
  const repeat=action==='exclude'&&new Set([...dropped.map(row=>occurrence(row.record,row.record.setFeedbackEvents!.find(feedback=>feedback.id===row.action.eventId)!)),occurrence(record,event)]).size>=rules.get('pain.repeat_referral').when.gte;
  const notices:string[]=[];
  if(action!=='none')notices.push(notice(action==='exclude'?'pain.copy.drop_pattern':'pain.copy.stop_exercise',locale));
  if(repeat)notices.push(notice('pain.copy.referral',locale));if(tier)notices.push(notice(tier,locale));
  const preview:PainFeedbackPreview={action,notices,redFlagsRequired:questions.length>0&&!complete,repeatJointReferral:repeat,questions,blocked:!!tier,applied:!!previous};
  const mapped=toEngineProfile(state.coachProfile!,{asOfDate:localDate(local?.timeZone??'Asia/Shanghai'),timeZone:local?.timeZone,locale,history,ageYears:local?.bodyDetails?.values.age,bodyWeightKg:local?.bodyDetails?.values.weightKg});
  if(mapped&&complete&&action!=='none'){
   const reviewAnswers={...allAnswers};if(retain)for(const [key,value] of Object.entries(retained!.answers??{}))if(value)reviewAnswers[key]=true;
   const requiredAt=[event.createdAt,...pending.map(row=>row.event.createdAt),...(retain?[retained!.requiredAt]:[])].sort((a,b)=>Date.parse(a)-Date.parse(b)).at(-1)!;
   // A preview may use only the answers explicitly supplied for every outstanding area.
   // This projection never writes or invents an answer and leaves all other safety gates intact.
   mapped.screening={...mapped.screening,redFlagReview:{requiredAt,areas,questionKeys:questions.map(row=>row.key),answeredAt:new Date().toISOString(),answers:reviewAnswers}};
  }
  const item=effectivePainItem(record,event.itemIndex,event);
  if(action==='substitute'&&!tier&&mapped&&item){
   const result=substitute(item,{...mapped,cautions:[...new Set([...mapped.cautions,event.painArea!])],preferences:{...mapped.preferences,excludedExerciseIds:[...new Set([...mapped.preferences.excludedExerciseIds,...(record.plannedExercises??[]).flatMap(row=>row.itemIndex===event.itemIndex?[]:[effectivePainItem(record,row.itemIndex)?.exerciseId??row.exerciseId])])]}},'pain');
   if(!result.noop&&!result.gates.some(gate=>gate.status==='blocked'))preview.replacement={...result.value,sets:item.sets,itemIndex:event.itemIndex};
  }
  return{preview,areas,answers:allAnswers,history};
 }
 async function preview(workoutId:string,eventId:string,answers?:Record<string,boolean>){return(await assess(await load(workoutId,eventId),answers)).preview;}
 async function applyReview(workoutId:string,eventId:string,expectedRevision:number|undefined,answers:Record<string,boolean>|undefined,allowEnded:boolean){
  return repo.write(async()=>{
   const loaded=await load(workoutId,eventId),{record,event,state}=loaded;
   if(record.status!=='in_progress'&&!allowEnded)throw new DomainError('SESSION_READ_ONLY','TRAINING_ENDED');
   if(allowEnded&&record.status==='in_progress')return invalid('TRAINING_NOT_ENDED');
   const assessed=await assess(loaded,answers),result=assessed.preview;
   if(result.applied)return record;
   if(result.action==='none')return record;
   if(result.redFlagsRequired)return invalid('RED_FLAG_ANSWERS_REQUIRED');
   if(!state.coachProfile?.screening)return invalid('ENGINE_SCREENING_REQUIRED');
   const item=effectivePainItem(record,event.itemIndex,event),pattern=DATA.exercises.find(row=>row.id===event.exerciseId)?.primary_pattern??item?.prescription?.pattern;
   if(!pattern)return invalid('EXERCISE_PATTERN_UNKNOWN');
   if(!allowEnded&&result.action==='substitute'&&!result.blocked&&!result.replacement)return invalid('SAFE_SUBSTITUTE_UNAVAILABLE');
   const at=new Date().toISOString(),replacement=result.replacement?(({itemIndex:_,...value})=>value)(result.replacement):undefined;
   const excluded=[...new Set([event.itemIndex,...(record.plannedExercises??[]).filter(row=>{const manual=record.substitutions?.filter(item=>item.itemIndex===row.itemIndex).at(-1);return DATA.exercises.find(exercise=>exercise.id===(effectivePainItem(record,row.itemIndex)?.exerciseId??manual?.toExerciseId??row.exerciseId))?.primary_pattern===pattern;}).map(row=>row.itemIndex)])];
   const action:PainAction={eventId:event.id,appliedAt:at,kind:allowEnded&&result.action==='substitute'?'review':result.action,pattern:pattern as Pattern,itemIndex:event.itemIndex,...(replacement&&!result.blocked&&!allowEnded?{replacement}:{}),...(result.action==='exclude'?{excludedItemIndexes:excluded}:{}),redFlagAnswers:assessed.answers};
   const next=v8WorkoutSchema.parse({...record,painActions:[...record.painActions??[],action],painReviewRequired:result.blocked});
   const old=historyDangerReview(assessed.history,state.coachProfile.screening.redFlagReview),retain=unresolvedReview(old);
   const mergedAnswers={...(retain?old?.answers:{}),...assessed.answers};
   if(retain)for(const [key,value] of Object.entries(old?.answers??{}))if(value)mergedAnswers[key]=true;
   const review={requiredAt:retain&&Date.parse(old!.requiredAt)>Date.parse(event.createdAt)?old!.requiredAt:event.createdAt,questionKeys:[...new Set([...(retain?old!.questionKeys:[]),...result.questions.map(row=>row.key)])],areas:[...new Set([...(retain?old!.areas:[]),...assessed.areas])],answeredAt:at,answers:mergedAnswers};
   await repo.db.v8Workouts.put(next);
   await repo.db.v8State.put(v8StateSchema.parse({...state,coachProfile:{...state.coachProfile,screening:{...state.coachProfile.screening,redFlagReview:review}}}));
   return next;
  },expectedRevision);
 }
 async function confirmProfessionalSeen(expectedRevision?:number){
  return repo.write(async()=>{
   const state=await repo.db.v8State.get('v8'),history=await repo.db.v8Workouts.toArray(),review=historyDangerReview(history,state?.coachProfile?.screening?.redFlagReview);
   if(!state?.coachProfile?.healthStorageConsent||!state.coachProfile.screening?.completedAt||state.coachProfile.screening.parqAnswers?.length!==7||state.coachProfile.screening.rescreenRequired===true||pendingPainReviews(history).length||(!review&&!state.trainingPause)||(review&&(!review.answeredAt||!review.questionKeys.every(key=>typeof review.answers?.[key]==='boolean'))))return invalid('RED_FLAG_ANSWERS_REQUIRED');
   const at=new Date().toISOString();
   if(state.trainingPause&&(Date.parse(at)<Date.parse(state.trainingPause.requiredAt)||Date.parse(state.coachProfile.screening.completedAt)<Date.parse(state.trainingPause.requiredAt)))return invalid('RED_FLAG_ANSWERS_REQUIRED');
   const {trainingPause:_cleared,...retained}=state;
   const cautionLevels={...retained.cautionLevels};for(const area of review?.areas??[])if(area!=='other')cautionLevels[area]={level:1,changedAt:at};
   await repo.db.v8State.put(v8StateSchema.parse({...retained,cautionLevels,coachProfile:{...state.coachProfile,screening:{...state.coachProfile.screening,...(review?{redFlagReview:{...review,professionalSeenAt:at}}:{})}}}));
   if(repo.db.trainingCheckins){for(const row of await repo.db.trainingCheckins.toArray())if(row.jointPain){const {newOrWorseJointPain:_resolved,...answers}=row.answers;const {jointPain:_reviewed,...rest}=row;await repo.db.trainingCheckins.put({...rest,answers});}}
   const active=await repo.db.v8Workouts.where('status').equals('in_progress').toArray();
   for(const record of active)if(record.painReviewRequired)await repo.db.v8Workouts.put(v8WorkoutSchema.parse({...record,painReviewRequired:false}));
  },expectedRevision);
 }
 const apply=(workoutId:string,eventId:string,revision?:number,answers?:Record<string,boolean>)=>applyReview(workoutId,eventId,revision,answers,false);
 const completePastReview=(workoutId:string,eventId:string,revision?:number,answers?:Record<string,boolean>)=>applyReview(workoutId,eventId,revision,answers,true);
 return{preview,apply,completePastReview,confirmProfessionalSeen};
}
