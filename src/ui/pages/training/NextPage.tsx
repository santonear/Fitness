import { useState } from 'react';
import { Button } from '../../components/common';
import { useMainline, format } from '../../mainline/context';
import { exercises } from '../../../catalog/exercises';
export function NextPage(){
 const {data,facts,t,slots,name,start,navigate,busy}=useMainline(); const [choice,setChoice]=useState<string>();
 const version=data?.version, templates=version?.templates??[];
 const last=data?.workouts.filter(w=>w.planVersionId===version?.id&&w.status!=='in_progress'&&w.status!=='abandoned').sort((a,b)=>b.startedAt.localeCompare(a.startedAt))[0];
 const suggested=templates[(templates.findIndex(s=>s.id===last?.templateId)+1)%Math.max(1,templates.length)];
 const selected=templates.find(s=>s.id===choice)??suggested;
 const lastSelected=data?.workouts.filter(w=>w.templateId===selected?.id&&w.planVersionId===version?.id&&w.status!=='abandoned').sort((a,b)=>b.startedAt.localeCompare(a.startedAt))[0];
 return <main><div className="v8-topline"><h1>{t.next}</h1><Button onClick={()=>navigate('/settings')}>{t.settings}</Button></div>
 {facts&&version&&<slots.WeekProgress complete={facts.complete} partial={facts.partial} target={version.weeklyTarget} label={format(t.week,{complete:facts.complete,partial:facts.partial})}/>}
 {data?.active&&<Button onClick={()=>navigate(`/workout/${data.active!.id}`)}>{t.ongoing}</Button>}
 {selected?<><slots.FeatureCard context="next" motionReduced={false} trainingActive={false}><slots.StartHero {...selected} templateId={selected.id} startLabel={t.start} disabled={busy||!!data?.active} onStart={()=>void start(selected.id)}/><p className="v8-center">{lastSelected?.status==='partial'?t.partialReason:format(t.reason,{minutes:selected.estimatedMinutes})}</p></slots.FeatureCard>
 <p>{t.details}</p><div className="v8-capsules">{selected.items.map((item,index)=><details key={index}><summary>{name(item.exerciseId)} · {item.sets} {t.sets}</summary><p>{exercises.find(e=>e.id===item.exerciseId)?.steps[data?.profile?.locale??'zh'].join(' ')}</p></details>)}</div>
 <div className="v8-row"><Button disabled={templates.length<2} onClick={()=>setChoice(templates[(templates.indexOf(selected)+1)%templates.length].id)}>{t.switch}</Button><Button onClick={()=>navigate('/manual')}>{t.manual}</Button></div></>:<Button variant="primary" onClick={()=>navigate('/onboarding')}>{t.create}</Button>}
 <Button onClick={()=>navigate('/activity')}>{t.recordActivity}</Button>
 </main>;
}
