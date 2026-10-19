import {answerText} from '../../application/preset-text';
import {EnginePlanNotices} from './EnginePlanNotices';
import {estimatedDurationLabel} from '../../i18n/features/plan/labels';
import {diffTemplates,unchangedTemplates} from '../../assistant/template-diff';
import type {CoachApplication,CoachPanelProps} from './CoachPanel';
import type {SessionTemplate} from '../../domain/v8/contracts';
import {exercises} from '../../catalog/exercises';
import {targetText} from './ExerciseTargets';
import {EXERCISE_IDS} from '../../catalog/exercise-ids';
import {ExerciseGuideContent} from './ExerciseGuide';
import {pickedDaysReplaced} from '../../application/picked-schedule';
const indoorWalk=(id:string,name:string)=>id===EXERCISE_IDS.walking&&/室内|indoor/i.test(name);
export function AssistantTemplate({template,locale,minutes}:{template:SessionTemplate;locale:'zh'|'en';minutes?:CoachPanelProps['templateMinutes']}){return <div><h4>{template.name}</h4><p>{minutes?.(template)??template.estimatedMinutes} {locale==='zh'?'分钟':'min'}</p><ul>{template.items.map((item,index)=><li key={index}>{exercises.find(e=>e.id===item.exerciseId)?.name[locale]??(locale==='zh'?'动作':'Exercise')} · {item.sets} {locale==='zh'?'组':'sets'} · {targetText(item.target,locale,indoorWalk(item.exerciseId,template.name))}</li>)}</ul></div>;}
/** Show the immutable input alongside the proposed output; neither is a recorded workout. */
export function AssistantAttachment({candidate,locale,minutes}:{candidate:CoachApplication;locale:'zh'|'en';minutes?:CoachPanelProps['templateMinutes']}){
 const {request,response}=candidate,zh=locale==='zh';
 const proposal='proposal' in response?response.proposal:response.type==='review_summary'?response.suggestion?.proposal:undefined;
 const after=proposal?.templates??(response.type==='today_adjustment'?[response.template]:[]);
 const before=request.task==='MODIFY_PLAN'?request.plan.templates:request.task==='ADJUST_TODAY'?[request.template]:[];
 const duration=(plan:{sessionMinutes:number;templates:SessionTemplate[]})=>plan.templates.some(template=>template.targetMinutes!==undefined)?estimatedDurationLabel(plan.templates,locale):String(plan.sessionMinutes)+' '+(zh?'分钟/次':'min/session');
 const compare=response.type==='change_proposal'||response.type==='today_adjustment';
 const diff=diffTemplates(before,after),unchanged=diff.unchanged;
 const differences=diff.changes.filter(change=>change.kind!=='removed'),removed=diff.changes.filter(change=>change.kind==='removed');
 // Calendar-picked days: say plainly whether this card keeps them or (only when asked) replaces them.
 const baseline=request.task==='ONBOARD_PLAN'?request.profile:request.task==='MODIFY_PLAN'?request.plan:undefined;
 const picked=request.schedule,md=(date:string)=>`${Number(date.slice(5,7))}/${Number(date.slice(8,10))}`;
 const pickedLine=picked&&proposal&&baseline?(pickedDaysReplaced(request,baseline,proposal)
  ?{kept:false,text:zh?`训练日：改为每周 ${proposal.weeklyTarget} 次，不再按日历上选的 ${picked.trainingDates.length} 天`:`Training days: ${proposal.weeklyTarget} per week instead of the ${picked.trainingDates.length} days picked on the calendar`}
  :{kept:true,text:(zh?`训练日：按你选的 ${picked.trainingDates.length} 天，${md(picked.trainingDates[0])} 起`:`Training days: the ${picked.trainingDates.length} days you picked, from ${md(picked.trainingDates[0])}`)+(picked.startTime?(zh?` · ${picked.startTime} 开始`:` · starts ${picked.startTime}`):'')}):undefined;
 return <>{proposal&&<p>{answerText(proposal.goalText,locale)} · {proposal.weeklyTarget} {zh?'次/周':'sessions/week'} · {duration(proposal)}</p>}{request.task==='MODIFY_PLAN'&&proposal&&<p>{zh?'当前安排':'Current schedule'}：{request.plan.weeklyTarget} {zh?'次/周':'sessions/week'} · {duration(request.plan)} → {zh?'建议安排':'Suggested schedule'}：{proposal.weeklyTarget} {zh?'次/周':'sessions/week'} · {duration(proposal)}</p>}
 {compare?<div className="assistant-diff"><strong>{request.trainingEngine?(zh?`替换 ${diff.changes.filter(c=>c.kind==='replaced').length} 项、新增 ${diff.changes.filter(c=>c.kind==='added').length} 项、调整 ${diff.changes.filter(c=>c.kind==='updated').length} 项、移除 ${removed.length} 项`:`${diff.changes.filter(c=>c.kind==='replaced').length} replaced, ${diff.changes.filter(c=>c.kind==='added').length} added, ${diff.changes.filter(c=>c.kind==='updated').length} changed, ${removed.length} removed`):(zh?`调整 ${differences.length+removed.length} 项 · 预计 ${estimatedDurationLabel(after,locale)}`:`${differences.length+removed.length} changes · about ${estimatedDurationLabel(after,locale)}`)} · {zh?'预计':'about'} {estimatedDurationLabel(after,locale)} </strong><ul>{differences.map(({key,item,previous,kind,templateIndex})=>{const template=after[templateIndex];return <li key={key} data-change={kind}><span>{kind==='added'?(zh?'新增':'Added'):kind==='replaced'?(zh?'替换':'Replaced'):(zh?'调整':'Changed')}</span> {previous&&previous.exerciseId!==item.exerciseId&&<>{exercises.find(e=>e.id===previous.exerciseId)?.name[locale]??previous.exerciseId} → </>}{exercises.find(e=>e.id===item.exerciseId)?.name[locale]??item.exerciseId} · {item.sets} {zh?'组':'sets'} · {targetText(item.target,locale,indoorWalk(item.exerciseId,template?.name??''))}{kind==='replaced'&&<details><summary>{zh?'查看替换动作指导':'Guide for the replacement exercise'}</summary><ExerciseGuideContent id={item.exerciseId} locale={locale}/></details>}</li>;})}{removed.map(({key,item})=><li key={key} data-change="removed"><span>{zh?'删除':'Removed'}</span> {exercises.find(e=>e.id===item.exerciseId)?.name[locale]??item.exerciseId}</li>)}</ul>{unchanged>0&&<details><summary>{zh?`其余 ${unchanged} 个动作不变`:`${unchanged} other exercises unchanged`}</summary>{unchangedTemplates(before,after).filter(template=>template.items.length).map(template=><AssistantTemplate key={template.id} template={template} locale={locale} minutes={minutes}/>)}</details>}</div>:after.map(template=><AssistantTemplate key={template.id} template={template} locale={locale} minutes={minutes}/>)}
 {pickedLine&&<p className="assistant-picked-days" data-picked-days={pickedLine.kept?'kept':'changed'}>{pickedLine.text}</p>}
 {candidate.enginePlan&&<EnginePlanNotices plan={candidate.enginePlan} locale={locale}/>}
 {response.type==='today_adjustment'&&<p>{zh?'只调整这次训练，整体计划保持原样。':'Applies to this workout only; the overall plan stays the same.'}</p>}</>;
}
