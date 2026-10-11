import { useFeature } from '../useFeature';
import { isFeatureEnabled } from '../../application/feature-flags';
import { countUsage, reportSafeError } from '../../application/monitoring-client';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../../themes/ThemeProvider';
import { getThemeSlots } from '../../themes/registry';
import { createV8Workflow, type LocalCandidate, type ManualSelection } from '../../application/v8-workflow';
import { optionalCoachBody,optionalCoachHistory } from '../../application/v8-coach-optional';
import { activityDate } from '../../application/v8-activity';
import { backfillOnboarding } from '../../application/v8-onboarding-backfill';
import { buildCoachRequest } from '../../coach/request-builder';
import type { CoachRequest } from '../../coach/contracts';
import type { CoachProfile } from '../../domain/v8/contracts';
import i18n from '../../i18n';
import { profileService } from '../../application/profile';
import { repository } from '../../persistence/repository';
import { createV8DataService } from '../../persistence/v8-access';
import { computeMonthFacts, computeWeekFacts } from '../../application/review/compute';
import { exercises } from '../../catalog/exercises';
import type { OnboardingAnswers } from '../pages/onboarding/OnboardingPage';
import type { MonthFacts, WeekFacts } from '../../application/review/contracts';
import zh from '../../i18n/features/training/zh.json';
import en from '../../i18n/features/training/en.json';
export const workflow = createV8Workflow(repository);
const blank: OnboardingAnswers = { goalText: '', scheduleOriginalText: '', placeEquipmentText: '', adultConfirmed: false, cautions: [] };
function week(timeZone: string) {
 const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
 const date = new Date(`${['year','month','day'].map(type => parts.find(p => p.type === type)!.value).join('-')}T00:00:00Z`);
 date.setUTCDate(date.getUTCDate() - (date.getUTCDay()+6)%7); const from = date.toISOString().slice(0,10); date.setUTCDate(date.getUTCDate()+6);
 return { from, to: date.toISOString().slice(0,10) };
}
function useController() {
 const planLifecycle=useFeature('planLifecycle');
 const navigate = useNavigate(), location = useLocation(), appearance = useTheme();
 const [data,setData] = useState<Awaited<ReturnType<typeof workflow.snapshot>>>();
 const [monthFacts,setMonthFacts] = useState<MonthFacts>(), [previousFacts,setPreviousFacts]=useState<WeekFacts>(), [facts,setFacts] = useState<WeekFacts>(), [answers,setAnswers] = useState(blank), [step,setStep] = useState<0|1|2|3|4>(0);
 const [completedWeeks,setCompletedWeeks] = useState<[WeekFacts,WeekFacts]>();
 const [optionalCoach,setOptionalCoach]=useState<{body?:CoachRequest['body'];history?:string}>({});
 const [reviewKind,setReviewKind] = useState<'week'|'month'>('week');
 const [draftDiscarded,setDraftDiscarded]=useState(false);
 const [deletedNotice,setDeletedNotice]=useState<{planId:string;expiresAt:number}>();
 const [candidate,setCandidate] = useState<LocalCandidate>(), [busy,setBusy] = useState(false), [error,setError] = useState('');
 const [coachOpen,setCoachOpen]=useState(false),[coachRequest,setCoachRequest]=useState<CoachRequest>(),[coachRevision,setCoachRevision]=useState(0);
 const [coachInitialSend,setCoachInitialSend]=useState<{nonce:string;message:string;request:CoachRequest;expectedRevision:number}>();
 function sendHomeCoach(request:CoachRequest,message:string){if(!data)return;coachTrigger.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setCoachRequest(request);setCoachRevision(data.metadata.dataRevision);setCoachInitialSend({nonce:crypto.randomUUID(),message,request,expectedRevision:data.metadata.dataRevision});setCoachOpen(true);}
 const coachTrigger=useRef<HTMLElement|null>(null);
 function openCoach(task:CoachRequest['task']='MODIFY_PLAN',templateId?:string,profile?:CoachProfile){
  if(!data)return;
  coachTrigger.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const selectedFacts=reviewKind==='month'?monthFacts:facts;
  const nextRequest=buildCoachRequest({...optionalCoach,task,data,templateId,profile,facts:selectedFacts?{...selectedFacts,improvements:[...selectedFacts.improvements]}:undefined,kind:reviewKind});
  const key=(request:CoachRequest|undefined)=>{if(!request)return '';const{requestId:_requestId,conversationId:_conversationId,...content}=request;return JSON.stringify(content);};
  if(key(nextRequest)!==key(coachRequest)||coachRevision!==data.metadata.dataRevision){
   setCoachRequest(nextRequest);setCoachRevision(data.metadata.dataRevision);
  }
  setCoachOpen(true);
 }
 function refreshCoachContext(next:Awaited<ReturnType<typeof workflow.snapshot>>){
  if(!coachRequest)return;
  const task=coachRequest.task==='ONBOARD_PLAN'?'MODIFY_PLAN':coachRequest.task;
  const currentFacts=reviewKind==='month'?monthFacts:facts;
  setCoachRequest(buildCoachRequest({...optionalCoach,conversationId:coachRequest.conversationId,task,data:next,templateId:coachRequest.task==='ADJUST_TODAY'?coachRequest.template.id:undefined,facts:currentFacts?{...currentFacts,improvements:[...currentFacts.improvements]}:undefined,kind:reviewKind}));
  setCoachRevision(next.metadata.dataRevision);
 }
 const [workoutValues,setWorkoutValues]=useState<Record<string,number>>({}),[focusIndex,setFocusIndex]=useState(0);
 const [ready,setReady] = useState(false); const draftKey = useRef(''), lock = useRef(false);
 const locale: 'zh'|'en' = data?.profile?.locale === 'en' ? 'en' : 'zh', t = locale === 'zh' ? zh : en;
 const observedCounts=useRef<{plans:number;started:number;completed:number}|undefined>(undefined);
 async function reload() {
  if(isFeatureEnabled('planLifecycle'))await workflow.purgeExpiredPlans();
  const next = await workflow.snapshot(); setData(next);
  const counters={plans:next.versions.length,started:next.workouts.length,completed:next.workouts.filter(w=>['complete','partial','not_started'].includes(w.status)).length};
  if(observedCounts.current){for(const [key,event] of [['plans','plan_confirmed'],['started','workout_started'],['completed','workout_completed']] as const){const delta=counters[key]-observedCounts.current[key];if(delta>0)countUsage(event,delta);}}observedCounts.current=counters;
  const review = await createV8DataService(repository).getReviewWorkouts();
  setOptionalCoach({body:optionalCoachBody(next.profile),history:optionalCoachHistory([...review.legacyWorkouts,...review.workouts],activityDate(next.profile?.timeZone??'Asia/Shanghai'),next.profile?.timeZone??'Asia/Shanghai',next.profile?.locale==='en'?'en':'zh')});
  const input={ ...week(next.profile?.timeZone ?? 'Asia/Shanghai'), timeZone: next.profile?.timeZone ?? 'Asia/Shanghai', weeklyTarget: next.version?.weeklyTarget ?? next.state?.reviewWeeklyTarget ?? next.state?.coachProfile?.weeklyTarget ?? 2, ...review, activities: next.activities, bodyWeights: await repository.db.bodyWeights.toArray() };
  setFacts(computeWeekFacts(input));
  const shift=(d:string,n:number)=>new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
  const previous=computeWeekFacts({...input,from:shift(input.from,-7),to:shift(input.from,-1)});
  setPreviousFacts(previous);
  setCompletedWeeks([computeWeekFacts({...input,from:shift(input.from,-14),to:shift(input.from,-8)}),previous]);
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:input.timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const year=Number(today.find(p=>p.type==='year')!.value),month=Number(today.find(p=>p.type==='month')!.value);
  setMonthFacts(computeMonthFacts({...input,from:new Date(Date.UTC(year,month-1,1)).toISOString().slice(0,10),to:new Date(Date.UTC(year,month,0)).toISOString().slice(0,10)}));
  return next;
 }
 async function run(action: () => Promise<void>) { if(lock.current)return; lock.current=true;setBusy(true);setError('');try{await action();await reload();}catch{reportSafeError('storage');setError(t.saveError);}finally{lock.current=false;setBusy(false);} }
 useEffect(()=>{let alive=true;void(async()=>{
  let initialLocale:'zh'|'en'='zh';try{if(localStorage.getItem('fitness.language')==='en')initialLocale='en';}catch{/* Use the default when storage is unavailable. */}await profileService.initialize(initialLocale);const next=await reload();if(!alive)return;
  if(next.profile)await i18n.changeLanguage(next.profile.locale);if(!alive)return;
  draftKey.current=`fitness-v8-draft:${next.metadata.localProfileId}:${next.metadata.restoreGeneration??0}`;
  const legacy=await repository.db.guidedStates.get('guided');
  if(legacy?.onboarding?.answers)setAnswers(backfillOnboarding(legacy.onboarding.answers,next.profile?.locale==='en'?'en':'zh'));
  if(next.state?.coachProfile){const p=next.state.coachProfile;setAnswers({goalText:p.goalText,scheduleOriginalText:p.scheduleOriginalText,placeEquipmentText:[p.place,...p.equipment].join(' · '),adultConfirmed:p.adultConfirmed,cautions:p.cautions});}
  try{const saved=JSON.parse(localStorage.getItem(draftKey.current)??'null');if(saved?.answers && ['goalText','scheduleOriginalText','placeEquipmentText'].every(k=>typeof saved.answers[k]==='string') && typeof saved.answers.adultConfirmed==='boolean' && Array.isArray(saved.answers.cautions)){if(next.profile?.bodyDetails&&(!saved.updatedAt||saved.updatedAt<next.profile.bodyDetails.updatedAt)){saved.answers.body=next.profile.bodyDetails.values;saved.answers.bodyText=''}setAnswers(saved.answers);if([0,1,2,3,4].includes(saved.step))setStep(saved.step);}}catch{/* Preserve unknown raw draft. */}
  setAnswers(previous=>({...previous,body:previous.body??next.profile?.bodyDetails?.values}));
  setReady(true);
  if(location.pathname==='/'&&!next.state?.planDismissedAt&&!next.plans.length&&!next.deletedPlans.length&&!next.version&&!next.active&&!legacy?.onboarding?.completed&&await repository.db.sessions.count()===0)navigate('/onboarding',{replace:true});
 })().catch(()=>{if(alive)setError(t.loadError);});return()=>{alive=false;};},[]);
 useEffect(()=>{if(ready&&planLifecycle)void reload().catch(()=>setError(t.loadError));},[ready,planLifecycle]);
 useEffect(()=>{if(ready)try{localStorage.setItem(draftKey.current,JSON.stringify({answers,step,updatedAt:new Date().toISOString()}));}catch{setError(t.draftError);}},[answers,step,ready]);
 async function deletePlan(planId:string){if(!isFeatureEnabled('planLifecycle'))return false;let success=false;await run(async()=>{if(!data)return;const removed=await workflow.deletePlan(planId,data.metadata.dataRevision);setDeletedNotice({planId,expiresAt:removed.undoUntil});success=true;});return success;}
 async function undoPlan(){if(!deletedNotice||Date.now()>=deletedNotice.expiresAt){setDeletedNotice(undefined);return;}await run(async()=>{if(!data)return;await workflow.restorePlan(deletedNotice.planId,data.metadata.dataRevision,true);setDeletedNotice(undefined);});}
 const slots=getThemeSlots(appearance.theme);
 const name=(id:string)=>exercises.find(e=>e.id===id)?.name[locale]??id;
 const start=(templateId?:string,manualId?:string)=>run(async()=>{const record=await workflow.start(templateId,manualId);setWorkoutValues({});setFocusIndex(0);navigate(`/workout/${record.id}`);});
 const startManual=(ids:string[],selection?:ManualSelection)=>run(async()=>{const record=await workflow.start(undefined,undefined,ids,selection);setWorkoutValues({});setFocusIndex(0);navigate(`/workout/${record.id}`);});
 const restartPlanning=()=>{setStep(0);setCandidate(undefined);setDraftDiscarded(false);navigate('/onboarding');};
 return {refreshCoachContext,restartPlanning,draftDiscarded,setDraftDiscarded,deletedNotice,setDeletedNotice,deletePlan,undoPlan,coachInitialSend,sendHomeCoach,reviewKind,setReviewKind,coachOpen,setCoachOpen,coachRequest,coachRevision,coachTrigger,openCoach,completedWeeks,monthFacts,previousFacts,workoutValues,setWorkoutValues,focusIndex,setFocusIndex,data,facts,answers,setAnswers,step,setStep,candidate,setCandidate,busy,error,locale,t,slots,name,navigate,run,reload,start,startManual,appearance};
}
const Context=createContext<ReturnType<typeof useController>|null>(null);
export const useMainline=()=>{const value=useContext(Context);if(!value)throw new Error('Missing mainline provider');return value;};
export function MainlineProvider({children}:{children:ReactNode}){const value=useController();return <Context.Provider value={value}>{children}</Context.Provider>;}
export function format(text:string,values:Record<string,string|number>){return text.replace(/\{(\w+)\}/g,(_,key)=>String(values[key]??''));}


