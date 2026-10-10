import { useEffect, useRef, useState, type RefObject } from 'react';
import { Button, Composer, MorphPanel } from './common';
import { CoachVisual } from './CoachVisual';
import type { CoachVisualState } from './CoachAvatar';
import type { CoachRequest, CoachResponse } from '../../coach/contracts';
import { approveCoachScope, coachScope, coachScopeFields } from '../../coach/consent';
import { sendCoach } from '../../coach/transport';
import { exercises } from '../../catalog/exercises';

export type CoachApplication = { request: CoachRequest; response: CoachResponse; expectedRevision: number };
export type CoachPanelProps = { open: boolean; onClose: () => void; request?: CoachRequest; expectedRevision: number;
  triggerRef?: RefObject<HTMLElement|null>; onApply: (candidate: CoachApplication) => Promise<unknown>; onResponse?: (candidate: CoachApplication) => void };
const zh = { title:'芽芽',close:'关闭',send:'发送',input:'跟芽芽说',scope:'将发送给芽芽',consent:'点“发送”即同意发送以下内容给芽芽',body:'发送身体资料',history:'发送训练历史',apply:'确认应用',cancel:'取消等待',offline:'芽芽暂时连不上，你的记录不受影响',unavailable:'还没有可调整的计划，可以先制定基础计划。',qualification:'暂时没有 AI 资格，基础计划和本地训练仍可使用。',saved:'已保存',thinking:'芽芽在想…' };
const en = { title:'Yaya',close:'Close',send:'Send',input:'Talk to Yaya',scope:'What will be sent to Yaya',consent:'Selecting Send allows these details to be sent to Yaya',body:'Include body details',history:'Include training history',apply:'Apply changes',cancel:'Stop waiting',offline:'Yaya is unavailable. Your records are unaffected.',unavailable:'Create a basic plan before making adjustments.',qualification:'AI access is unavailable. Basic plans and local training remain available.',saved:'Saved',thinking:'Yaya is thinking…' };
const fieldNames: Record<string,[string,string]> = {version:['服务版本','Service version'],requestId:['本次请求编号','Request reference'],conversationId:['本次对话编号','Conversation reference'],restoreGeneration:['备份恢复标识','Restore reference'],inputSnapshot:['当前资料标识','Current input reference'],locale:['语言','Language'],timeZone:['时区','Time zone'],adultConfirmed:['成年确认','Adult confirmation'],messages:['本次对话','Conversation'],task:['这次要做什么','Task'],profile:['计划所需信息','Planning details'],body:['身体资料','Body details'],history:['训练历史','Training history'],target:['当前计划版本','Current plan version'],workoutId:['本次训练编号','Workout reference'],template:['这一次训练单','Current workout template'],instruction:['你的要求','Your request'],plan:['当前计划','Current plan'],kind:['回顾范围','Review period'],facts:['回顾数据','Review facts']};

function responseText(response: CoachResponse): string[] {
 switch(response.type){case 'clarify':return [response.question];case 'refused':return [response.reason];case 'plan_proposal':return response.proposal.reasons;case 'change_proposal':return response.changes;case 'today_adjustment':return [response.summary];case 'review_summary':return [response.opening,response.encouragement,response.gap,...response.dataBoundary,...(response.suggestion?[response.suggestion.summary]:[])];}
}
/** Keep mounted when closed so drafts and reviewed candidates survive panel dismissal. */
export function CoachPanel({open,onClose,request,expectedRevision,onApply,onResponse,triggerRef:externalTrigger}:CoachPanelProps){
 const [text,setText]=useState(''),[body,setBody]=useState(false),[history,setHistory]=useState(false),[state,setState]=useState<CoachVisualState>('idle'),[error,setError]=useState(''),[candidate,setCandidate]=useState<CoachApplication>();
 const controller=useRef<AbortController|undefined>(undefined),sequence=useRef(0),triggerRef=useRef<HTMLButtonElement>(null),sending=useRef(false);
 const t=request?.locale==='en'?en:zh,lang=request?.locale==='en'?1:0;
 const busy=state==='thinking';
 const preview=request?coachScope({...request,...('instruction' in request&&text.trim()?{instruction:text.trim()}:{}),messages:text.trim()?[...request.messages.slice(-7),{role:'user',content:text.trim()}]:request.messages},body,history):undefined;
 useEffect(()=>()=>{sequence.current++;controller.current?.abort();},[]);
 useEffect(()=>{sequence.current++;controller.current?.abort();setState('idle');setCandidate(undefined);setBody(false);setHistory(false);},[request?.restoreGeneration,request?.conversationId]);
 async function send(){
  if(!preview||sending.current)return;sending.current=true;const serial=++sequence.current;const abort=new AbortController();controller.current=abort;setError('');setState('thinking');
  try{const approved=await approveCoachScope({...preview,requestId:crypto.randomUUID()});const result=await sendCoach(approved,abort.signal);if(serial!==sequence.current)return;
   const next={request:approved,response:result.response,expectedRevision};setCandidate(next);setState('replying');onResponse?.(next);
  }catch(e){if(serial!==sequence.current)return;setState('idle');if(!abort.signal.aborted)setError(e instanceof Error&&e.message==='QUALIFICATION_REQUIRED'?t.qualification:t.offline);}finally{sending.current=false;}
 }
 async function apply(){if(!candidate||busy)return;setError('');try{await onApply(candidate);setState('success');}catch{setError(t.offline);}}
 const proposal=candidate&&('proposal' in candidate.response?candidate.response.proposal:candidate.response.type==='review_summary'?candidate.response.suggestion?.proposal:undefined);
 const templates=proposal?.templates??(candidate?.response.type==='today_adjustment'?[candidate.response.template]:[]);
 const canApply=candidate&&(['plan_proposal','change_proposal','today_adjustment'].includes(candidate.response.type)||candidate.response.type==='review_summary'&&candidate.response.suggestion);
 return <MorphPanel open={open} onClose={onClose} triggerRef={externalTrigger??triggerRef} title={t.title} closeLabel={t.close}>
  <div className="coach-panel-content">
  <CoachVisual state={state}/><div aria-live="polite">{busy?t.thinking:state==='success'?t.saved:''}</div>
  {!request&&<p>{t.unavailable}</p>}
  {candidate&&<section>{responseText(candidate.response).map((line,index)=><p key={index}>{line}</p>)}{templates.map(template=><section key={template.id}><h3>{template.name}</h3><p>{template.estimatedMinutes} {lang?'minutes':'分钟'}</p><ul>{template.items.map((item,index)=><li key={index}>{exercises.find(e=>e.id===item.exerciseId)?.name[lang?'en':'zh']??item.exerciseId} · {item.sets} {lang?'sets':'组'}</li>)}</ul></section>)}{canApply&&state!=='success'&&<Button onClick={()=>void apply()}>{t.apply}</Button>}</section>}
  {preview&&<><label><input type="checkbox" checked={body} disabled={busy||!request?.body} onChange={e=>setBody(e.target.checked)}/>{t.body}</label><label><input type="checkbox" checked={history} disabled={busy||!request?.history} onChange={e=>setHistory(e.target.checked)}/>{t.history}</label>
   <details><summary>{t.scope}</summary><p>{t.consent}</p><dl>{coachScopeFields(preview).map(field=><div key={field.key}><dt>{fieldNames[field.key]?.[lang]??field.key}</dt><dd>{field.value}</dd></div>)}</dl></details>
   <Composer value={text} onChange={setText} onSend={()=>void send()} label={t.input} sendLabel={t.send} busy={busy} disabled={busy}/></>}
  {busy&&<Button onClick={()=>{sequence.current++;controller.current?.abort();setState('idle');}}>{t.cancel}</Button>}{error&&<p role="alert">{error}</p>}
  </div></MorphPanel>;
}
