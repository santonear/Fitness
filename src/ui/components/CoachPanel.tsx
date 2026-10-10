import { useEffect, useRef, useState, type RefObject } from 'react';
import { Button, Composer, MorphPanel } from './common';
import { CoachVisual } from './CoachVisual';
import type { CoachVisualState } from './CoachAvatar';
import type { CoachRequest, CoachResponse } from '../../coach/contracts';
import { approveCoachScope, coachScope, coachScopeFields, coachMessageScope } from '../../coach/consent';
import { sendCoach } from '../../coach/transport';
import zh from '../../i18n/features/coach/zh.json';
import en from '../../i18n/features/coach/en.json';
import { exercises } from '../../catalog/exercises';
import { targetText } from './ExerciseTargets';

export type CoachApplication = { request: CoachRequest; response: CoachResponse; expectedRevision: number };
export type CoachPanelProps = { open: boolean; onClose: () => void; request?: CoachRequest; expectedRevision: number;
  initialSend?:{nonce:string;message:string;request:CoachRequest;expectedRevision:number};
  triggerRef?: RefObject<HTMLElement|null>; onLocalPlan?:()=>void; onLocalReview?:()=>void; locale?:'zh'|'en'; unavailableReason?:string; onApply: (candidate: CoachApplication) => Promise<unknown>; onResponse?: (candidate: CoachApplication) => void };

function responseText(response: CoachResponse): string[] {
 switch(response.type){case 'clarify':return [response.question];case 'refused':return [response.reason];case 'plan_proposal':return response.proposal.reasons;case 'change_proposal':return response.changes;case 'today_adjustment':return [response.summary];case 'review_summary':return [response.opening,response.encouragement,response.gap,...response.dataBoundary,...(response.suggestion?[response.suggestion.summary]:[])];}
}
function readable(value:unknown,copy:typeof zh,locale:'zh'|'en'):string{
 if(value===true)return copy.yes;if(value===false)return copy.no;if(value===null||value===undefined)return copy.empty;
 if(Array.isArray(value))return value.length?value.map(v=>readable(v,copy,locale)).join('；'):copy.empty;
 if(typeof value==='object')return Object.entries(value).filter(([key])=>!['id','metricType'].includes(key)).map(([key,v])=>`${copy.detailLabels[key as keyof typeof copy.detailLabels]??copy.fields[key as keyof typeof copy.fields]??''}${key in copy.detailLabels||key in copy.fields?'：':''}${readable(v,copy,locale)}`).join('；');
 if(typeof value==='string')return exercises.find(e=>e.id===value)?.name[locale]??copy.values[value as keyof typeof copy.values]??value;
 return String(value);
}
export function CoachScopeDisclosure({request,locale}:{request:CoachRequest;locale:'zh'|'en'}){
 const t=locale==='en'?en:zh,lang=locale==='en'?1:0;
 return <details><summary>{t.scope}</summary><p>{t.consent}</p><p>{t.taskNames[request.task]}</p><dl>{Object.entries(request).filter(([key])=>['locale','timeZone','adultConfirmed','profile','body','history','messages','template','instruction','plan','kind','facts'].includes(key)).map(([key,value])=><div key={key}><dt>{t.fields[key as keyof typeof t.fields]}</dt><dd>{readable(value,t,lang?'en':'zh')}</dd></div>)}</dl><details><summary>{t.technical}</summary><dl>{coachScopeFields(request).map(field=><div key={field.key}><dt>{t.fields[field.key as keyof typeof t.fields]??field.key}</dt><dd>{field.value}</dd></div>)}</dl></details></details>;
}
/** Keep mounted when closed so drafts and reviewed candidates survive panel dismissal. */
export function CoachPanel({open,onClose,request,expectedRevision,onApply,onResponse,triggerRef:externalTrigger,onLocalPlan,onLocalReview,locale,unavailableReason,initialSend}:CoachPanelProps){
 const [text,setText]=useState(''),[bodyKeys,setBodyKeys]=useState<string[]>([]),[history,setHistory]=useState(false),[state,setState]=useState<CoachVisualState>('idle'),[error,setError]=useState(''),[candidate,setCandidate]=useState<CoachApplication>();
 const [requestId,setRequestId]=useState(()=>crypto.randomUUID());
 const [applying,setApplying]=useState(false),applyLock=useRef(false);
 const consumedInitialSends=useRef(new Set<string>());
 const controller=useRef<AbortController|undefined>(undefined),sequence=useRef(0),triggerRef=useRef<HTMLButtonElement>(null),sending=useRef(false);
 const t=(request?.locale??locale)==='en'?en:zh,lang=(request?.locale??locale)==='en'?1:0;
 const [noAccess,setNoAccess]=useState(false);
 const busy=state==='thinking';
 const selectedBody=Object.fromEntries(Object.entries(request?.body??{}).filter(([key])=>bodyKeys.includes(key)));
 const preview=request?coachScope({...request,body:Object.keys(selectedBody).length?selectedBody:undefined,requestId,...('instruction' in request&&text.trim()?{instruction:text.trim()}:{}),messages:text.trim()?[...request.messages.slice(-7),{role:'user',content:text.trim()}]:request.messages},bodyKeys.length>0,history):undefined;
 useEffect(()=>()=>{sequence.current++;controller.current?.abort();},[]);
 useEffect(()=>{sequence.current++;controller.current?.abort();sending.current=false;setState('idle');setCandidate(undefined);setBodyKeys([]);setHistory(false);},[request?.restoreGeneration,request?.conversationId]);
 useEffect(()=>{if(!open||!initialSend||applyLock.current||consumedInitialSends.current.has(initialSend.nonce))return;sequence.current++;controller.current?.abort();sending.current=false;consumedInitialSends.current.add(initialSend.nonce);setText(initialSend.message);setBodyKeys([]);setHistory(false);void send(coachMessageScope(initialSend.request,initialSend.message),initialSend.expectedRevision);},[open,initialSend?.nonce,applying]);
 async function send(scope=preview,revision=expectedRevision){
  if(!scope||sending.current||applyLock.current)return;sending.current=true;const serial=++sequence.current;const abort=new AbortController();controller.current=abort;setError('');setNoAccess(false);setState('thinking');
  try{const approved=await approveCoachScope(scope);const result=await sendCoach(approved,abort.signal);if(serial!==sequence.current)return;
   const next={request:approved,response:result.response,expectedRevision:revision};setCandidate(next);setState('replying');onResponse?.(next);
  }catch(e){if(serial!==sequence.current)return;setState('idle');const denied=e instanceof Error&&['QUALIFICATION_REQUIRED','SUBJECT_EXPIRED','AI_DISABLED','INDIVIDUAL_QUOTA_EXHAUSTED','GLOBAL_BUDGET_EXHAUSTED'].includes(e.message);setNoAccess(denied);if(!abort.signal.aborted)setError(denied?t.qualification:t.offline);}finally{if(serial===sequence.current){sending.current=false;setRequestId(crypto.randomUUID());}}
 }
 async function apply(){if(!candidate||busy||applyLock.current)return;applyLock.current=true;setApplying(true);setError('');try{await onApply(candidate);setState('success');}catch{setError(t.stale);}finally{applyLock.current=false;setApplying(false);}}
 const proposal=candidate&&('proposal' in candidate.response?candidate.response.proposal:candidate.response.type==='review_summary'?candidate.response.suggestion?.proposal:undefined);
 const templates=proposal?.templates??(candidate?.response.type==='today_adjustment'?[candidate.response.template]:[]);
 const canApply=candidate&&(['plan_proposal','change_proposal','today_adjustment'].includes(candidate.response.type)||candidate.response.type==='review_summary'&&candidate.response.suggestion);
 return <MorphPanel open={open} onClose={onClose} triggerRef={externalTrigger??triggerRef} title={t.title} closeLabel={t.close}>
  <div className="coach-panel-content">
  <CoachVisual state={state}/><div aria-live="polite">{busy?t.thinking:state==='success'?t.saved:''}</div>
  {!request&&<p>{unavailableReason??t.unavailable}</p>}
  {(!request||noAccess)&&<>{onLocalPlan&&<Button onClick={onLocalPlan}>{t.localPlan}</Button>}{onLocalReview&&<Button onClick={onLocalReview}>{t.localReview}</Button>}</>}
  {candidate&&<section>{responseText(candidate.response).map((line,index)=><p key={index}>{line}</p>)}{templates.map(template=><section key={template.id}><h3>{template.name}</h3><p>{template.estimatedMinutes} {t.minutes}</p><ul>{template.items.map((item,index)=><li key={index}>{exercises.find(e=>e.id===item.exerciseId)?.name[lang?'en':'zh']??item.exerciseId} · {item.sets} {t.sets} · {targetText(item.target,lang?'en':'zh')}</li>)}</ul></section>)}{canApply&&state!=='success'&&<Button disabled={applying} onClick={()=>void apply()}>{t.apply}</Button>}</section>}
  {preview&&<><>{request?.body&&Object.keys(request.body).length>0&&<fieldset disabled={busy||applying}><legend>{t.body}</legend>{Object.entries(request.body).map(([key,value])=><label key={key}><input type="checkbox" checked={bodyKeys.includes(key)} onChange={e=>setBodyKeys(keys=>e.target.checked?[...keys,key]:keys.filter(k=>k!==key))}/>{t.detailLabels[key as keyof typeof t.detailLabels]??key} · {readable(value,t,lang?'en':'zh')}</label>)}</fieldset>}{request?.history&&<label><input type="checkbox" checked={history} disabled={busy||applying} onChange={e=>setHistory(e.target.checked)}/>{t.history}</label>}</>
   <CoachScopeDisclosure request={preview} locale={lang?'en':'zh'}/>
   <Composer value={text} onChange={setText} onSend={()=>void send()} label={t.input} sendLabel={t.send} busy={busy} disabled={busy||applying}/></>}
  {busy&&<Button onClick={()=>{sequence.current++;controller.current?.abort();sending.current=false;setState('idle');}}>{t.cancel}</Button>}{error&&<p role="alert">{error}</p>}
  </div></MorphPanel>;
}
