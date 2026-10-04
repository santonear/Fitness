import { useEffect, useRef, useState } from 'react';
import { exercises } from '../../catalog/exercises';
import { database } from '../../persistence/db';
import { repository } from '../../persistence/repository';
import { dayPlanService } from '../../application/day-plans';
import type { Plan, ScheduledWorkout, PlannedExercise, SetMetrics } from '../../domain/models';
import { TargetFields } from './PlanEditor';
import { dayPlanFeedback } from '../day-plan-feedback';
export function defaultTarget(id:string):SetMetrics{const type=exercises.find(exercise=>exercise.id===id)!.metricType;return type==='reps_load'?{metricType:type,reps:10,loadGrams:0}:type==='reps'?{metricType:type,reps:10}:type==='duration'?{metricType:type,durationSeconds:30}:{metricType:type,durationSeconds:600};}
export function DayPlanEditor({date,locale,zone,onSaved}:{date:string;locale:'en'|'zh';zone:string;onSaved:()=>Promise<void>}){
  const zh=locale==='zh';const [name,setName]=useState('');const [items,setItems]=useState<PlannedExercise[]>([{exerciseId:exercises[2].id as PlannedExercise['exerciseId'],order:0,targetSets:[{metricType:'reps',reps:10}]}]);
  const [plan,setPlan]=useState<Plan>();const [task,setTask]=useState<ScheduledWorkout>();const [loaded,setLoaded]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [status,setStatus]=useState('');const generation=useRef(0);const lock=useRef(false);
  useEffect(()=>{let live=true;void database.transaction('r',database.tables,async()=>{const metadata=await repository.readMetadata();const plans=await database.plans.filter(plan=>plan.model==='date-day').toArray();const rows=await database.scheduledWorkouts.filter(row=>row.scheduledDate===date).toArray();
    const row=rows.find(row=>plans.some(plan=>plan.currentVersionId===row.planVersionId&&(row.completedSessionId||(!plan.deletedAt&&plan.status==='active'&&!row.hiddenAt&&row.status==='pending'))));const found=plans.find(plan=>plan.currentVersionId===row?.planVersionId);const version=found&&await database.planVersions.get(found.currentVersionId);
    if(!live)return;generation.current=metadata.restoreGeneration??0;setPlan(found);setTask(row);if(found&&version){setName(found.name);setItems(structuredClone(version.days[0].exercises));}setLoaded(true);
  }).catch(reason=>{if(live)setError(String(reason));});return()=>{live=false;};},[date]);
  function changed(){setStatus('');setError('');}
  function update(index:number,next:PlannedExercise){changed();setItems(values=>values.map((value,i)=>i===index?next:value));}
  return <form className="day-plan-editor" aria-label={`${zh?'编辑日期':'Edit date'} ${date}`} onInput={changed} onInvalid={changed} onSubmit={event=>{event.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);changed();
    void dayPlanService.saveDayPlan({id:plan?.id,name,date,timeZone:zone,exercises:items.map((item,order)=>({...item,order})),expectedRevision:plan?.revision,expectedGeneration:generation.current}).then(async saved=>{setPlan(saved.plan);setTask(saved.task);await onSaved();setStatus(zh?'此日已保存；其他日期未自动保存。':'This date is saved; other dates were not saved automatically.');}).catch(reason=>setError(dayPlanFeedback(reason,zh))).finally(()=>{lock.current=false;setBusy(false);});}}>
    <fieldset disabled={!loaded||busy||Boolean(task?.completedSessionId)}><legend>{date}</legend><p>{zh?'日历时区':'Calendar time zone'}: {zone}</p>
      <label>{zh?'日计划名称':'Day plan name'}<input required value={name} onChange={event=>{changed();setName(event.target.value);}} /></label>
      {items.map((item,index)=><fieldset key={index}><legend>{zh?'动作':'Exercise'} {index+1}</legend>
        <label>{zh?'日计划动作':'Day plan exercise'}<select value={item.exerciseId} onChange={event=>update(index,{...item,exerciseId:event.target.value as PlannedExercise['exerciseId'],targetSets:[defaultTarget(event.target.value)]})}>{exercises.map(exercise=><option key={exercise.id} value={exercise.id}>{exercise.name[locale]}</option>)}</select></label>
        {item.targetSets.map((target,i)=><fieldset key={`${i}-${target.metricType}`}><legend>{zh?'目标组':'Target set'} {i+1}</legend><TargetFields target={target} zh={zh} onChange={next=>update(index,{...item,targetSets:item.targetSets.map((old,j)=>j===i?next:old)})} />
          <button type="button" disabled={item.targetSets.length===1} onClick={()=>update(index,{...item,targetSets:item.targetSets.filter((_,j)=>j!==i)})}>{zh?'删除目标组':'Remove target set'}</button></fieldset>)}
        <button type="button" onClick={()=>update(index,{...item,targetSets:[...item.targetSets,defaultTarget(item.exerciseId)]})}>{zh?'添加目标组':'Add target set'}</button>
        <label>{zh?'计划备注':'Plan notes'}<textarea value={item.notes??''} onChange={event=>update(index,{...item,notes:event.target.value})} /></label>
        <button type="button" disabled={index===0} onClick={()=>{changed();setItems(values=>{const next=[...values];[next[index-1],next[index]]=[next[index],next[index-1]];return next;});}}>{zh?'上移动作':'Move exercise up'}</button>
        <button type="button" disabled={items.length===1} onClick={()=>{changed();setItems(values=>values.filter((_,i)=>i!==index));}}>{zh?'移除动作':'Remove day exercise'}</button>
      </fieldset>)}
      <button type="button" onClick={()=>{changed();setItems(values=>[...values,{exerciseId:exercises[2].id as PlannedExercise['exerciseId'],order:values.length,targetSets:[{metricType:'reps',reps:10}]}]);}}>{zh?'增加动作':'Add day exercise'}</button>
      <button type="submit">{zh?'保存此日':'Save this date'}</button>
    </fieldset>
    {task?.completedSessionId&&<p>{zh?'此日已有完成训练，课表只读；隐藏后仍占日期槽。':'This day has completed training; its contents are read only and hiding retains its slot.'}</p>}
    {error&&<p role="alert">{error}</p>}{status&&<p role="status">{status}</p>}
  </form>;
}
