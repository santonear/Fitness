import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PlanPage } from './PlanPage';
import { VersionsPage } from './VersionsPage';
import { useMainline } from '../../mainline/context';
import { Button, MorphPanel } from '../../components/common';
import { ExerciseMedia } from '../../components/ExerciseMedia';
import libraryZh from '../../../i18n/features/plan/library.zh.json';
import libraryEn from '../../../i18n/features/plan/library.en.json';
import { exercises } from '../../../catalog/exercises';
export function PlanRoute({ versions = false }: { versions?: boolean }) {
 const c=useMainline(), [query,setQuery]=useSearchParams(), [exercise,setExercise]=useState<string>();
 const triggerRef=useRef<HTMLElement|null>(null),[open,setOpen]=useState(false);
 const library=c.locale==='zh'?libraryZh:libraryEn;
 const selected=c.data?.versions.find(v=>v.id===query.get('version'))??c.data?.version;
 const detail=exercises.find(e=>e.id===exercise);
 if(versions)return <main><VersionsPage versions={c.data?.versions??[]} currentVersionId={c.data?.version?.id??''} language={c.locale} onBack={()=>c.navigate('/plans')} onView={v=>c.navigate(`/plans?version=${encodeURIComponent(v.id)}`)}/></main>;
 return <main>{selected?<PlanPage version={selected} currentVersionId={c.data?.version?.id??''} language={c.locale} exerciseName={c.name} onVersions={()=>c.navigate('/plans/versions')} onExercises={()=>c.navigate('/exercises')} onExercise={(v,id,index)=>{triggerRef.current=document.activeElement as HTMLElement;setExercise(v.templates.find(t=>t.id===id)?.items[index]?.exerciseId);setOpen(true);}}/>:<><h1>{c.t.plan}</h1><Button onClick={()=>c.navigate('/onboarding')}>{c.t.create}</Button></>}
 <MorphPanel open={open&&!!detail} onClose={()=>setOpen(false)} triggerRef={triggerRef} title={detail?c.name(detail.id):''} closeLabel={c.t.close}>{detail&&<><ol>{detail.steps[c.locale].map((step,i)=><li key={i}>{step}</li>)}</ol>{detail.cautions[c.locale].length>0&&<><h3>{library.cautions}</h3><ul>{detail.cautions[c.locale].map((text,i)=><li key={i}>{text}</li>)}</ul></>}{open&&<ExerciseMedia key={detail.id} exerciseId={detail.id} exerciseName={c.name(detail.id)} locale={c.locale}/>}</>}</MorphPanel>
 {query.has('version')&&<Button onClick={()=>setQuery({})}>{c.t.next}</Button>}</main>;
}
