import {z} from 'zod';
import {DATA,calendarDay} from '../engine/data';
import {DomainError} from '../domain/errors';
import {v8StateSchema} from '../domain/schemas';
import type {Repository} from '../persistence/repository';
import type {EngineProfile} from '../engine/contracts';
import { weekStart } from '../domain/local-date';
export const postpartumReferralKeys=Object.freeze([...(DATA.rules.find(row=>row.id==='postpartum.referral_signs')!.value!.items as string[])]);
export const referralOccasions=['each_phase_transition','running_readiness_check','weekly_checkin'] as const;
export type ReferralOccasion=typeof referralOccasions[number];
export function requestedPostpartumPhase(population:EngineProfile['population']):1|2|3|undefined {
 if(population.kind!=='postpartum')return;
 const source=DATA.rules.find(row=>row.id==='postpartum.phase.boundaries')!.value!,buffer=population.delivery==='cesarean'||population.delivery==='assisted_or_tear'||population.perinealTrauma?source.buffer_weeks_if.default:0;
 return !population.cleared?1:population.weeksSinceBirth>=source.base_weeks.phase3_from+buffer?3:population.weeksSinceBirth>=source.base_weeks.phase2[0]+buffer?2:1;
}
export interface ReferralChecks {each_phase_transition?:{answeredAt:string;phase?:1|2|3};running_readiness_check?:{answeredAt:string};weekly_checkin?:{answeredAt:string}}
const invalid=(message:string):never=>{throw new DomainError('INVALID',message);};
export const postpartumReferralSchema=z.strictObject({occasion:z.enum(referralOccasions),answers:z.record(z.string(),z.boolean()),phase:z.union([z.literal(1),z.literal(2),z.literal(3)]).optional()}).superRefine((input,ctx)=>{
 if(Object.keys(input.answers).some(key=>!postpartumReferralKeys.includes(key))||!Object.values(input.answers).some(Boolean)&&!postpartumReferralKeys.every(key=>typeof input.answers[key]==='boolean'))ctx.addIssue({code:'custom',path:['answers'],message:'Every source referral sign requires an explicit answer'});
 if(input.occasion==='each_phase_transition'&&input.phase===undefined)ctx.addIssue({code:'custom',path:['phase'],message:'Actual requested transition phase required'});
});
/** Readiness and transitions require a check for that attempt. Weekly checks use the existing local calendar week. */
export function needsPostpartumReferralCheck(checks:ReferralChecks|undefined,occasion:ReferralOccasion,input:{asOfDate:string;timeZone:string;phase?:1|2|3;requestedAt?:string}){
 const check=checks?.[occasion];if(!check||!Number.isFinite(Date.parse(check.answeredAt))||!Number.isFinite(Date.parse(input.asOfDate)))return true;
 if(occasion==='weekly_checkin'){const day=calendarDay(check.answeredAt,input.timeZone);if(!day)return true;return day<weekStart(input.asOfDate)||day>input.asOfDate;}
 return !input.requestedAt||!Number.isFinite(Date.parse(input.requestedAt))||Date.parse(check.answeredAt)<Date.parse(input.requestedAt)||(occasion==='each_phase_transition'&&checks?.each_phase_transition?.phase!==input.phase);
}
export function createPostpartumReferral(repo:Repository){
 async function report(input:z.infer<typeof postpartumReferralSchema>,expectedRevision?:number){const value=postpartumReferralSchema.parse(input);return repo.write(async()=>{
  const state=await repo.db.v8State.get('v8'),profile=state?.coachProfile;if(!state||profile?.population?.kind!=='postpartum')return invalid('POSTPARTUM_CONTEXT_REQUIRED');
  const at=new Date().toISOString(),positive=postpartumReferralKeys.some(key=>value.answers[key]),prior=state.postpartumSafety??{},pop=profile.population;
  if(!positive&&!profile.healthStorageConsent?.acceptedAt)return invalid('HEALTH_STORAGE_CONSENT_REQUIRED');
  let safety=prior;
  if(positive){const current=requestedPostpartumPhase(pop)!;safety={...prior,lastSymptomAt:at,regression:{requiredAt:at,phase:prior.regression?.phase??Math.max(1,current-1) as 1|2|3,symptomFreeDates:[]}};}
  const checks=positive?undefined:profile.healthStorageConsent?.acceptedAt?{...state.postpartumReferralChecks,[value.occasion]:{answeredAt:at,...(value.occasion==='each_phase_transition'?{phase:value.phase}:{})}}:state.postpartumReferralChecks;
  const {nextWorkoutOverride:_,...retained}=state;
  await repo.db.v8State.put(v8StateSchema.parse({...retained,postpartumSafety:safety,postpartumReferralChecks:checks}));
  return {positive,copyKey:positive?'postpartum.copy.warning.warning' as const:undefined};
 },expectedRevision);}
 return {report};
}
