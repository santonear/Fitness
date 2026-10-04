import {exercises} from '../../catalog/exercises';
import type {PlannedExercise} from '../../domain/models';
import {TargetFields} from './PlanEditor';
import {defaultTarget} from './DayPlanEditor';
export function AiCandidateEditor({name,items,locale,disabled,canSave,onName,onItems,onSave}:{name:string;items:PlannedExercise[];locale:'en'|'zh';disabled:boolean;canSave:boolean;onName:(value:string)=>void;onItems:(value:PlannedExercise[])=>void;onSave:()=>void}){
 const zh=locale==='zh';const t=(en:string,cn:string)=>zh?cn:en;
 function update(index:number,next:PlannedExercise){onItems(items.map((value,i)=>i===index?next:value));}
 return <form aria-label={t('Edit unsaved AI candidate','编辑未保存 AI 候选')} onSubmit={event=>{event.preventDefault();onSave();}}><fieldset disabled={disabled}><legend>{t('Candidate: no plan or training fact saved yet','候选：尚未保存计划或训练事实')}</legend>
 <label>{t('Candidate name','候选名称')}<input required value={name} onChange={e=>onName(e.target.value)}/></label>
 {items.map((item,index)=><fieldset key={index}><legend>{t('Exercise','动作')} {index+1}</legend><label>{t('Candidate exercise','候选动作')}<select value={item.exerciseId} onChange={e=>update(index,{...item,exerciseId:e.target.value as PlannedExercise['exerciseId'],targetSets:[defaultTarget(e.target.value)]})}>{exercises.map(exercise=><option key={exercise.id} value={exercise.id}>{exercise.name[locale]}</option>)}</select></label>
 {item.targetSets.map((target,i)=><fieldset key={`${i}-${target.metricType}`}><legend>{t('Target set','目标组')} {i+1}</legend><TargetFields target={target} zh={zh} onChange={next=>update(index,{...item,targetSets:item.targetSets.map((old,j)=>j===i?next:old)})}/><button type="button" disabled={item.targetSets.length===1} onClick={()=>update(index,{...item,targetSets:item.targetSets.filter((_,j)=>j!==i)})}>{t('Remove candidate set','移除候选组')}</button></fieldset>)}
 <button type="button" onClick={()=>update(index,{...item,targetSets:[...item.targetSets,defaultTarget(item.exerciseId)]})}>{t('Add candidate set','添加候选组')}</button><label>{t('Candidate notes','候选备注')}<textarea aria-label={t('Candidate notes','候选备注')} value={item.notes??''} onChange={e=>update(index,{...item,notes:e.target.value})}/></label><button type="button" disabled={items.length===1} onClick={()=>onItems(items.filter((_,i)=>i!==index))}>{t('Remove candidate exercise','移除候选动作')}</button>
 </fieldset>)}<button type="button" onClick={()=>onItems([...items,{exerciseId:exercises[2].id as PlannedExercise['exerciseId'],order:items.length,targetSets:[defaultTarget(exercises[2].id)]}])}>{t('Add candidate exercise','添加候选动作')}</button><button type="submit" disabled={!canSave}>{t('Confirm and save this candidate','确认并保存此候选')}</button></fieldset></form>;
}
