import {effectiveCautionLevels} from '../../../application/caution-safety';
import {CautionSettingsPanel} from './CautionSettingsPanel';
import {InitialCautionScreen} from './InitialCautionScreen';
import {requestedPostpartumPhase} from '../../../application/postpartum-referral';
import {PostpartumReferralQuestions} from '../training/PostpartumSafetyPanel';
import {PregnancySafetyControls} from '../training/PregnancySafetyControls';
import {CardiacClearancePanel} from '../training/CardiacClearancePanel';
import {PostpartumSafetyPanel} from '../training/PostpartumSafetyPanel';
import {EngineEnvironmentEditor} from './EngineEnvironmentEditor';
import {engineCopy} from '../../../coach/engine-copy';
import {historyDangerReview} from '../../../application/pain-events';
import {PendingPainReview} from '../../components/PendingPainReview';
import {PainProfessionalConfirmation} from '../../components/PainProfessionalConfirmation';
import {useState} from 'react';
import {EngineProfileEditor} from './EngineProfileEditor';
import {EnginePreferencesEditor} from './EnginePreferencesEditor';
import type {EngineProfileFields} from '../../../application/engine-profile';
import {repository} from '../../../persistence/repository';
import {v8CoachProfileSchema} from '../../../domain/schemas';
import {useMainline,workflow} from '../../mainline/context';
import {Button} from '../../components/common';

function screeningDraft(profile:EngineProfileFields,requiredAt?:string):EngineProfileFields{
 if(requiredAt&&profile.screening&&(!profile.screening.completedAt||Date.parse(profile.screening.completedAt)<Date.parse(requiredAt)))return {...profile,screening:{...profile.screening,parqAnswers:undefined,completedAt:undefined,lastScreenedAt:undefined,rescreenRequired:true}};
 return profile;
}
export function EngineProfilePage(){
 const [requestedAt]=useState(()=>new Date().toISOString());
 const c=useMainline(),[environment,setEnvironment]=useState(()=>({place:c.data?.state?.coachProfile?.place??'home',equipment:c.data?.state?.coachProfile?.equipment??['none']})),[fields,setFields]=useState<EngineProfileFields>(()=>{
  return screeningDraft(c.data?.state?.coachProfile??{},c.data?.state?.trainingPause?.requiredAt);
 });
 const oldPhase=requestedPostpartumPhase(c.data?.state?.coachProfile?.population??{kind:'general'}),newPhase=requestedPostpartumPhase(fields.population??{kind:'general'});
 return <main><CardiacClearancePanel/><PostpartumSafetyPanel/><PregnancySafetyControls/>{c.data?.state?.trainingPause&&<p role="status">{engineCopy('redflag.copy.paused_banner',c.locale)}</p>}<PendingPainReview onComplete={()=>c.navigate('/settings')}/>{c.data?.state?.coachProfile?.healthStorageConsent&&c.data.state.coachProfile.screening?.completedAt&&c.data.state.coachProfile.screening.parqAnswers?.length===7&&c.data.state.coachProfile.screening.rescreenRequired!==true&&(!c.data.state.trainingPause||Date.parse(c.data.state.coachProfile.screening.completedAt)>=Date.parse(c.data.state.trainingPause.requiredAt))&&<PainProfessionalConfirmation pauseRequiredAt={c.data.state.trainingPause?.requiredAt} review={historyDangerReview(c.data.workouts,c.data.state.coachProfile.screening?.redFlagReview)} locale={c.locale} busy={c.busy} confirmLabel={c.t.confirm} onConfirm={()=>void c.run(async()=>{await workflow.confirmPainProfessionalSeen(c.data!.metadata.dataRevision);c.navigate('/settings');})}/>}<EngineProfileEditor key={c.data?.state?.trainingPause?.requiredAt} ageYears={c.data?.profile?.bodyDetails?.values.age} locale={c.locale} value={screeningDraft(fields,c.data?.state?.trainingPause?.requiredAt)} onChange={setFields}/>{c.data?.state?.coachProfile&&<EngineEnvironmentEditor value={{...c.data.state.coachProfile,...fields,...environment}} locale={c.locale} onChange={value=>{setEnvironment({place:value.place,equipment:value.equipment});setFields({...fields,householdSupport:value.householdSupport});}}/>}{oldPhase&&newPhase&&newPhase>oldPhase&&<PostpartumReferralQuestions occasion="each_phase_transition" phase={newPhase} requestedAt={requestedAt}/>}<CautionSettingsPanel locale={c.locale} busy={c.busy} levels={effectiveCautionLevels(c.data?.state?.cautionLevels,c.data?.workouts??[],c.data?.state?.painFollowupRestrictions,c.data?.state?.coachProfile?.cautions)} activeJoints={(c.data?.state?.coachProfile?.cautions??[]).filter(area=>area!=='other')} onReview={input=>void c.run(async()=>{await workflow.reviewCaution(input,c.data!.metadata.dataRevision);const state=await repository.db.v8State.get('v8');setFields(draft=>({...draft,cautions:state?.coachProfile?.cautions,screening:state?.coachProfile?.screening}));})}/><InitialCautionScreen locale={c.locale} value={fields} onChange={setFields}/><EnginePreferencesEditor locale={c.locale} value={fields} onChange={setFields}/><Button onClick={()=>void c.run(async()=>{
  const state=await repository.db.v8State.get('v8');if(!state?.coachProfile)throw Error('PROFILE_REQUIRED');const currentScreen=state.coachProfile.screening;const screening=fields.screening?{...fields.screening,redFlagReview:currentScreen?.redFlagReview?.professionalSeenAt||Object.values(currentScreen?.redFlagReview?.answers??{}).some(Boolean)?currentScreen?.redFlagReview:fields.screening.redFlagReview??currentScreen?.redFlagReview}:currentScreen?{...currentScreen,rescreenRequired:true,clearance:undefined}:undefined;const coachProfile=v8CoachProfileSchema.parse({...state.coachProfile,...fields,...environment,...(!fields.healthStorageConsent?{healthStorageConsent:undefined,population:undefined,screening:undefined,birthYearMonth:undefined,painState:undefined,powerOneRm:undefined,postpartumRisk:undefined}:{screening})});await workflow.saveEngineSettings(coachProfile,c.data!.metadata.dataRevision,requestedAt);await c.reload();c.navigate('/settings');
 })}>{c.locale==='zh'?'保存':'Save'}</Button></main>;
}
