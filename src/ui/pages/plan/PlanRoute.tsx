import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PlanPage } from './PlanPage';
import { VersionsPage } from './VersionsPage';
import { useMainline } from '../../mainline/context';
import { Button } from '../../components/common';
import { exercises } from '../../../catalog/exercises';
export function PlanRoute({ versions = false }: { versions?: boolean }) {
 const c=useMainline(), [query,setQuery]=useSearchParams(), [exercise,setExercise]=useState<string>();
 const selected=c.data?.versions.find(v=>v.id===query.get('version'))??c.data?.version;
 const detail=exercises.find(e=>e.id===exercise);
 if(versions)return <main><VersionsPage versions={c.data?.versions??[]} currentVersionId={c.data?.version?.id??''} language={c.locale} onBack={()=>c.navigate('/plans')} onView={v=>c.navigate(`/plans?version=${encodeURIComponent(v.id)}`)}/></main>;
 return <main>{selected?<PlanPage version={selected} currentVersionId={c.data?.version?.id??''} language={c.locale} exerciseName={c.name} onVersions={()=>c.navigate('/plans/versions')} onExercises={()=>c.navigate('/exercises')} onExercise={(v,id,index)=>setExercise(v.templates.find(t=>t.id===id)?.items[index]?.exerciseId)}/>:<><h1>{c.t.plan}</h1><Button onClick={()=>c.navigate('/onboarding')}>{c.t.create}</Button></>}
 {detail&&<section className="v8-inline-panel" aria-label={c.name(detail.id)}><h2>{c.name(detail.id)}</h2><ol>{detail.steps[c.locale].map((step,i)=><li key={i}>{step}</li>)}</ol><Button onClick={()=>setExercise(undefined)}>{c.t.close}</Button></section>}
 {query.has('version')&&<Button onClick={()=>setQuery({})}>{c.t.next}</Button>}</main>;
}
