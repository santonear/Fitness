import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PlanPage } from './PlanPage';
import { VersionsPage } from './VersionsPage';
import { useMainline } from '../../mainline/context';
import { Button } from '../../components/common';
import { ExerciseGuidePanel } from '../../components/ExerciseGuide';
import guideZh from '../../../i18n/features/training/guide.zh.json';
import guideEn from '../../../i18n/features/training/guide.en.json';
export function PlanRoute({ versions = false }: { versions?: boolean }) {
 const c=useMainline(), [query,setQuery]=useSearchParams(), [exercise,setExercise]=useState<string>();
 const triggerRef=useRef<HTMLElement|null>(null),[open,setOpen]=useState(false);
 const copy=c.locale==='zh'?guideZh:guideEn;
 const selected=c.data?.versions.find(v=>v.id===query.get('version'))??c.data?.version;
 if(versions)return <main><VersionsPage versions={c.data?.versions??[]} currentVersionId={c.data?.version?.id??''} language={c.locale} onBack={()=>c.navigate('/plans')} onView={v=>c.navigate(`/plans?version=${encodeURIComponent(v.id)}`)}/></main>;
 return <main>{selected?<PlanPage version={selected} currentVersionId={c.data?.version?.id??''} language={c.locale} exerciseName={c.name} onVersions={()=>c.navigate('/plans/versions')} onExercises={()=>c.navigate('/exercises')} onExercise={(v,id,index)=>{triggerRef.current=document.activeElement as HTMLElement;setExercise(v.templates.find(t=>t.id===id)?.items[index]?.exerciseId);setOpen(true);}}/>:<><h1>{c.t.plan}</h1><Button onClick={()=>c.navigate('/onboarding')}>{c.t.create}</Button></>}
 <ExerciseGuidePanel id={exercise} locale={c.locale} open={open} onClose={()=>setOpen(false)} triggerRef={triggerRef}/>
 <section><Button onClick={()=>c.navigate('/settings#reminders')}>{copy.reminder}</Button><p>{copy.reminderHint}</p></section>
 {query.has('version')&&<Button onClick={()=>setQuery({})}>{c.t.next}</Button>}</main>;
}
