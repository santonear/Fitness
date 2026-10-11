import { useRestVibration } from './useRestVibration';
import { useState,useEffect,useRef } from 'react';
import { Button,Chip,MorphPanel } from '../../components/common';
import { useMainline,workflow,format } from '../../mainline/context';
import { exercises } from '../../../catalog/exercises';
import { useTrainingWakeLock } from './useTrainingWakeLock';
import { CoachVisual } from '../../components/CoachVisual';
import { ExerciseGuideImage, ExerciseGuidePanel, ExerciseGuideAttribution } from '../../components/ExerciseGuide';
import { getExerciseGuide } from '../../../catalog/exercise-guide';
import { manualTrainingItems } from '../../../application/rules/manual-items';
import guideZh from '../../../i18n/features/training/guide.zh.json';
import guideEn from '../../../i18n/features/training/guide.en.json';
export function WorkoutPage(){
 const {data,t,locale,name,navigate,run,busy,slots,openCoach,focusIndex:index,setFocusIndex:setIndex,workoutValues:values,setWorkoutValues:setValues}=useMainline();const active=data?.active;
 const [panel,setPanel]=useState<'pause'|'edit'|'swap'>(),[replacement,setReplacement]=useState(''),[reason,setReason]=useState<'other'|'discomfort'>('other');
 const panelTrigger=useRef<HTMLElement|null>(null),guideTrigger=useRef<HTMLElement|null>(null),[guideOpen,setGuideOpen]=useState(false);
 const showPanel=(next:'pause'|'edit'|'swap',trigger?:HTMLElement)=>{if(trigger)panelTrigger.current=trigger;setPanel(next);};
 const copy=locale==='zh'?guideZh:guideEn;
 const [rest,setRest]=useState(0);useTrainingWakeLock(!!active&&!panel);useRestVibration(active?.sets.at(-1)?.completedAt,!!active&&!panel);
 useEffect(()=>{const last=active?.sets.at(-1)?.completedAt;if(!last)return;const update=()=>setRest(Math.max(0,Math.floor((Date.now()-Date.parse(last))/1000)));update();const timer=window.setInterval(update,1000);return()=>clearInterval(timer);},[active?.sets.length]);
 if(!active)return <main><p>{t.noTraining}</p><Button onClick={()=>navigate('/')}>{t.next}</Button></main>;
 const items=active.plannedExercises??[],item=items[index]??items[0];if(!item)return null;
 const effectiveId=active.substitutions?.filter(s=>s.itemIndex===item.itemIndex).at(-1)?.toExerciseId??item.exerciseId;
 const exercise=exercises.find(e=>e.id===effectiveId)!;
 const template=active.templateSnapshot??data?.versions.find(v=>v.id===active.planVersionId)?.templates.find(s=>s.id===active.templateId),planned=template?.items[item.itemIndex];
 const matching=planned?.exerciseId===effectiveId?planned.target:manualTrainingItems([effectiveId])[0]?.target;
 const previous=active.sets.filter(s=>s.itemIndex===item.itemIndex&&s.exerciseId===effectiveId).at(-1);
 const timed=exercise.metricType.startsWith('duration');
 const key=`${active.id}:${index}:${effectiveId}`;
 const value=values[key]??(timed?previous?.durationSeconds??(matching&&'durationSeconds'in matching?matching.durationSeconds:30):previous?.reps??(matching&&'reps'in matching?matching.reps:8));
 const suggestedLoad=previous?.loadGrams??(matching&&'loadGrams'in matching?matching.loadGrams:undefined);
 const load=values[`${key}:kg`]??(typeof suggestedLoad==='number'&&suggestedLoad>0?suggestedLoad/1000:undefined);
 const hasLoad=load!==undefined&&Number.isFinite(load)&&load>0;
 const guide=getExerciseGuide(effectiveId,locale);
 const distance=values[`${key}:meters`]??previous?.distanceMeters??(matching&&'distanceMeters'in matching?matching.distanceMeters:undefined);
 const done=active.sets.filter(s=>s.itemIndex===item.itemIndex).length,allDone=active.sets.length>=active.plannedSetCount,thisDone=done>=item.plannedSetCount;
 const complete=(event:React.MouseEvent<HTMLButtonElement>)=>{panelTrigger.current=event.currentTarget;if(!allDone&&!thisDone&&exercise.metricType==='reps_load'&&!hasLoad){showPanel('edit');return;}void run(async()=>{if(allDone){navigate(`/workout/${active.id}/finish`);return;}if(thisDone){setIndex(items.findIndex(p=>active.sets.filter(s=>s.itemIndex===p.itemIndex).length<p.plannedSetCount));return;}let nextSet=0;while(active.sets.some(s=>s.itemIndex===item.itemIndex&&s.setIndex===nextSet))nextSet++;await workflow.recordSet(active.id,item.itemIndex,nextSet,timed?{durationSeconds:value,...(exercise.metricType==='duration_distance'&&distance!==undefined&&Number.isFinite(distance)?{distanceMeters:distance}:{})}:{reps:value,...(exercise.metricType==='reps_load'?{loadGrams:Math.round(load!*1000)}:{})});});};
 return <main data-training-active="true"><div className="v8-topline"><Button onClick={event=>showPanel('pause',event.currentTarget)}>{t.pause}</Button><span>{template?.name??t.manual}</span><Button aria-label={t.askCoach} onClick={()=>openCoach('ADJUST_TODAY',active.templateId)}><CoachVisual/></Button></div>
 <section className="v8-focus" onClickCapture={event=>{const button=(event.target as HTMLElement).closest('button');if(button)panelTrigger.current=button;}}><p>{format(t.setCount,{current:Math.min(done+1,item.plannedSetCount),total:item.plannedSetCount})}</p><h1>{name(effectiveId)}</h1>
 <button className="exercise-guide-open" aria-label={copy.details} onClick={event=>{guideTrigger.current=event.currentTarget;setGuideOpen(true);}}><ExerciseGuideImage key={effectiveId} id={effectiveId} locale={locale}/></button><ExerciseGuideAttribution id={effectiveId} locale={locale}/>
 <ul className="exercise-guide-points" aria-label={copy.points}>{guide.keyPoints.map((point,i)=><li key={i}>{point}</li>)}</ul>
 <slots.SetValue label={t.edit} loadText={exercise.metricType==='reps_load'?(hasLoad?`${load} ${t.kg}`:copy.chooseLoad):t.bodyweight} targetText={`${value} ${timed?t.seconds:t.reps}${exercise.metricType==='duration_distance'&&distance!==undefined&&Number.isFinite(distance)?` · ${distance} ${t.meters}`:''}`} onEdit={()=>showPanel('edit')} disabled={busy||thisDone}/><p>{t.metricHint}</p>
 <Button onClick={()=>{setReplacement('');setReason('other');showPanel('swap');}} disabled={thisDone}>{t.changeExercise}</Button></section>
 {active.sets.length>0&&<slots.RestClock label={t.rest} elapsedSeconds={rest}/>}
 <Button variant="primary" workout disabled={busy||!!panel} onClick={complete}>{allDone?t.allDone:thisDone?t.exerciseDone:t.completeSet}</Button>
 <div className="v8-capsules" aria-label={t.actions}>{items.map((p,i)=>{const id=active.substitutions?.filter(s=>s.itemIndex===p.itemIndex).at(-1)?.toExerciseId??p.exerciseId;return <Chip key={p.itemIndex} selected={i===index} onClick={()=>{setIndex(i);setPanel(undefined);}}>{active.sets.filter(s=>s.itemIndex===p.itemIndex).length>=p.plannedSetCount?'✓ ':''}{name(id)}</Chip>;})}</div>
 <ExerciseGuidePanel id={effectiveId} locale={locale} open={guideOpen} onClose={()=>setGuideOpen(false)} triggerRef={guideTrigger}/>
 <MorphPanel open={!!panel} placement={panel==='pause'?'bottom':'center'} title={panel==='pause'?t.pauseTitle:panel==='edit'?t.edit:t.changeExercise} closeLabel={t.close} triggerRef={panelTrigger} onClose={()=>setPanel(undefined)}><div className="v8-pause-actions">
 {panel==='pause'?<><p>{t.pauseHint}</p><Button onClick={()=>setPanel(undefined)}>{t.resume}</Button><Button onClick={()=>navigate(`/workout/${active.id}/finish`)}>{t.end}</Button><Button onClick={()=>void run(async()=>{await workflow.finish(active.id,{reasons:[]},true);navigate('/');})}>{t.abandon}</Button></>:panel==='edit'?<><label>{timed?t.seconds:t.reps}<input type="number" min="1" value={value} onChange={e=>setValues({...values,[key]:Number(e.target.value)})}/></label>{exercise.metricType==='duration_distance'&&<label>{t.meters}<input type="number" min="0" step="1" value={distance===undefined||Number.isNaN(distance)?'':distance} onChange={e=>setValues({...values,[`${key}:meters`]:e.target.valueAsNumber})}/></label>}{exercise.metricType==='reps_load'&&<label>{t.kg}<input placeholder={copy.chooseLoad} type="number" min="0" step="0.5" value={load===undefined||Number.isNaN(load)?'':load} onChange={e=>setValues({...values,[`${key}:kg`]:e.target.valueAsNumber})}/></label>}<Button disabled={!(value>0)||!Number.isInteger(value)||(exercise.metricType==='reps_load'&&!hasLoad)||(distance!==undefined&&!Number.isNaN(distance)&&(!Number.isInteger(distance)||distance<0))} onClick={()=>setPanel(undefined)}>{t.confirm}</Button></>:panel==='swap'?<><label>{t.replacement}<select aria-label={t.replacement} value={replacement} onChange={e=>setReplacement(e.target.value)}><option value="">{t.choose}</option>{exercises.filter(e=>e.id!==effectiveId).map(e=><option key={e.id} value={e.id}>{e.name[locale]}</option>)}</select></label><label>{t.reasonLabel}<select aria-label={t.reasonLabel} value={reason} onChange={e=>setReason(e.target.value as typeof reason)}><option value="other">{t.other}</option><option value="discomfort">{t.discomfort}</option></select></label><Button disabled={!replacement||busy} onClick={()=>void run(async()=>{await workflow.substitute(active.id,item.itemIndex,replacement,reason);setPanel(undefined);})}>{t.confirm}</Button></>:null}
 </div></MorphPanel>
 </main>;
}



