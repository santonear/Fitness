import {diffTemplates} from '../../assistant/template-diff';
import type {CoachApplication,CoachPanelProps} from './CoachPanel';
import type {SessionTemplate} from '../../domain/v8/contracts';
import {exercises} from '../../catalog/exercises';
import {targetText} from './ExerciseTargets';
import {EXERCISE_IDS} from '../../catalog/exercise-ids';
import {ExerciseGuideContent} from './ExerciseGuide';
const indoorWalk=(id:string,name:string)=>id===EXERCISE_IDS.walking&&/室内|indoor/i.test(name);
export function AssistantTemplate({template,locale,minutes}:{template:SessionTemplate;locale:'zh'|'en';minutes?:CoachPanelProps['templateMinutes']}){return <div><h4>{template.name}</h4><p>{minutes?.(template)??template.estimatedMinutes} {locale==='zh'?'分钟':'min'}</p><ul>{template.items.map((item,index)=><li key={index}>{exercises.find(e=>e.id===item.exerciseId)?.name[locale]??(locale==='zh'?'动作':'Exercise')} · {item.sets} {locale==='zh'?'组':'sets'} · {targetText(item.target,locale,indoorWalk(item.exerciseId,template.name))}</li>)}</ul></div>;}
/** Show the immutable input alongside the proposed output; neither is a recorded workout. */
export function AssistantAttachment({candidate,locale,minutes}:{candidate:CoachApplication;locale:'zh'|'en';minutes?:CoachPanelProps['templateMinutes']}){
 const {request,response}=candidate,zh=locale==='zh';
 const proposal='proposal' in response?response.proposal:response.type==='review_summary'?response.suggestion?.proposal:undefined;
 const after=proposal?.templates??(response.type==='today_adjustment'?[response.template]:[]);
 const before=request.task==='MODIFY_PLAN'?request.plan.templates:request.task==='ADJUST_TODAY'?[request.template]:[];
 const compare=response.type==='change_proposal'||response.type==='today_adjustment';
 const diff=diffTemplates(before,after),unchanged=diff.unchanged;
 const differences=diff.changes.filter(change=>change.kind!=='removed'),removed=diff.changes.filter(change=>change.kind==='removed');
 return <>{proposal&&<p>{proposal.goalText} · {proposal.weeklyTarget} {zh?'次/周':'sessions/week'} · {proposal.sessionMinutes} {zh?'分钟/次':'min/session'}</p>}{request.task==='MODIFY_PLAN'&&proposal&&<p>{zh?'当前安排':'Current schedule'}：{request.plan.weeklyTarget} {zh?'次/周':'sessions/week'} · {request.plan.sessionMinutes} {zh?'分钟/次':'min/session'} → {zh?'建议安排':'Suggested schedule'}：{proposal.weeklyTarget} {zh?'次/周':'sessions/week'} · {proposal.sessionMinutes} {zh?'分钟/次':'min/session'}</p>}
 {compare?<div className="assistant-diff"><strong>{zh?`调整 ${differences.length+removed.length} 项 · 预计 ${after[0]?.estimatedMinutes??proposal?.sessionMinutes??0} 分钟`:`${differences.length+removed.length} changes · about ${after[0]?.estimatedMinutes??proposal?.sessionMinutes??0} min`}</strong><ul>{differences.map(({key,item,previous,kind,templateIndex})=>{const template=after[templateIndex];return <li key={key} data-change={kind}><span>{kind==='added'?(zh?'新增':'Added'):kind==='replaced'?(zh?'替换':'Replaced'):(zh?'调整':'Changed')}</span> {previous&&previous.exerciseId!==item.exerciseId&&<>{exercises.find(e=>e.id===previous.exerciseId)?.name[locale]??previous.exerciseId} → </>}{exercises.find(e=>e.id===item.exerciseId)?.name[locale]??item.exerciseId} · {item.sets} {zh?'组':'sets'} · {targetText(item.target,locale,indoorWalk(item.exerciseId,template?.name??''))}{kind==='replaced'&&<details><summary>{zh?'查看替换动作指导':'Guide for the replacement exercise'}</summary><ExerciseGuideContent id={item.exerciseId} locale={locale}/></details>}</li>;})}{removed.map(({key,item})=><li key={key} data-change="removed"><span>{zh?'删除':'Removed'}</span> {exercises.find(e=>e.id===item.exerciseId)?.name[locale]??item.exerciseId}</li>)}</ul>{unchanged>0&&<p>{zh?`其余 ${unchanged} 个动作不变`:`${unchanged} other exercises unchanged`}</p>}</div>:after.map(template=><AssistantTemplate key={template.id} template={template} locale={locale} minutes={minutes}/>)}
 {response.type==='today_adjustment'&&<p>{zh?'只调整这次训练，整体计划保持原样。':'Applies to this workout only; the overall plan stays the same.'}</p>}</>;
}
