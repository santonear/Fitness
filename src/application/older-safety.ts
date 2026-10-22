import {z} from 'zod';
import {DomainError} from '../domain/errors';
import {v8StateSchema} from '../domain/schemas';
import type {Repository} from '../persistence/repository';
import { endActiveWorkouts } from './training-stop';
const invalid=(message:string):never=>{throw new DomainError('INVALID',message);};
const answersSchema=z.strictObject({headHit:z.boolean(),cannotBearWeight:z.boolean()});
/** Unknown injury answers pause training; only explicit double-negative or professional review resolves them. */
export function createOlderSafety(repo:Repository){
 async function report(workoutId:string,expectedRevision?:number){return repo.write(async()=>{
  const state=await repo.db.v8State.get('v8');
  if(!state)return invalid('TRAINING_ENDED');
  const at=new Date().toISOString();await endActiveWorkouts(repo,at,workoutId);
  const {nextWorkoutOverride:_,...retained}=state;const {professionalSeenAt:__,...prior}=state.olderSafety??{};
  await repo.db.v8State.put(v8StateSchema.parse({...retained,olderSafety:{...prior,fallAt:at,reviewRequiredAt:state.olderSafety?.reviewRequiredAt??at}}));
 },expectedRevision);}
 async function answer(input:z.infer<typeof answersSchema>,expectedRevision?:number){const answers=answersSchema.parse(input);return repo.write(async()=>{
  const state=await repo.db.v8State.get('v8'),prior=state?.olderSafety;if(!state||!prior?.reviewRequiredAt)return invalid('FALL_REVIEW_NOT_REQUIRED');
  if(prior.injuryConfirmed)return invalid('FALL_PROFESSIONAL_REQUIRED');
  const next={...prior};if(answers.headHit||answers.cannotBearWeight)next.injuryConfirmed=true;
  else {delete next.reviewRequiredAt;next.balanceStage=Math.max(1,(prior.balanceStage??1)-1) as 1|2|3;}
  await repo.db.v8State.put(v8StateSchema.parse({...state,olderSafety:next}));
 },expectedRevision);}
 async function confirmProfessionalSeen(expectedRevision?:number){return repo.write(async()=>{const state=await repo.db.v8State.get('v8'),prior=state?.olderSafety;if(!state||!prior?.reviewRequiredAt)return invalid('FALL_REVIEW_NOT_REQUIRED');const at=new Date().toISOString();if(Date.parse(at)<Date.parse(prior.reviewRequiredAt))return invalid('FALL_CONFIRMATION_TOO_EARLY');const {reviewRequiredAt:_,injuryConfirmed:__,...retained}=prior;await repo.db.v8State.put(v8StateSchema.parse({...state,olderSafety:{...retained,professionalSeenAt:at}}));},expectedRevision);}
 return {report,answer,confirmProfessionalSeen};
}
