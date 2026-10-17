import {toEngineProfile} from '../application/engine-profile';
import {isFeatureEnabled} from '../application/feature-flags';
import type {FeatureName} from '../domain/feature-flags';
import zh from '../i18n/features/coach/zh.json';
import en from '../i18n/features/coach/en.json';
import type { createV8Workflow } from '../application/v8-workflow';
import type { CoachProfile } from '../domain/v8/contracts';
import { coachRequestSchema, reviewFactsSchema, type CoachRequest } from './contracts';
import type { ReviewFacts } from '../application/review/contracts';

type Snapshot = Awaited<ReturnType<ReturnType<typeof createV8Workflow>['snapshot']>>;
export type CoachRequestInput = { task: CoachRequest['task']; data: Snapshot; conversationId?: string; instruction?: string; templateId?: string;
 profile?: CoachProfile; facts?: ReviewFacts; kind?:'week'|'month'; body?:CoachRequest['body']; history?:string };
/** Explicit long-term wording takes precedence over a simultaneous reference to today. */
export const assistantPlanIntentDuringWorkout=(message:string)=>{
 if(/今天|这次|\btoday\b|this (?:time|workout|session)/i.test(message)&&!/以后|今后|每次|每周|from now on|every (?:time|week)/i.test(message))return false;
 return /计划|以后|今后|每次|每周|\bplan\b|\bfrom now on\b|\bevery (?:time|week)\b/i.test(message);
};
/** Snapshot contains local versions only; never smuggle optional health fields into it. */
export function buildCoachRequest(input:CoachRequestInput):CoachRequest|undefined {
 const {data,task}=input;
 const profile=input.profile??data.state?.coachProfile;
 if(!profile?.adultConfirmed||data.profile?.bodyDetails?.values.age!==undefined&&data.profile.bodyDetails.values.age<18)return;
 const revision=data.metadata.dataRevision,generation=data.metadata.restoreGeneration??0;
 const engineEnabled=isFeatureEnabled('trainingEngine' as FeatureName);
 const engineProfile=engineEnabled?toEngineProfile(profile,{asOfDate:new Intl.DateTimeFormat('en-CA',{timeZone:data.profile?.timeZone??'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),timeZone:data.profile?.timeZone,locale:data.profile?.locale,history:data.workouts,notes:[],ageYears:data.profile?.bodyDetails?.values.age}):undefined;
 const common={...(engineEnabled?{trainingEngine:true,engineProfile}:{}),version:'fitness-coach-v8',requestId:crypto.randomUUID(),conversationId:input.conversationId??crypto.randomUUID(),restoreGeneration:generation,
  candidateContext:{equipment:profile.equipment,cautions:profile.cautions},
  inputSnapshot:JSON.stringify({revision,generation,versionId:data.version?.id}),sendConfirmation:'preview',locale:data.profile?.locale??'zh',timeZone:data.profile?.timeZone??'Asia/Shanghai',adultConfirmed:true,messages:[],...(input.body?{body:input.body}:{}),...(input.history?{history:input.history}:{})};
 if(task==='ONBOARD_PLAN'){
  const {goalText,weeklyTarget,sessionMinutes,scheduleOriginalText,preferredDays,place,equipment,adultConfirmed,cautions,cautionNote}=profile;
  const sharedProfile={goalText,weeklyTarget,sessionMinutes,scheduleOriginalText,preferredDays,place,equipment,adultConfirmed,cautions,cautionNote};
  return coachRequestSchema.parse({...common,task,profile:sharedProfile});
 }
 if(!data.plan||!data.version)return;
 // Never substitute the current plan's first template for an older active workout.
 if(task==='ADJUST_TODAY'&&data.active&&data.active.planVersionId!==data.version.id)return;
 const target={planId:data.plan.id,versionId:data.version.id,revision};
 if(task==='PERIOD_REVIEW')return input.facts?coachRequestSchema.parse({...common,task,target,kind:input.kind??'week',facts:Object.fromEntries(Object.keys(reviewFactsSchema.shape).map(key=>[key,structuredClone(input.facts![key as keyof typeof input.facts])]))}):undefined;
 const copy=common.locale==='en'?en:zh;
 const instruction=input.instruction?.trim()||copy.defaultInstruction;
 if(task==='MODIFY_PLAN'){
  const {goalText,weeklyTarget,preferredDays,scheduleOriginalText,sessionMinutes,templates}=data.version;
  return coachRequestSchema.parse({...common,task,target,instruction,plan:{goalText,weeklyTarget,preferredDays,scheduleOriginalText,sessionMinutes,templates,reasons:['','',''].map(()=>copy.currentPlan)}});
 }
 const selectedId=input.templateId??data.active?.templateId??data.version.templates[0]?.id;
 const override=data.state?.nextWorkoutOverride;
 const template=data.active?.templateSnapshot??(!data.active&&override?.planVersionId===data.version.id&&override.templateId===selectedId?override.template:undefined)??data.version.templates.find(t=>t.id===selectedId);
 return template?coachRequestSchema.parse({...common,task,target,instruction,template,...(data.active?{workoutId:data.active.id}:{})}):undefined;
}
