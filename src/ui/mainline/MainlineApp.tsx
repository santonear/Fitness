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
function OnboardingRoute(){const c=useMainline();return <OnboardingPage locale={c.locale} answers={c.answers} step={c.step} slots={c.slots} mode="basic" busy={c.busy} error={c.error} onChange={a=>{c.setAnswers(a);c.setCandidate(undefined);}} onStep={c.setStep} onManual={()=>c.navigate('/manual')} onGenerate={()=>void c.run(async()=>{c.setCandidate(await workflow.propose(localProfile(c.answers)));c.navigate(path('draft'));})}/>;}
function DraftRoute(){const c=useMainline();if(!c.candidate)return <Navigate to={path('onboarding')} replace/>;return <PlanDraftPage locale={c.locale} candidate={c.candidate} basic slots={c.slots} busy={c.busy} error={c.error} exerciseText={id=>({name:c.name(id),instructions:exercises.find(e=>e.id===id)?.steps[c.locale].join(' ')??''})} onDiscuss={()=>c.openCoach('ONBOARD_PLAN',undefined,c.candidate!.profile)} onConfirm={()=>void c.run(async()=>{await workflow.adopt(c.candidate!);c.navigate('/');})}/>;}
function Shell(){const c=useMainline();const{data,t,slots,navigate,error}=c,location=useLocation();const immersive=['/onboarding','/plan-draft'].includes(location.pathname)||location.pathname.startsWith('/workout/');
 if(!data)return <main className="v8-shell"><p role="status">{error||t.loading}</p></main>;
 return <div className="v8-shell" data-training-active={location.pathname.startsWith('/workout/')&&!location.pathname.endsWith('/finish')}>
 {!immersive&&location.pathname!=='/'&&<header className="v8-shell-header"><slots.BrandMark label={t.brand}/></header>}
 {error&&!['/onboarding','/plan-draft'].includes(location.pathname)&&<p role="alert">{error}</p>}
 <Routes><Route path="/settings/nutrition" element={<NutritionPage/>}/><Route path="/settings/import" element={<ActivityImportPage/>}/><Route path="/trial" element={<main><TrialAccess onStartPlanning={()=>navigate('/onboarding')}/><Button onClick={()=>navigate('/settings')}>{t.back}</Button></main>}/><Route path="/ai" element={<Navigate to="/onboarding" replace/>}/><Route path={path('exercises')} element={<ExercisesPage/>}/><Route path={path('plan')} element={<PlanRoute/>}/><Route path={path('versions')} element={<PlanRoute versions/>}/><Route path={path('activity')} element={<ActivityPage/>}/><Route path={path('onboarding')} element={<OnboardingRoute/>}/><Route path={path('draft')} element={<DraftRoute/>}/><Route path={path('next')} element={<NextPage/>}/><Route path={path('workout')} element={<WorkoutPage/>}/><Route path={path('finish')} element={<FinishPage/>}/><Route path="/manual" element={<ManualPage/>}/><Route path={path('review')} element={<ReviewPage/>}/><Route path={path('settings')} element={<SettingsPage/>}/><Route path={path('appearance')} element={<AppearancePage/>}/><Route path="*" element={<NextPage/>}/></Routes>
  {!immersive&&location.pathname!=='/activity'&&<><V8Reminder chatOpen={c.coachOpen} locale={c.locale} onStart={()=>navigate('/')} />{location.pathname!=='/'&&<Button className="v8-coach-launcher" aria-label={t.askCoach} onClick={()=>c.openCoach(location.pathname.startsWith('/review')?'PERIOD_REVIEW':'MODIFY_PLAN')}><CoachVisual/></Button>}</>}
 <CoachPanel initialSend={c.coachInitialSend} locale={c.locale} unavailableReason={data.active&&data.active.planVersionId!==data.version?.id?t.oldWorkout:undefined} onLocalPlan={()=>{c.setCoachOpen(false);navigate('/onboarding');}} onLocalReview={()=>{c.setCoachOpen(false);navigate('/review');}} open={c.coachOpen} onClose={()=>c.setCoachOpen(false)} request={c.coachRequest} expectedRevision={c.coachRevision} triggerRef={c.coachTrigger} onApply={async candidate=>{await workflow.applyCoachCandidate(candidate);await c.reload();if(candidate.request.task==='ONBOARD_PLAN')navigate('/');}}/>
 {!immersive&&<nav aria-label={t.brand}>{(['next','plan','review'] as const).map((id,i)=><Button key={id} onClick={()=>navigate(path(id))}><slots.NavIcon kind={(['training','plan','review'] as const)[i]} selected={location.pathname===path(id)} label={([t.training,t.plan,t.review])[i]}/>{([t.training,t.plan,t.review])[i]}</Button>)}</nav>}
 </div>;
}
export default function MainlineApp(){return <ThemeProvider><RestoreBoundary><MainlineProvider><Shell/></MainlineProvider></RestoreBoundary></ThemeProvider>;}
