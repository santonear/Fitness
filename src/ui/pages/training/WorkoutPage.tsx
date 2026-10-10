import { useState,useEffect } from 'react';
import { Button,Chip } from '../../components/common';
import { useMainline,workflow,format } from '../../mainline/context';
import { exercises } from '../../../catalog/exercises';
import { useTrainingWakeLock } from './useTrainingWakeLock';
import { CoachVisual } from '../../components/CoachVisual';
export function WorkoutPage(){
 const {data,t,locale,name,navigate,run,busy,slots,openCoach,focusIndex:index,setFocusIndex:setIndex,workoutValues:values,setWorkoutValues:setValues}=useMainline();const active=data?.active;
 const [panel,setPanel]=useState<'pause'|'edit'|'swap'>(),[replacement,setReplacement]=useState(''),[reason,setReason]=useState<'other'|'discomfort'>('other');
 const [rest,setRest]=useState(0);useTrainingWakeLock(!!active&&!panel);
 useEffect(()=>{const last=active?.sets.at(-1)?.completedAt;if(!last)return;const update=()=>setRest(Math.max(0,Math.floor((Date.now()-Date.parse(last))/1000)));update();const timer=window.setInterval(update,1000);return()=>clearInterval(timer);},[active?.sets.length]);
 if(!active)return <main><p>{t.noTraining}</p><Button onClick={()=>navigate('/')}>{t.next}</Button></main>;
 const items=active.plannedExercises??[],item=items[index]??items[0];if(!item)return null;
 const effectiveId=active.substitutions?.filter(s=>s.itemIndex===item.itemIndex).at(-1)?.toExerciseId??item.exerciseId;
 const exercise=exercises.find(e=>e.id===effectiveId)!;
 const template=active.templateSnapshot??data?.versions.find(v=>v.id===active.planVersionId)?.templates.find(s=>s.id===active.templateId),planned=template?.items[item.itemIndex];
 const matching=planned?.exerciseId===effectiveId?planned.target:undefined;
 const previous=active.sets.filter(s=>s.itemIndex===item.itemIndex&&s.exerciseId===effectiveId).at(-1);
 const timed=exercise.metricType.startsWith('duration');
 const key=`${active.id}:${index}:${effectiveId}`;
 const value=values[key]??(timed?previous?.durationSeconds??(matching&&'durationSeconds'in matching?matching.durationSeconds:30):previous?.reps??(matching&&'reps'in matching?matching.reps:8));
 const load=values[`${key}:kg`]??(previous?.loadGrams!==undefined?Number(previous.loadGrams)/1000:matching&&'loadGrams'in matching?matching.loadGrams/1000:0);
 const done=active.sets.filter(s=>s.itemIndex===item.itemIndex).length,allDone=active.sets.length>=active.plannedSetCount,thisDone=done>=item.plannedSetCount;
 const complete=()=>void run(async()=>{if(allDone){navigate(`/workout/${active.id}/finish`);return;}if(thisDone){setIndex(items.findIndex(p=>active.sets.filter(s=>s.itemIndex===p.itemIndex).length<p.plannedSetCount));return;}let nextSet=0;while(active.sets.some(s=>s.itemIndex===item.itemIndex&&s.setIndex===nextSet))nextSet++;await workflow.recordSet(active.id,item.itemIndex,nextSet,timed?{durationSeconds:value}:{reps:value,...(exercise.metricType==='reps_load'?{loadGrams:Math.round(load*1000)}:{})});});
 return <main data-training-active="true"><div className="v8-topline"><Button onClick={()=>setPanel('pause')}>{t.pause}</Button><span>{template?.name??t.manual}</span><Button aria-label={t.askCoach} onClick={()=>openCoach('ADJUST_TODAY',active.templateId)}><CoachVisual/></Button></div>
 <section className="v8-focus"><p>{format(t.setCount,{current:Math.min(done+1,item.plannedSetCount),total:item.plannedSetCount})}</p><h1>{name(effectiveId)}</h1>
 <slots.SetValue label={t.edit} loadText={exercise.metricType==='reps_load'?`${load} ${t.kg}`:t.bodyweight} targetText={`${value} ${timed?t.seconds:t.reps}`} onEdit={()=>setPanel('edit')} disabled={busy||thisDone}/><p>{t.metricHint}</p>
 <p>{exercise.steps[locale].join(' ')}</p><Button onClick={()=>{setReplacement('');setReason('other');setPanel('swap');}} disabled={thisDone}>{t.changeExercise}</Button></section>
 {active.sets.length>0&&<slots.RestClock label={t.rest} elapsedSeconds={rest}/>}
 <Button variant="primary" workout disabled={busy||!!panel} onClick={complete}>{allDone?t.allDone:thisDone?t.exerciseDone:t.completeSet}</Button>
 <div className="v8-capsules" aria-label={t.actions}>{items.map((p,i)=>{const id=active.substitutions?.filter(s=>s.itemIndex===p.itemIndex).at(-1)?.toExerciseId??p.exerciseId;return <Chip key={p.itemIndex} selected={i===index} onClick={()=>{setIndex(i);setPanel(undefined);}}>{active.sets.filter(s=>s.itemIndex===p.itemIndex).length>=p.plannedSetCount?'✓ ':''}{name(id)}</Chip>;})}</div>
 {panel&&<section className="v8-inline-panel" aria-label={panel==='pause'?t.pauseTitle:panel==='edit'?t.edit:t.changeExercise}>
 {panel==='pause'?<><h2>{t.pauseTitle}</h2><p>{t.pauseHint}</p><Button onClick={()=>setPanel(undefined)}>{t.resume}</Button><Button onClick={()=>navigate(`/workout/${active.id}/finish`)}>{t.end}</Button><Button onClick={()=>void run(async()=>{await workflow.finish(active.id,{reasons:[]},true);navigate('/');})}>{t.abandon}</Button></>:panel==='edit'?<><label>{timed?t.seconds:t.reps}<input type="number" min="1" value={value} onChange={e=>setValues({...values,[key]:Number(e.target.value)})}/></label>{exercise.metricType==='reps_load'&&<label>{t.kg}<input type="number" min="0" step="0.5" value={load} onChange={e=>setValues({...values,[`${key}:kg`]:Number(e.target.value)})}/></label>}<Button disabled={!(value>0)||!Number.isInteger(value)||load<0} onClick={()=>setPanel(undefined)}>{t.confirm}</Button></>:<><label>{t.replacement}<select aria-label={t.replacement} value={replacement} onChange={e=>setReplacement(e.target.value)}><option value="">{t.choose}</option>{exercises.filter(e=>e.id!==effectiveId).map(e=><option key={e.id} value={e.id}>{e.name[locale]}</option>)}</select></label><label>{t.reasonLabel}<select aria-label={t.reasonLabel} value={reason} onChange={e=>setReason(e.target.value as typeof reason)}><option value="other">{t.other}</option><option value="discomfort">{t.discomfort}</option></select></label><Button disabled={!replacement||busy} onClick={()=>void run(async()=>{await workflow.substitute(active.id,item.itemIndex,replacement,reason);setPanel(undefined);})}>{t.confirm}</Button></>}
 <Button onClick={()=>setPanel(undefined)}>{t.close}</Button></section>}
 </main>;
}



