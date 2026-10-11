import {bodyValuesSchema,type BodyValues} from '../domain/body-profile';
import {DomainError} from '../domain/errors';
import {repository,type Repository} from '../persistence/repository';
import {synchronizeTrainingMemo} from './training-memory';
import {activityDate} from './v8-activity';
export function createBodyProfileService(repo:Repository){return {
 async read(){return (await repo.db.profiles.toCollection().first())?.bodyDetails},
 async validateSending(body:Record<string,unknown>){const details=await this.read();if(!details?.confirmedAt||Object.entries(body).some(([key,value])=>!Object.hasOwn(details.values,key)||details.values[key as keyof BodyValues]!==value))throw Error('BODY_DETAILS_CHANGED')},
 async save(input:BodyValues,expectedRevision:number){const values=bodyValuesSchema.parse(input);return repo.write(async()=>{
  const profile=await repo.db.profiles.toCollection().first();if(!profile)throw new DomainError('INVALID','Profile missing');
  const now=new Date().toISOString(),previous=profile.bodyDetails;
  await repo.db.profiles.put({...profile,bodyDetails:{values,source:'entered',updatedAt:now,confirmedAt:now,weightPromptAt:values.weightKg!==previous?.values.weightKg?now:previous?.weightPromptAt},revision:profile.revision+1,updatedAt:now});
  if(values.weightKg!==undefined&&(values.weightKg!==previous?.values.weightKg||!previous?.confirmedAt))await repo.db.bodyWeights.add({id:crypto.randomUUID(),revision:0,createdAt:now,updatedAt:now,localDate:activityDate(profile.timeZone),timeZone:profile.timeZone,weightGrams:values.weightKg*1000});
  if(values.age!==undefined&&values.age<18){const state=await repo.db.v8State.get('v8');if(state?.coachProfile)await repo.db.v8State.put({...state,coachProfile:{...state.coachProfile,adultConfirmed:false}})}
  await synchronizeTrainingMemo(repo);
 },expectedRevision)},
 async dismissWeightPrompt(){return repo.write(async()=>{const profile=await repo.db.profiles.toCollection().first();if(profile?.bodyDetails)await repo.db.profiles.put({...profile,bodyDetails:{...profile.bodyDetails,weightPromptAt:new Date().toISOString()}})})},
 async remove(expectedRevision:number){return repo.write(async()=>{
  const profile=await repo.db.profiles.toCollection().first(),now=new Date().toISOString();if(!profile)return;
  const {heightCm:_height,weightGrams:_weight,...rest}=profile.trainingPreferences??{};
  await repo.db.profiles.put({...profile,bodyDetails:{values:{},source:'entered',updatedAt:now,confirmedAt:now,weightPromptAt:now},...(profile.trainingPreferences?{trainingPreferences:{...rest,updatedAt:now}}:{}),revision:profile.revision+1,updatedAt:now});
  const guided=await repo.db.guidedStates.get('guided');
  if(guided?.onboarding){const answers={...guided.onboarding.answers};for(const key of ['biologicalSex','age','heightCm','weightKg','waistCm']){if(guided.onboarding.version===4)answers[key]={status:'skipped'};else delete answers[key];}await repo.db.guidedStates.put({...guided,onboarding:{...guided.onboarding,answers}})}
  await repo.db.bodyWeights.clear();await synchronizeTrainingMemo(repo);
 },expectedRevision)}
}}
export const bodyProfileService=createBodyProfileService(repository);
