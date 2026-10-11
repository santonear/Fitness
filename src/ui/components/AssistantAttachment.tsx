import type {CoachApplication,CoachPanelProps} from './CoachPanel';
import type {SessionTemplate} from '../../domain/v8/contracts';
import {exercises} from '../../catalog/exercises';
import {targetText} from './ExerciseTargets';
export function AssistantTemplate({template,locale,minutes}:{template:SessionTemplate;locale:'zh'|'en';minutes?:CoachPanelProps['templateMinutes']}){return <div><h4>{template.name}</h4><p>{minutes?.(template)??template.estimatedMinutes} {locale==='zh'?'分钟':'min'}</p><ul>{template.items.map((item,index)=><li key={index}>{exercises.find(e=>e.id===item.exerciseId)?.name[locale]??(locale==='zh'?'动作':'Exercise')} · {item.sets} {locale==='zh'?'组':'sets'} · {targetText(item.target,locale)}</li>)}</ul></div>;}
/** Show the immutable input alongside the proposed output; neither is a recorded workout. */
export function AssistantAttachment({candidate,locale,minutes}:{candidate:CoachApplication;locale:'zh'|'en';minutes?:CoachPanelProps['templateMinutes']}){
 const {request,response}=candidate,zh=locale==='zh';
 const proposal='proposal' in response?response.proposal:response.type==='review_summary'?response.suggestion?.proposal:undefined;
 const after=proposal?.templates??(response.type==='today_adjustment'?[response.template]:[]);
 const before=request.task==='MODIFY_PLAN'?request.plan.templates:request.task==='ADJUST_TODAY'?[request.template]:[];
 const compare=response.type==='change_proposal'||response.type==='today_adjustment';
 return <>{proposal&&<p>{proposal.goalText} · {proposal.weeklyTarget} {zh?'次/周':'sessions/week'} · {proposal.sessionMinutes} {zh?'分钟/次':'min/session'}</p>}{request.task==='MODIFY_PLAN'&&proposal&&<p>{zh?'当前安排':'Current schedule'}：{request.plan.weeklyTarget} {zh?'次/周':'sessions/week'} · {request.plan.sessionMinutes} {zh?'分钟/次':'min/session'} → {zh?'建议安排':'Suggested schedule'}：{proposal.weeklyTarget} {zh?'次/周':'sessions/week'} · {proposal.sessionMinutes} {zh?'分钟/次':'min/session'}</p>}
 {compare?<div className="assistant-comparison"><section aria-label={zh?'调整前':'Before'}><h3>{zh?'调整前':'Before'}</h3>{before.map(template=><AssistantTemplate key={template.id} template={template} locale={locale} minutes={minutes}/>)}</section><section aria-label={zh?'建议调整后':'After suggestion'}><h3>{zh?'建议调整后':'After suggestion'}</h3>{after.map(template=><AssistantTemplate key={template.id} template={template} locale={locale} minutes={minutes}/>)}</section></div>:after.map(template=><AssistantTemplate key={template.id} template={template} locale={locale} minutes={minutes}/>)}
 {response.type==='today_adjustment'&&<p>{zh?'只调整这次训练，整体计划保持原样。':'Applies to this workout only; the overall plan stays the same.'}</p>}</>;
}
