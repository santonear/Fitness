import zh from '../i18n/features/coach/zh.json';
import en from '../i18n/features/coach/en.json';
import type { createV8Workflow } from '../application/v8-workflow';
import type { CoachProfile } from '../domain/v8/contracts';
import { coachRequestSchema, reviewFactsSchema, type CoachRequest } from './contracts';
import type { ReviewFacts } from '../application/review/contracts';

type Snapshot = Awaited<ReturnType<ReturnType<typeof createV8Workflow>['snapshot']>>;
export type CoachRequestInput = { task: CoachRequest['task']; data: Snapshot; conversationId?: string; instruction?: string; templateId?: string;
 profile?: CoachProfile; facts?: ReviewFacts; kind?:'week'|'month'; body?:CoachRequest['body']; history?:string };
/** Snapshot contains local versions only; never smuggle optional health fields into it. */
export function buildCoachRequest(input:CoachRequestInput):CoachRequest|undefined {
 const {data,task}=input;
 const profile=input.profile??data.state?.coachProfile;
 if(!profile?.adultConfirmed)return;
 const revision=data.metadata.dataRevision,generation=data.metadata.restoreGeneration??0;
 const common={version:'fitness-coach-v8',requestId:crypto.randomUUID(),conversationId:input.conversationId??crypto.randomUUID(),restoreGeneration:generation,
  inputSnapshot:JSON.stringify({revision,generation,versionId:data.version?.id}),sendConfirmation:'preview',locale:data.profile?.locale??'zh',timeZone:data.profile?.timeZone??'Asia/Shanghai',adultConfirmed:true,messages:[],...(input.body?{body:input.body}:{}),...(input.history?{history:input.history}:{})};
 if(task==='ONBOARD_PLAN'){
  const {confirmedAt:_confirmedAt,...sharedProfile}=profile;
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
  const {goalText,weeklyTarget,scheduleOriginalText,sessionMinutes,templates}=data.version;
  return coachRequestSchema.parse({...common,task,target,instruction,plan:{goalText,weeklyTarget,scheduleOriginalText,sessionMinutes,templates,reasons:['','',''].map(()=>copy.currentPlan)}});
 }
 const selectedId=input.templateId??data.active?.templateId??data.version.templates[0]?.id;
 const override=data.state?.nextWorkoutOverride;
 const template=data.active?.templateSnapshot??(!data.active&&override?.planVersionId===data.version.id&&override.templateId===selectedId?override.template:undefined)??data.version.templates.find(t=>t.id===selectedId);
 return template?coachRequestSchema.parse({...common,task,target,instruction,template,...(data.active?{workoutId:data.active.id}:{})}):undefined;
}
