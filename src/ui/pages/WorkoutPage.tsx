import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { workoutService } from '../../application/workouts';
import { profileService } from '../../application/profile';
import { exercises } from '../../catalog/exercises';
import { parseMetric } from '../../domain/units';
import type { WorkoutSession, SetRecord, ExerciseSnapshot, Locale, ScheduledWorkout, SetInput } from '../../domain/models';
import { CompletionReview, metricText, WorkoutFacts } from '../components/CompletionReview';

export function WorkoutPage(){
 const {i18n}=useTranslation();const locale:Locale=i18n.resolvedLanguage==='zh'?'zh':'en',zh=locale==='zh';
 const [params]=useSearchParams();const requested=params.get('scheduledWorkoutId');
 const [session,setSession]=useState<WorkoutSession>();const [sets,setSets]=useState<SetRecord[]>([]);const [schedule,setSchedule]=useState<ScheduledWorkout[]>([]);
 const [choose,setChoose]=useState<string>(exercises[0].id);const [review,setReview]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [message,setMessage]=useState('');const locked=useRef(false);
 async function refresh(){const active=await workoutService.getActiveWorkout();setSession(active);setSets(active?await workoutService.getSets(active.id):[]);setSchedule(await workoutService.listAvailableSchedule());}
 useEffect(()=>{void profileService.initialize(locale).then(refresh).catch(e=>setError(e.message));},[]);
 async function run(action:()=>Promise<WorkoutSession>,status=''){
  if(locked.current)return;locked.current=true;setBusy(true);setError('');setMessage('');
  try{const next=await action();setSession(next);setSets(await workoutService.getSets(next.id));setSchedule(await workoutService.listAvailableSchedule());setMessage(status);}catch(e){setError(`${(e as {code?:string}).code??'INVALID'}: ${(e as Error).message}`);}finally{locked.current=false;setBusy(false);}
 }
 function start(scheduledWorkoutId?:string){const timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone;const now=new Date();const localDate=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;void run(()=>workoutService.startWorkout({sessionId:crypto.randomUUID(),localDate,timeZone,...(scheduledWorkoutId?{scheduledWorkoutId}:{exerciseIds:[choose]})}));}
 return <><h1>{zh?'今日训练':'Today'}</h1><p className="muted">{zh?'只有点击记录后，实际值才会保存。':'Actual values save when you select Record set.'}</p>{error&&<p role="alert">{error}</p>}<p role="status">{message}</p>
 {session?session.status==='in_progress'?review?<CompletionReview session={session} sets={sets} locale={locale} busy={busy} onBack={()=>setReview(false)} onConfirm={()=>void run(()=>workoutService.completeWorkout(session.id,session.revision),zh?'训练已完成':'Workout completed')}/>:<>
  <p>{session.localDate} · {session.timeZone} · {session.planVersionId?(zh?'计划训练':'Planned workout'):(zh?'临时训练':'Temporary workout')}</p>
  {session.exerciseSnapshots.map(exercise=><section key={exercise.exerciseInstanceId} className="workout-exercise"><h2>{exercise.name[locale]}</h2>
   {exercise.targetSets.length>0&&<details><summary>{zh?'计划目标（非实际值）':'Planned targets (not actual values)'}</summary><pre>{JSON.stringify(exercise.targetSets,null,2)}</pre></details>}
   {sets.filter(s=>s.exerciseInstanceId===exercise.exerciseInstanceId).map(set=><SetForm key={`${set.id}-${set.revision}`} exercise={exercise} locale={locale} busy={busy} saved={set} onSave={input=>run(()=>workoutService.recordSet(session.id,input,session.revision),zh?'组已保存':'Set saved')}/>)}
   <SetForm key={`${exercise.exerciseInstanceId}-${session.revision}`} exercise={exercise} locale={locale} busy={busy} order={sets.filter(s=>s.exerciseInstanceId===exercise.exerciseInstanceId).reduce((max,s)=>Math.max(max,s.order+1),0)} onSave={input=>run(()=>workoutService.recordSet(session.id,input,session.revision),zh?'组已保存':'Set saved')}/>
   <label>{zh?'替换动作':'Replace exercise'}<select value={exercise.exerciseId} disabled={busy} onChange={event=>{const replacement=exercises.find(e=>e.id===event.target.value)!;const incompatible=replacement.metricType!==exercise.metricType&&sets.some(s=>s.exerciseInstanceId===exercise.exerciseInstanceId);if(incompatible&&!window.confirm(zh?'替换会清除不兼容的已保存组，确认？':'Replace and clear incompatible saved sets?'))return;void run(()=>workoutService.adjustWorkout(session.id,{type:'replace_exercise',exerciseInstanceId:exercise.exerciseInstanceId,exerciseId:replacement.id,confirmClearMetrics:incompatible},session.revision));}}>{exercises.map(e=><option key={e.id} value={e.id}>{e.name[locale]}</option>)}</select></label>
  </section>)}
  <label>{zh?'添加动作':'Choose exercise'}<select value={choose} disabled={busy} onChange={e=>setChoose(e.target.value)}>{exercises.map(e=><option key={e.id} value={e.id}>{e.name[locale]}</option>)}</select></label><button disabled={busy} onClick={()=>void run(()=>workoutService.adjustWorkout(session.id,{type:'add_exercise',exerciseId:choose,exerciseInstanceId:crypto.randomUUID()},session.revision))}>{zh?'添加动作':'Add exercise'}</button>
  <div className="workout-actions"><button disabled={busy} onClick={()=>setReview(true)}>{zh?'完成前核对':'Review completion'}</button><button disabled={busy} onClick={()=>{if(window.confirm(zh?'放弃本次训练？已保存内容将保留并标为已放弃。':'Abandon this workout? Saved facts remain marked abandoned.'))void run(()=>workoutService.abandonWorkout(session.id,session.revision),zh?'训练已放弃':'Workout abandoned');}}>{zh?'放弃训练':'Abandon workout'}</button><button disabled={busy} onClick={()=>void refresh().catch(e=>setError(e.message))}>{zh?'重新载入已保存记录':'Reload saved records'}</button></div>
 </>:<><WorkoutFacts session={session} sets={sets} locale={locale}/><button onClick={()=>{setReview(false);void refresh();}}>{zh?'开始下一次训练':'Start another workout'}</button></>:<>
  <label>{zh?'选择动作':'Choose exercise'}<select value={choose} disabled={busy} onChange={e=>setChoose(e.target.value)}>{exercises.map(e=><option key={e.id} value={e.id}>{e.name[locale]}</option>)}</select></label><button disabled={busy} onClick={()=>start()}>{zh?'开始临时训练':'Start temporary workout'}</button>
  <h2>{zh?'计划日程':'Planned schedule'}</h2>{schedule.filter(row=>!requested||row.id===requested).map(row=><div key={row.id}>{row.originalDate} → {row.scheduledDate}<button disabled={busy} onClick={()=>start(row.id)}>{zh?'开始计划训练':'Start planned workout'}</button></div>)}
 </>}</>;
}
function SetForm({exercise,locale,busy,saved,order=0,onSave}:{exercise:ExerciseSnapshot;locale:Locale;busy:boolean;saved?:SetRecord;order?:number;onSave:(input:SetInput)=>Promise<void>}){
 const zh=locale==='zh';const [reps,setReps]=useState(saved?.reps?.toString()??'');const [load,setLoad]=useState(saved?.loadGrams===undefined?'':String(saved.loadGrams/1000));const [seconds,setSeconds]=useState(saved?.durationSeconds?.toString()??'');const [km,setKm]=useState(saved?.distanceMeters===undefined?'':String(saved.distanceMeters/1000));const [notes,setNotes]=useState(saved?.notes??'');const [error,setError]=useState('');const id=useRef(saved?.id??crypto.randomUUID());
 return <form onSubmit={e=>{e.preventDefault();setError('');try{const metrics=exercise.metricType==='reps_load'?parseMetric({metricType:'reps_load',reps,loadKg:load}):exercise.metricType==='reps'?parseMetric({metricType:'reps',reps}):exercise.metricType==='duration'?parseMetric({metricType:'duration',durationSeconds:seconds}):parseMetric({metricType:'duration_distance',durationSeconds:seconds,...(km?{distanceKm:km}:{})});void onSave({id:id.current,exerciseInstanceId:exercise.exerciseInstanceId,order:saved?.order??order,...metrics,completed:true,notes});}catch(reason){setError((reason as Error).message);}}}><fieldset disabled={busy}><legend>{saved?(zh?'已保存组':'Saved set'):(zh?'下一组':'Next set')}</legend>{saved&&<p>{metricText(saved,locale)} {saved.notes}</p>}
 {['reps','reps_load'].includes(exercise.metricType)&&<label>{zh?'次数':'Reps'}<input inputMode="numeric" value={reps} onChange={e=>setReps(e.target.value)} required/></label>}
 {exercise.metricType==='reps_load'&&<label>{zh?'负重（千克）':'Load (kg)'}<input inputMode="decimal" value={load} onChange={e=>setLoad(e.target.value)} required/></label>}
 {['duration','duration_distance'].includes(exercise.metricType)&&<label>{zh?'时长（秒）':'Duration (seconds)'}<input inputMode="numeric" value={seconds} onChange={e=>setSeconds(e.target.value)} required/></label>}
 {exercise.metricType==='duration_distance'&&<label>{zh?'距离（公里，可选）':'Distance (km, optional)'}<input inputMode="decimal" value={km} onChange={e=>setKm(e.target.value)}/></label>}
 <label>{zh?'组备注':'Set notes'}<input value={notes} onChange={e=>setNotes(e.target.value)}/></label><button type="submit">{saved?(zh?'更新组':'Update set'):(zh?'记录组':'Record set')}</button>{error&&<p role="alert">{error}</p>}</fieldset></form>;
}
