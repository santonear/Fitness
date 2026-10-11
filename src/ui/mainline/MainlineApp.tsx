import {useState,useRef,useEffect} from 'react';
import {useAccessStatus} from '../useAccessStatus';
import {sendAssistant} from '../../assistant/client';
import {buildCoachRequest} from '../../coach/request-builder';
import {approveCoachScope} from '../../coach/consent';
import type {LocalCandidate} from '../../application/v8-workflow';
import {bodyProfileService} from '../../application/body-profile';
import {useFeature} from '../useFeature';
import {BodyProfilePage} from '../pages/settings/BodyProfilePanel';
import {bodyCopy} from '../../i18n/features/onboarding/body';
import {MaintenanceBanner} from '../admin/finance/MaintenanceBanner';
import { planLifecycleCopy } from '../../i18n/features/plan/lifecycle';
import { Toast } from '../components/common/Toast';
import { RestoreBoundary } from './RestoreBoundary';
import { Routes,Route,useLocation,Navigate } from 'react-router-dom';
import { ThemeProvider } from '../../themes/ThemeProvider';
import { MainlineProvider,useMainline,workflow } from './context';
import { localProfile } from '../../application/rules/local-profile';
import { exercises } from '../../catalog/exercises';
import { Button } from '../components/common';
import { TrialAccess } from '../components/TrialAccess';
import { CoachPanel } from '../components/CoachPanel';
import { CoachVisual } from '../components/CoachVisual';
import { V8Reminder } from '../components/V8Reminder';
import { OnboardingPage } from '../pages/onboarding/OnboardingPage';
import { PlanDraftPage } from '../pages/onboarding/PlanDraftPage';
import { ExercisesPage } from '../pages/plan/ExercisesPage';
import { PlanRoute } from '../pages/plan/PlanRoute';
import { ActivityPage } from '../pages/training/ActivityPage';
import { NextPage } from '../pages/training/NextPage';
import { WorkoutPage } from '../pages/training/WorkoutPage';
import { FinishPage } from '../pages/training/FinishPage';
import { ManualPage } from '../pages/training/ManualPage';
import { ReviewPage } from '../pages/review/ReviewPage';
import { SettingsPage } from '../pages/settings/SettingsPage';
import { AppearancePage } from '../pages/settings/AppearancePage';
import { NutritionPage } from '../pages/settings/NutritionPage';
import { ActivityImportPage } from '../pages/settings/ActivityImportPage';
import { v8Routes,type V8RouteId } from '../routes.contract';
import '../theme.css';
import './mainline.css';
const path=(id:V8RouteId)=>v8Routes.find(r=>r.id===id)!.path;
function OnboardingRoute(){const c=useMainline(),bodyEnabled=useFeature('bodyProfile'),assistant=useFeature('aiAssistantV2'),access=useAccessStatus(assistant);const [reply,setReply]=useState(''),[notice,setNotice]=useState('');const abort=useRef<AbortController>(null);useEffect(()=>()=>abort.current?.abort(),[]);const eligible=assistant&&access.status?.qualification==='active'&&access.status.sessionValid&&access.status.aiEnabled===true;return <><OnboardingPage bodyEnabled={bodyEnabled} locale={c.locale} answers={c.answers} step={c.step} slots={c.slots} mode={eligible?'ai':'basic'} busy={c.busy} error={c.error} onChange={a=>{c.setAnswers(a.body?.age!==undefined&&a.body.age<18?{...a,adultConfirmed:false}:a);c.setCandidate(undefined);}} onStep={step=>{if(bodyEnabled&&c.step===1&&step===2)void c.run(async()=>{await bodyProfileService.save(c.answers.body??{},c.data!.metadata.dataRevision);c.setStep(step)});else c.setStep(step)}} onManual={()=>c.navigate('/manual')} onGenerate={()=>void c.run(async()=>{
 const profile=localProfile(c.answers);setReply('');setNotice('');let candidate:LocalCandidate|undefined;
 if(eligible&&c.data){const raw=buildCoachRequest({task:'ONBOARD_PLAN',data:c.data,profile});if(raw){const context=await approveCoachScope(raw),controller=new AbortController();abort.current=controller;
 try{await sendAssistant({version:'fitness-assistant-v2',requestId:context.requestId,conversationId:context.conversationId,locale:c.locale,timeZone:context.timeZone,adultConfirmed:context.adultConfirmed,context,consent:{body:false,history:false},messages:[{role:'user',content:c.locale==='zh'?'请根据我的目标和可用时间，拟一份训练计划。':'Please draft a training plan for my goals and available time.'}]},controller.signal,event=>{if(event.type==='text_delta')setReply(value=>value+event.delta);if(event.type==='attachment'&&event.attachment.type==='plan_proposal'&&event.attachment.requestId===context.requestId&&event.attachment.restoreGeneration===context.restoreGeneration)candidate={...event.attachment,profile,expectedRevision:c.data!.metadata.dataRevision,source:'ai'};});}catch{if(controller.signal.aborted)return;setNotice(c.locale==='zh'?'AI 暂时无法生成，已提供基础方案。':'AI is unavailable. A basic plan is ready.');}}
 }
 c.setCandidate(candidate??await workflow.propose(profile,c.locale));c.navigate(path('draft'));
 })}/>{reply&&<p role="status">{reply}</p>}{notice&&<p role="status">{notice}</p>}{c.busy&&eligible&&<Button onClick={()=>abort.current?.abort()}>{c.locale==='zh'?'停止':'Stop'}</Button>}</>;}
function DraftRoute(){const c=useMainline(),bodyEnabled=useFeature('bodyProfile');if(!c.candidate)return <Navigate to={c.draftDiscarded?'/':path('onboarding')} replace/>;return <PlanDraftPage locale={c.locale} candidate={c.candidate} basic={c.candidate.source!=='ai'} onEditCautions={c.candidate.profile.cautions.length?()=>{c.setStep(bodyEnabled?4:3);c.navigate(path('onboarding'));}:undefined} slots={c.slots} busy={c.busy} error={c.error} exerciseText={id=>({name:c.name(id),instructions:exercises.find(e=>e.id===id)?.steps[c.locale].join(' ')??''})} onDiscard={()=>{c.setDraftDiscarded(true);c.setCandidate(undefined);c.navigate('/');}} onDiscuss={()=>c.openCoach('ONBOARD_PLAN',undefined,c.candidate!.profile)} onConfirm={()=>void c.run(async()=>{await workflow.adopt(c.candidate!);c.navigate('/');})}/>;}
function Shell(){const c=useMainline();const{data,t,slots,navigate,error}=c,location=useLocation();const immersive=['/onboarding','/plan-draft'].includes(location.pathname)||location.pathname.startsWith('/workout/');const reviewing=location.pathname===path('review'),bodyEnabled=useFeature('bodyProfile');
 if(!data)return <main className="v8-shell"><p role="status">{error||t.loading}</p></main>;
 return <div className="v8-shell" data-training-active={location.pathname.startsWith('/workout/')&&!location.pathname.endsWith('/finish')}>
 {bodyEnabled&&data.profile?.bodyDetails?.source==='migrated'&&!data.profile.bodyDetails.confirmedAt&&location.pathname!=='/settings/body'&&<aside><p>{bodyCopy[c.locale].migrated}</p><Button onClick={()=>navigate('/settings/body')}>{bodyCopy[c.locale].settingsTitle}</Button></aside>}<MaintenanceBanner training={location.pathname.startsWith('/workout/')} language={c.locale}/>{!immersive&&location.pathname!=='/'&&<header className={`v8-shell-header${reviewing?' v8-review-header':''}`}><slots.BrandMark label={t.brand}/>{reviewing&&<Button className="v8-review-coach" aria-label={t.askCoach} onClick={()=>c.openCoach('PERIOD_REVIEW')}><CoachVisual/></Button>}</header>}
 {error&&!['/onboarding','/plan-draft'].includes(location.pathname)&&<p role="alert">{error}</p>}
 <Routes><Route path="/settings/body" element={bodyEnabled||data.profile?.bodyDetails?<BodyProfilePage/>:<Navigate to="/settings" replace/>}/><Route path="/settings/nutrition" element={<NutritionPage/>}/><Route path="/settings/import" element={<ActivityImportPage/>}/><Route path="/trial" element={<main><TrialAccess onStartPlanning={c.restartPlanning}/><Button onClick={()=>navigate('/settings')}>{t.back}</Button></main>}/><Route path="/ai" element={<Navigate to="/onboarding" replace/>}/><Route path={path('exercises')} element={<ExercisesPage/>}/><Route path={path('plan')} element={<PlanRoute/>}/><Route path={path('versions')} element={<PlanRoute versions/>}/><Route path={path('activity')} element={<ActivityPage/>}/><Route path={path('onboarding')} element={<OnboardingRoute/>}/><Route path={path('draft')} element={<DraftRoute/>}/><Route path={path('next')} element={<NextPage/>}/><Route path={path('workout')} element={<WorkoutPage/>}/><Route path={path('finish')} element={<FinishPage/>}/><Route path="/manual" element={<ManualPage/>}/><Route path={path('review')} element={<ReviewPage/>}/><Route path={path('settings')} element={<SettingsPage/>}/><Route path={path('appearance')} element={<AppearancePage/>}/><Route path="*" element={<NextPage/>}/></Routes>
  {!immersive&&location.pathname!=='/activity'&&location.pathname!=='/manual'&&<><V8Reminder chatOpen={c.coachOpen} locale={c.locale} onStart={()=>navigate('/')} />{location.pathname!=='/'&&!reviewing&&<Button className="v8-coach-launcher" aria-label={t.askCoach} onClick={()=>c.openCoach('MODIFY_PLAN')}><CoachVisual/></Button>}</>}
 <Toast key={c.deletedNotice?.expiresAt} message={c.deletedNotice?planLifecycleCopy[c.locale].deleted:null} duration={c.deletedNotice?Math.max(0,c.deletedNotice.expiresAt-Date.now()):10000} onDismiss={()=>c.setDeletedNotice(undefined)} action={c.deletedNotice?{label:planLifecycleCopy[c.locale].undo,onClick:()=>void c.undoPlan(),disabled:c.busy}:undefined}/>
 <CoachPanel beforeSend={async request=>{if(request.body)await bodyProfileService.validateSending(request.body)}} initialSend={c.coachInitialSend} locale={c.locale} unavailableReason={data.active&&data.active.planVersionId!==data.version?.id?t.oldWorkout:undefined} onLocalPlan={()=>{c.setCoachOpen(false);navigate('/onboarding');}} onLocalReview={()=>{c.setReviewKind('week');c.setCoachOpen(false);navigate('/review');}} open={c.coachOpen} onClose={()=>c.setCoachOpen(false)} request={c.coachRequest} expectedRevision={c.coachRevision} triggerRef={c.coachTrigger} onApply={async candidate=>{await workflow.applyCoachCandidate(candidate);c.refreshCoachContext(await c.reload());if(candidate.request.task==='ONBOARD_PLAN')navigate('/');}}/>
 {!immersive&&<nav aria-label={t.brand}>{(['next','plan','review'] as const).map((id,i)=><Button key={id} onClick={()=>navigate(path(id))}><slots.NavIcon kind={(['training','plan','review'] as const)[i]} selected={location.pathname===path(id)} label={([t.training,t.plan,t.review])[i]}/>{([t.training,t.plan,t.review])[i]}</Button>)}</nav>}
 </div>;
}
export default function MainlineApp(){return <ThemeProvider><RestoreBoundary><MainlineProvider><Shell/></MainlineProvider></RestoreBoundary></ThemeProvider>;}
