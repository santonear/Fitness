import {PelvicFloorDailyNotice} from './PelvicFloorDailyNotice';
import {CautionMorningControls} from './CautionMorningControls';
import {PregnancySafetyControls} from './PregnancySafetyControls';
import {CardiacClearancePanel} from './CardiacClearancePanel';
import {PostpartumSafetyPanel} from './PostpartumSafetyPanel';
import {EnginePlanNotices} from '../../components/EnginePlanNotices';
import {PendingPainReview} from '../../components/PendingPainReview';
import {PainProfessionalConfirmation} from '../../components/PainProfessionalConfirmation';
import {historyDangerReview} from '../../../application/pain-events';
import {engineCopy} from '../../../coach/engine-copy';
import {PreTrainingCheckin} from './PreTrainingCheckin';
import {pendingPainReviews} from '../../../application/pain-events';
import {TargetChanges} from './TargetChanges';
import {PrescriptionDetails} from './PrescriptionDetails';
import {SourceWarmupSteps} from './SourceWarmupSteps';
import {useFeature} from '../../useFeature';
import {templateLabel} from '../../../i18n/features/plan/labels';
import { planLifecycleCopy } from '../../../i18n/features/plan/lifecycle';
import { useState,useEffect } from 'react';
import { buildCoachRequest } from '../../../coach/request-builder';
import { coachMessageScope } from '../../../coach/consent';
import { CoachScopeDisclosure } from '../../components/CoachPanel';
import coachZh from '../../../i18n/features/coach/zh.json';
import coachEn from '../../../i18n/features/coach/en.json';
import { Button, Composer } from '../../components/common';
import { useMainline,workflow, format } from '../../mainline/context';
import { exercises } from '../../../catalog/exercises';
import { createV8DataService } from '../../../persistence/v8-access';
import { repository } from '../../../persistence/repository';
import { CoachVisual } from '../../components/CoachVisual';
export function NextPage(){
 const engineEnabled=useFeature('trainingEngine');
 const [preview,setPreview]=useState<{revision:number;versionId:string;templateId:string;value:Awaited<ReturnType<typeof workflow.nextTargetPreview>>}>();
 const {data,facts,t,slots,name,start,navigate,busy,run,openCoach,locale,sendHomeCoach,restartPlanning}=useMainline(); const [choice,setChoice]=useState<string>();
 const [message,setMessage]=useState('');const coachCopy=locale==='zh'?coachZh:coachEn;
 const version=data?.version, templates=version?.templates??[];
 const last=data?.workouts.filter(w=>w.planVersionId===version?.id&&w.status!=='in_progress'&&w.status!=='abandoned').sort((a,b)=>b.startedAt.localeCompare(a.startedAt))[0];
 const suggested=templates[(templates.findIndex(s=>s.id===last?.templateId)+1)%Math.max(1,templates.length)];
 const original=templates.find(s=>s.id===choice)??suggested;
 const override=data?.state?.nextWorkoutOverride;
 const baseline=override&&original&&override.planVersionId===version?.id&&override.templateId===original.id ? {...override!.template,id:original!.id}:original;
 useEffect(()=>{let alive=true;if(!engineEnabled||!original||!data?.version){setPreview(undefined);return;}const templateId=original.id,versionId=data.version.id,revision=data.metadata.dataRevision;void workflow.nextTargetPreview(templateId).then(value=>{if(alive)setPreview({templateId,versionId,revision,value});}).catch(()=>{if(alive)setPreview(undefined)});return()=>{alive=false}},[engineEnabled,original?.id,version?.id,data?.metadata.dataRevision]);
 const currentPreview=engineEnabled&&preview?.revision===data?.metadata.dataRevision&&preview?.versionId===version?.id&&preview?.templateId===original?.id?preview.value:undefined;
 const hasPendingPain=pendingPainReviews(data?.workouts??[]).length>0;
 const previewBlocked=!!data?.state?.cardiacPause||!!data?.state?.postpartumSafety?.urgentAt||!!data?.state?.trainingPause||hasPendingPain||!!currentPreview&&'blocked'in currentPreview&&currentPreview.blocked===true;
 const previewPending=engineEnabled&&!!version?.enginePlan&&!currentPreview;
 const selected=currentPreview?.template??baseline;
 const baseRequest=data?buildCoachRequest({task:'ADJUST_TODAY',data,templateId:selected?.id}):undefined;
 const homeRequest=baseRequest?.task==='ADJUST_TODAY'&&selected?{...baseRequest,template:selected}:baseRequest;
 const homePreview=homeRequest?coachMessageScope(homeRequest,message.slice(0,1600)):undefined;
 const acknowledge=(reminders=false)=>void run(async()=>{await createV8DataService(repository).acknowledgeMigrationNotice();if(reminders)navigate('/settings#reminders');});
 const lastSelected=data?.workouts.filter(w=>w.templateId===selected?.id&&w.planVersionId===version?.id&&w.status!=='abandoned').sort((a,b)=>b.startedAt.localeCompare(a.startedAt))[0];
 return <main><div className="v8-topline"><h1>{t.next}</h1><Button onClick={()=>navigate('/settings')}>{t.settings}</Button></div>
 <PelvicFloorDailyNotice/><CardiacClearancePanel/><PostpartumSafetyPanel/><PregnancySafetyControls/><PendingPainReview/>
 {data?.state?.trainingPause&&<p role="status">{engineCopy('redflag.copy.paused_banner',locale)}</p>}
 {data?.state?.trainingPause&&data.state.coachProfile?.healthStorageConsent&&data.state.coachProfile.screening?.completedAt&&data.state.coachProfile.screening.parqAnswers?.length===7&&data.state.coachProfile.screening.rescreenRequired!==true&&Date.parse(data.state.coachProfile.screening.completedAt)>=Date.parse(data.state.trainingPause.requiredAt)&&<PainProfessionalConfirmation pauseRequiredAt={data.state.trainingPause.requiredAt} review={historyDangerReview(data.workouts,data.state.coachProfile.screening.redFlagReview)} locale={locale} busy={busy} confirmLabel={t.confirm} onConfirm={()=>void run(async()=>{await workflow.confirmPainProfessionalSeen(data.metadata.dataRevision);})}/>}
 <CautionMorningControls/><PreTrainingCheckin/>
 {data?.state?.notice&&!data.state.notice.acknowledged&&(data.state.notice.planCount>1||data.hasFutureLegacyDates)&&<section className="v8-inline-panel">
 {data.state.notice.planCount>1&&<p>{format(t.migrationPlans,{count:data.state.notice.planCount,name:data.state.notice.currentPlanName??data.plan?.name??''})}</p>}
 {data.hasFutureLegacyDates&&<><p>{t.migrationDates}</p><Button onClick={()=>acknowledge(true)}>{t.setReminder}</Button></>}
 <Button onClick={()=>acknowledge()}>{data.hasFutureLegacyDates?t.dismissMigration:t.understood}</Button></section>}
 {facts&&version&&<slots.WeekProgress complete={facts.complete} partial={facts.partial} target={version.weeklyTarget} label={format(t.week,{complete:facts.complete,partial:facts.partial})}/>}
 {data?.active&&<Button onClick={()=>navigate(`/workout/${data.active!.id}`)}>{t.ongoing}</Button>}
 {selected?<><slots.FeatureCard context="next" motionReduced={false} trainingActive={false}><slots.StartHero {...selected} templateId={selected.id} templateLabel={templateLabel(selected,locale)} nextLabel={t.next} startLabel={t.start} disabled={busy||!!data?.active||previewBlocked||previewPending} onStart={()=>{if(!previewBlocked&&!previewPending)void start(selected.id)}}/><p className="v8-center">{!last?t.firstWorkoutReason:lastSelected?.status==='partial'?t.partialReason:format(t.reason,{minutes:selected.estimatedMinutes})}</p></slots.FeatureCard>
 {engineEnabled&&currentPreview&&<><TargetChanges suggestions={currentPreview.suggestions} templateId={selected.id} locale={locale} name={name}/><EnginePlanNotices plan={{...currentPreview,notices:currentPreview.notices.filter(notice=>!['pregnancy.pelvic_floor.copy','postpartum.pelvic_floor.copy'].includes(notice.code))}} locale={locale}/></>}<p>{t.details}</p><div className="v8-capsules">{selected.items.map((item,index)=><details key={index}><summary>{name(item.exerciseId)} · {item.sets} {t.sets}</summary><p>{exercises.find(e=>e.id===item.exerciseId)?.steps[data?.profile?.locale??'zh'].join(' ')}</p>{engineEnabled&&<><SourceWarmupSteps template={selected} itemIndex={index}/><PrescriptionDetails prescription={item.prescription} locale={locale}/></>}</details>)}</div>
 <div className="v8-row"><Button disabled={templates.length<2} onClick={()=>setChoice(templates[(templates.findIndex(item=>item.id===selected.id)+1)%templates.length].id)}>{t.switch}</Button><Button onClick={()=>navigate('/manual')}>{t.manual}</Button></div></>:<div className="v8-row"><Button variant="primary" onClick={restartPlanning}>{planLifecycleCopy[locale].create}</Button><Button onClick={()=>navigate('/manual')}>{t.manual}</Button></div>}
 <Button onClick={()=>navigate('/activity')}>{t.recordActivity}</Button>
 {homePreview&&<section><CoachScopeDisclosure request={homePreview} locale={locale}/><Composer value={message} onChange={value=>setMessage(value.slice(0,1600))} label={coachCopy.input} sendLabel={coachCopy.send} disabled={busy} onSend={()=>{if(homeRequest&&message.trim())sendHomeCoach(homeRequest,message);}}/></section>}
 <Button disabled={busy} onClick={()=>openCoach('ADJUST_TODAY',selected?.id)}><CoachVisual/>{t.askCoach}</Button>
 </main>;
}
