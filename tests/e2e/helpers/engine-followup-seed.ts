import {profileService} from '../../../src/application/profile';
import {repository} from '../../../src/persistence/repository';
import {createV8Workflow} from '../../../src/application/v8-workflow';
import {localProfile} from '../../../src/application/rules/local-profile';
import {painQuestionKeys} from '../../../src/application/pain-events';
import {refreshFeatureFlags,isFeatureEnabled} from '../../../src/application/feature-flags';
import {Rules} from '../../../src/engine/data';
import type {EngineCoachProfile} from '../../../src/application/engine-profile';

export type FollowupCase='pregnancy-active'|'beginner'|'knee-quiet'|'muscle'|'normal';

/** Explicit synthetic answers through real application services; never migration defaults. */
export async function seedFollowup(kind:FollowupCase){
  await refreshFeatureFlags();
  if(!isFeatureEnabled('trainingEngine'))throw Error('Preview trainingEngine flag is disabled');
  await profileService.initialize('zh');
  const rules=new Rules(),at=new Date().toISOString();
  const minutes=kind==='pregnancy-active'?60:30;
  const profile:EngineCoachProfile={
    ...localProfile({goalText:kind==='muscle'?'增肌':'保持健康',scheduleOriginalText:`每周3次，每次${minutes}分钟`,placeEquipmentText:'在家徒手',adultConfirmed:true,cautions:kind==='knee-quiet'?['knee']:[]}),
    goal:kind==='muscle'?'muscle':'health',
    level:kind==='beginner'?'beginner':'intermediate',
    birthYearMonth:'1990-01',
    healthStorageConsent:{acceptedAt:at},
    population:kind==='pregnancy-active'?{kind:'pregnant',week:20,prenatalCareConfirmed:true,providerCleared:true,contraindicationsConfirmedNone:true,lastScreenedWeek:20}:{kind:'general'},
    screening:{parqAllNo:true,parqAnswers:Array(7).fill(false),knownCondition:false,knownCmrDisease:false,symptoms:false,cmrSymptoms:Object.fromEntries(rules.get('safety.screen.cmr_symptoms').symptoms.map((key:string)=>[key,false])),activityStatus:'active',restingBp:'known_below_threshold',acuteIllness:false,completedAt:at,lastScreenedAt:at},
    ...(kind==='muscle'||kind==='normal'?{equipment:['none','dumbbell','flat-bench']}:{}),
    constraints:{quiet:kind==='knee-quiet',noJump:kind==='knee-quiet',space:kind==='muscle'?'medium':'small'},
  };
  if(profile.cautions.length){
    const questionKeys=painQuestionKeys(profile.cautions);
    profile.screening!.redFlagReview={requiredAt:at,answeredAt:at,areas:profile.cautions,questionKeys,answers:Object.fromEntries(questionKeys.map(key=>[key,false]))};
  }
  const workflow=createV8Workflow(repository);
  const candidate=await workflow.propose(profile,'zh',{trainingEngine:true});
  const version=await workflow.adopt(candidate);
  return {version,profile:(await workflow.snapshot()).state!.coachProfile};
}

export async function followupSnapshot(){
  return createV8Workflow(repository).snapshot();
}

export async function startFollowup(templateId:string){
  return createV8Workflow(repository).start(templateId);
}
