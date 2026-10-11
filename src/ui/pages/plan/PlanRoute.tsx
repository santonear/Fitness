import { useFeature } from '../../useFeature';
import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PlanPage } from './PlanPage';
import { VersionsPage } from './VersionsPage';
import { useMainline, workflow } from '../../mainline/context';
import { Button, MorphPanel, Sheet } from '../../components/common';
import { ExerciseGuidePanel } from '../../components/ExerciseGuide';
import { planLifecycleCopy } from '../../../i18n/features/plan/lifecycle';
import guideZh from '../../../i18n/features/training/guide.zh.json';
import guideEn from '../../../i18n/features/training/guide.en.json';
export function PlanRoute({ versions = false }: { versions?: boolean }) {
 const enabled=useFeature('planLifecycle');
 const c=useMainline(), [query,setQuery]=useSearchParams(), [exercise,setExercise]=useState<string>();
 const triggerRef=useRef<HTMLElement|null>(null),[open,setOpen]=useState(false);
 const deleteTrigger=useRef<HTMLElement|null>(null),[deleting,setDeleting]=useState<string>();
 const activateTrigger=useRef<HTMLElement|null>(null),[activating,setActivating]=useState<{id:string;revision:number}>();
 const activate=async(id:string,revision:number)=>{await c.run(async()=>{await workflow.activatePlan(id,revision);setActivating(undefined);setQuery({});});};
 const askActivate=(id:string,trigger:HTMLElement)=>{if(!enabled||!c.data)return;activateTrigger.current=trigger;if(c.data.plan)setActivating({id,revision:c.data.metadata.dataRevision});else void activate(id,c.data.metadata.dataRevision);};
 const copy=c.locale==='zh'?guideZh:guideEn, life=planLifecycleCopy[c.locale];
 const plans=c.data?.plans??[], previous=plans.filter(p=>p.id!==c.data?.plan?.id);
 const selectedVersion=query.has('version')?c.data?.versions.find(v=>v.id===query.get('version')):undefined;
 const selectedPlan=query.has('version')?plans.find(p=>p.id===selectedVersion?.planId):query.has('plan')?plans.find(p=>p.id===query.get('plan')):c.data?.plan;
 const selected=selectedVersion??c.data?.versions.find(v=>v.id===selectedPlan?.currentVersionId);
 const selectedQuery=selectedPlan?`?plan=${encodeURIComponent(selectedPlan.id)}`:'';
 const target=plans.find(p=>p.id===deleting);
 const activePlanId=c.data?.versions.find(v=>v.id===c.data?.active?.planVersionId)?.planId;
 const askDelete=(id:string)=>{deleteTrigger.current=document.activeElement as HTMLElement;setDeleting(id);};
 if(versions)return <main><VersionsPage versions={(c.data?.versions??[]).filter(v=>v.planId===selectedPlan?.id)} currentVersionId={c.data?.version?.id??''} language={c.locale} onBack={()=>c.navigate(`/plans${selectedQuery}`)} onView={v=>c.navigate(`/plans?version=${encodeURIComponent(v.id)}`)}/></main>;
 return <main>{selected?<PlanPage version={selected} currentVersionId={c.data?.version?.id??''} language={c.locale} exerciseName={c.name} onVersions={()=>c.navigate(`/plans/versions${selectedQuery}`)} onExercises={()=>c.navigate('/exercises')} onExercise={(v,id,index,trigger)=>{triggerRef.current=trigger??null;setExercise(v.templates.find(t=>t.id===id)?.items[index]?.exerciseId);setOpen(true);}}/>:<><h1>{c.t.plan}</h1><p>{life.empty}</p><Button onClick={()=>c.navigate('/onboarding')}>{life.create}</Button></>}
 <ExerciseGuidePanel id={exercise} locale={c.locale} open={open} onClose={()=>setOpen(false)} triggerRef={triggerRef}/>
 <section><Button onClick={()=>c.navigate('/settings#reminders')}>{copy.reminder}</Button><p>{copy.reminderHint}</p></section>
 {query.has('version')||query.has('plan')?<Button onClick={()=>setQuery({})}>{life.back}</Button>:<section aria-labelledby="previous-plans-title"><h2 id="previous-plans-title">{life.previous}</h2>{!previous.length&&<p>{life.noPrevious}</p>}{previous.map(plan=><Sheet key={plan.id}><h3>{plan.name}</h3><Button onClick={()=>setQuery({plan:plan.id})}>{life.view}</Button><Button hidden={!enabled} disabled={c.busy||!!c.data?.active} onClick={event=>askActivate(plan.id,event.currentTarget)}>{life.activate}</Button><Button hidden={!enabled} disabled={c.busy||activePlanId===plan.id} onClick={()=>askDelete(plan.id)}>{life.delete}</Button>{activePlanId===plan.id&&<p>{life.active}</p>}</Sheet>)}</section>}
 {enabled&&previous.length>0&&c.data?.active&&<p>{life.activateActive}</p>}
 {enabled&&selectedPlan&&selectedPlan.id!==c.data?.plan?.id&&!query.has('version')&&<Button disabled={c.busy||!!c.data?.active} onClick={event=>askActivate(selectedPlan.id,event.currentTarget)}>{life.activate}</Button>}
 {enabled&&selectedPlan&&!query.has('version')&&<><Button disabled={c.busy||activePlanId===selectedPlan.id} onClick={()=>askDelete(selectedPlan.id)}>{selectedPlan.id===c.data?.plan?.id?life.stop:life.delete}</Button>{activePlanId===selectedPlan.id&&<p>{life.active}</p>}</>}
 <MorphPanel open={enabled&&!!target} title={life.confirmTitle} closeLabel={life.cancel} onClose={()=>{if(!c.busy)setDeleting(undefined);}} triggerRef={deleteTrigger}>
 <p>{target?.name}</p><p>{life.confirmHint}</p><Button disabled={c.busy} onClick={()=>{if(target)void c.deletePlan(target.id).then(success=>{if(success){setDeleting(undefined);setQuery({});}});}}>{life.confirm}</Button>
 </MorphPanel>
 <MorphPanel open={enabled&&!!activating} title={life.activateTitle} closeLabel={life.cancel} onClose={()=>{if(!c.busy)setActivating(undefined);}} triggerRef={activateTrigger}><p>{plans.find(p=>p.id===activating?.id)?.name}</p><p>{life.activateHint}</p><Button disabled={c.busy||!!c.data?.active} onClick={()=>{if(enabled&&activating)void activate(activating.id,activating.revision);}}>{life.activateConfirm}</Button></MorphPanel></main>;
}
