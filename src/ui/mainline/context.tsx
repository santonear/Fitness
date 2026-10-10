import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../../themes/ThemeProvider';
import { getThemeSlots } from '../../themes/registry';
import { createV8Workflow, type LocalCandidate } from '../../application/v8-workflow';
import { backfillOnboarding } from '../../application/v8-onboarding-backfill';
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
 const navigate = useNavigate(), location = useLocation(), appearance = useTheme();
 const [data,setData] = useState<Awaited<ReturnType<typeof workflow.snapshot>>>();
 const [monthFacts,setMonthFacts] = useState<MonthFacts>(), [previousFacts,setPreviousFacts]=useState<WeekFacts>(), [facts,setFacts] = useState<WeekFacts>(), [answers,setAnswers] = useState(blank), [step,setStep] = useState<0|1|2|3>(0);
 const [completedWeeks,setCompletedWeeks] = useState<[WeekFacts,WeekFacts]>();
 const [candidate,setCandidate] = useState<LocalCandidate>(), [busy,setBusy] = useState(false), [error,setError] = useState('');
 const [workoutValues,setWorkoutValues]=useState<Record<string,number>>({}),[focusIndex,setFocusIndex]=useState(0);
 const [ready,setReady] = useState(false); const draftKey = useRef(''), lock = useRef(false);
 const locale: 'zh'|'en' = data?.profile?.locale === 'en' ? 'en' : 'zh', t = locale === 'zh' ? zh : en;
 async function reload() {
  const next = await workflow.snapshot(); setData(next);
  const review = await createV8DataService(repository).getReviewWorkouts();
  const input={ ...week(next.profile?.timeZone ?? 'Asia/Shanghai'), timeZone: next.profile?.timeZone ?? 'Asia/Shanghai', weeklyTarget: next.version?.weeklyTarget ?? 2, ...review, activities: next.activities, bodyWeights: await repository.db.bodyWeights.toArray() };
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
 async function run(action: () => Promise<void>) { if(lock.current)return; lock.current=true;setBusy(true);setError('');try{await action();await reload();}catch{setError(t.saveError);}finally{lock.current=false;setBusy(false);} }
 useEffect(()=>{let alive=true;void(async()=>{
  await profileService.initialize('zh');const next=await reload();if(!alive)return;
  draftKey.current=`fitness-v8-draft:${next.metadata.localProfileId}:${next.metadata.restoreGeneration??0}`;
  const legacy=await repository.db.guidedStates.get('guided');
  if(legacy?.onboarding?.answers)setAnswers(backfillOnboarding(legacy.onboarding.answers,next.profile?.locale==='en'?'en':'zh'));
  try{const saved=JSON.parse(localStorage.getItem(draftKey.current)??'null');if(saved?.answers && ['goalText','scheduleOriginalText','placeEquipmentText'].every(k=>typeof saved.answers[k]==='string') && typeof saved.answers.adultConfirmed==='boolean' && Array.isArray(saved.answers.cautions)){setAnswers(saved.answers);if([0,1,2,3].includes(saved.step))setStep(saved.step);}}catch{/* Preserve unknown raw draft. */}
  setReady(true);
  if(location.pathname==='/'&&!next.version&&!next.active&&!legacy?.onboarding?.completed&&await repository.db.sessions.count()===0)navigate('/onboarding',{replace:true});
 })().catch(()=>{if(alive)setError(t.loadError);});return()=>{alive=false;};},[]);
 useEffect(()=>{if(ready)try{localStorage.setItem(draftKey.current,JSON.stringify({answers,step}));}catch{setError(t.draftError);}},[answers,step,ready]);
 const slots=getThemeSlots(appearance.theme);
 const name=(id:string)=>exercises.find(e=>e.id===id)?.name[locale]??id;
 const start=(templateId?:string,manualId?:string)=>run(async()=>{const record=await workflow.start(templateId,manualId);setWorkoutValues({});setFocusIndex(0);navigate(`/workout/${record.id}`);});
 return {completedWeeks,monthFacts,previousFacts,workoutValues,setWorkoutValues,focusIndex,setFocusIndex,data,facts,answers,setAnswers,step,setStep,candidate,setCandidate,busy,error,locale,t,slots,name,navigate,run,reload,start,appearance};
}
const Context=createContext<ReturnType<typeof useController>|null>(null);
export const useMainline=()=>{const value=useContext(Context);if(!value)throw new Error('Missing mainline provider');return value;};
export function MainlineProvider({children}:{children:ReactNode}){const value=useController();return <Context.Provider value={value}>{children}</Context.Provider>;}
export function format(text:string,values:Record<string,string|number>){return text.replace(/\{(\w+)\}/g,(_,key)=>String(values[key]??''));}


