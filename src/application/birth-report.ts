import {z} from 'zod';
import {DomainError} from '../domain/errors';
import {v8StateSchema} from '../domain/schemas';
import type {Repository} from '../persistence/repository';
import { endActiveWorkouts } from './training-stop';
export const birthReportSchema=z.strictObject({delivery:z.enum(['vaginal','assisted_or_tear','cesarean']),perinealTrauma:z.boolean(),postnatalCheckDone:z.boolean(),cleared:z.boolean()});
export type BirthReportInput=z.infer<typeof birthReportSchema>;
/** Birth changes the population atomically; it grants no clearance and never removes another safety latch. */
export function createBirthReport(repo:Repository){
 async function report(input:z.infer<typeof birthReportSchema>,expectedRevision?:number){const answers=birthReportSchema.parse(input);return repo.write(async()=>{
  const state=await repo.db.v8State.get('v8'),profile=state?.coachProfile;if(!state||profile?.population?.kind!=='pregnant')throw new DomainError('INVALID','PREGNANCY_CONTEXT_REQUIRED');
  if(!profile.healthStorageConsent?.acceptedAt)throw new DomainError('INVALID','HEALTH_STORAGE_CONSENT_REQUIRED');
  await endActiveWorkouts(repo,new Date().toISOString());
  const {nextWorkoutOverride:_,postpartumReferralChecks:__,...retained}=state;
  const population={kind:'postpartum' as const,weeksSinceBirth:0,...answers};
  await repo.db.v8State.put(v8StateSchema.parse({...retained,coachProfile:{...profile,population,...(profile.screening?{screening:{...profile.screening,rescreenRequired:true}}:{})}}));
  return {population,copyKey:'postpartum.gate.pre_check.copy' as const};
 },expectedRevision);}
 return {report};
}
