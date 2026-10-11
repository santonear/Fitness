import {inferAssistantLocale,applyAssistantPreferences} from '../../assistant/contracts';
import {assistantCopy as copy} from '../../i18n/features/coach/assistant';
import {equipmentLabel} from '../../catalog/taxonomy';
import {ExerciseGuideContent} from './ExerciseGuide';
import {useEffect,useRef,useState} from 'react';
import type {CoachApplication,CoachPanelProps} from './CoachPanel';
import {Button,Composer,MorphPanel} from './common';
import {CoachVisual} from './CoachVisual';
import {repository} from '../../persistence/repository';
import {conversationStore,type AssistantConversation} from '../../persistence/assistant-conversations';
import {sendAssistant,AssistantError} from '../../assistant/client';
import {approveCoachScope,coachScope} from '../../coach/consent';
import {localCoachReply} from '../../coach/local-fallback';
import {exercises} from '../../catalog/exercises';
import {targetText} from './ExerciseTargets';
import './AssistantPanel.css';
const store=conversationStore(repository.db);
const fresh=():AssistantConversation=>({id:crypto.randomUUID(),title:'',updatedAt:new Date().toISOString(),messages:[]});
/** Historical conversations contain text only: restoring them cannot revive actionable candidates. */
export function AssistantPanel(props:CoachPanelProps){
 const {open,onClose,request,expectedRevision,onApply,beforeSend,onResponse,initialSend}=props;
 const locale=props.locale??request?.locale??'zh',t=copy[locale];
 const [chat,setChat]=useState(fresh),[rows,setRows]=useState<AssistantConversation[]>([]),[text,setText]=useState(''),[busy,setBusy]=useState(false),[applying,setApplying]=useState(false),[body,setBody]=useState(false),[history,setHistory]=useState(false),[error,setError]=useState(''),[pending,setPending]=useState(false),[candidate,setCandidate]=useState<CoachApplication>(),[saved,setSaved]=useState(false),[historyOpen,setHistoryOpen]=useState(false);
 const [guide,setGuide]=useState<string>();
 const loaded=useRef(false),applyLock=useRef(false);
 const [privacy,setPrivacy]=useState(()=>{try{return localStorage.getItem('fitness-assistant-privacy')!=='seen';}catch{return true;}});
 const fallbackTrigger=useRef<HTMLElement>(null);
 const controller=useRef<AbortController>(null),lock=useRef(false),sequence=useRef(0),consumed=useRef(new Set<string>()),end=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(open)void store.list().then(found=>{setRows(found);if(!loaded.current){loaded.current=true;if(found[0]&&!lock.current&&!initialSend){setChat(found[0]);setBody(found[0].consent?.body??false);setHistory(found[0].consent?.history??false);}}}).catch(()=>setError(t.storage));},[open,t.storage]);
 useEffect(()=>{end.current?.scrollIntoView({block:'nearest'});},[chat.messages,pending]);
 useEffect(()=>()=>{sequence.current++;controller.current?.abort();},[]);
 useEffect(()=>{sequence.current++;controller.current?.abort();lock.current=false;setBusy(false);setCandidate(undefined);setBody(false);setHistory(false);},[request?.restoreGeneration]);
 useEffect(()=>{if(open&&initialSend&&!consumed.current.has(initialSend.nonce)){consumed.current.add(initialSend.nonce);void send(initialSend.message,initialSend.request,initialSend.expectedRevision);}},[open,initialSend?.nonce]);
 async function persist(next:AssistantConversation){try{await store.save(next);setRows(await store.list());}catch{setError(t.storage);}}
 function select(next:AssistantConversation){setChat(next);setCandidate(undefined);setGuide(undefined);setSaved(false);setBody(next.consent?.body??false);setHistory(next.consent?.history??false);setText('');setHistoryOpen(false);setError('');}
 function setConsent(key:'body'|'history',value:boolean){const consent={body,history,[key]:value};key==='body'?setBody(value):setHistory(value);const next={...chat,consent};setChat(next);if(next.messages.length)void persist(next);}
 async function send(message=text,source=request,revision=expectedRevision){
  if(lock.current||!message.trim())return;lock.current=true;setBusy(true);setPending(false);setError('');setCandidate(undefined);setGuide(undefined);setSaved(false);setText('');
  const replyLocale=inferAssistantLocale(message,locale);
  const serial=++sequence.current,abort=new AbortController();controller.current=abort;
  const next:AssistantConversation={...chat,consent:{body,history},title:chat.title||message.trim().slice(0,80),updatedAt:new Date().toISOString(),messages:[...chat.messages,{role:'user',content:message.trim()},{role:'assistant',content:''}].slice(-200) as AssistantConversation['messages']};
  setChat({...next});let responseText='';
  try{
   const scoped=source?coachScope({...source,locale:replyLocale,requestId:crypto.randomUUID(),conversationId:chat.id,messages:[{role:'user',content:message.trim().slice(0,1600)}],...('instruction' in source?{instruction:message.trim()}: {})},body,history):undefined;
   const context=scoped?await approveCoachScope(applyAssistantPreferences(scoped,next.messages.slice(0,-1).slice(-20))):undefined;
   if(context)await beforeSend?.(context);
   if(props.localOnly){const profile=(await repository.db.v8State.get('v8'))?.coachProfile;const reply=localCoachReply(message,context,profile,replyLocale);responseText=reply.lines.join('\n');setGuide(reply.guideExerciseId);if(context&&reply.response)setCandidate({request:context,response:reply.response,expectedRevision:revision});}
   else{
    try{localStorage.setItem('fitness-assistant-privacy','seen');}catch{/* Explanation stays visible when storage is unavailable. */}setPrivacy(false);
    await sendAssistant({version:'fitness-assistant-v2',requestId:context?.requestId??crypto.randomUUID(),conversationId:chat.id,locale:replyLocale,timeZone:source?.timeZone??Intl.DateTimeFormat().resolvedOptions().timeZone,adultConfirmed:source?.adultConfirmed??false,context,consent:{body,history},messages:next.messages.slice(0,-1).slice(-20).map(m=>({...m,content:m.content.slice(0,4000)}))},abort.signal,event=>{
     if(serial!==sequence.current)return;
     if(event.type==='text_delta'){responseText+=event.delta;next.messages[next.messages.length-1]={role:'assistant',content:responseText};setChat({...next,messages:[...next.messages]});}
     if(event.type==='attachment_pending')setPending(true);
     if(event.type==='attachment'){setPending(false);if(event.attachment.type==='exercise_info'){setGuide(event.attachment.exerciseId);responseText+='\n'+event.attachment.summary;}else if(context){if(event.attachment.requestId!==context.requestId||event.attachment.restoreGeneration!==context.restoreGeneration)throw new Error('STALE_INPUT');const value={request:context,response:event.attachment,expectedRevision:revision};setCandidate(value);onResponse?.(value);}}
     if(event.type==='done'&&!event.success){setCandidate(undefined);setError(value=>value||t.model);}
     if(event.type==='attachment_failed'){setPending(false);setError(t.attachment);}
    });
   }
  }catch(reason){if(!abort.signal.aborted&&serial===sequence.current){const code=reason instanceof Error?reason.message:'';setError(code==='DAILY_MESSAGE_LIMIT'?t.limit+(reason instanceof AssistantError&&reason.resetAt?new Date(reason.resetAt).toLocaleString(locale):'—'):code==='QUALIFICATION_REQUIRED'?t.invalid:code==='AI_DISABLED'?t.disabled:['MODEL_UNAVAILABLE','GENERATION_FAILED','SERVICE_UNAVAILABLE','USAGE_UNAVAILABLE'].includes(code)?t.model:code==='CONCURRENT_REQUEST'?t.concurrent:code==='NETWORK_ERROR'||reason instanceof TypeError?t.network:t.model);const profile=(await repository.db.v8State.get('v8').catch(()=>undefined))?.coachProfile;const local=localCoachReply(message,source,profile,replyLocale);responseText=responseText||local.lines.join('\n');setGuide(local.guideExerciseId);}}
  finally{if(serial===sequence.current){next.messages[next.messages.length-1]={role:'assistant',content:responseText.slice(0,16000)};if(!responseText)next.messages.pop();setChat({...next,messages:[...next.messages]});setBusy(false);setPending(false);lock.current=false;await persist(next);}}
 }
 const response=candidate?.response,proposal=response&&('proposal' in response?response.proposal:response.type==='review_summary'?response.suggestion?.proposal:undefined),templates=proposal?.templates??(response?.type==='today_adjustment'?[response.template]:[]);
 const canApply=response&&(['plan_proposal','change_proposal','today_adjustment'].includes(response.type)||response.type==='review_summary'&&response.suggestion);
 return <MorphPanel open={open} onClose={onClose} triggerRef={props.triggerRef??fallbackTrigger} title={t.title} closeLabel={t.close}><div className="assistant-panel">
 <div className="assistant-toolbar"><CoachVisual state={busy?'thinking':'idle'}/><Button disabled={busy||applying} onClick={()=>select(fresh())}>{t.new}</Button><Button disabled={busy||applying} onClick={()=>setHistoryOpen(!historyOpen)}>{t.history}</Button></div>
 {privacy&&<p>{t.privacy}</p>}
 {historyOpen&&<ul>{rows.map(row=><li key={row.id}><Button disabled={busy||applying} onClick={()=>select(row)}>{row.title}</Button><Button disabled={busy||applying} aria-label={`${t.remove}: ${row.title}`} onClick={()=>void store.remove(row.id).then(async()=>{setRows(await store.list());if(row.id===chat.id)select(fresh());})}>{t.remove}</Button></li>)}</ul>}
 <div role="log" aria-label={t.title} aria-live="polite" className="assistant-messages">{chat.messages.map((message,index)=><div key={index} className={`assistant-bubble assistant-bubble--${message.role}`}><span className="assistant-speaker">{message.role==='user'?t.you:t.title}</span><p>{message.content}</p></div>)}<div ref={end}/></div>
 {guide&&<details><summary>{exercises.find(e=>e.id===guide)?.name[locale]}</summary><ExerciseGuideContent id={guide} locale={locale}/></details>}
 {pending&&<p role="status">{t.pending}</p>}
 {candidate&&templates.length>0&&<section className="assistant-attachment">{templates.map(template=><div key={template.id}><h3>{template.name}</h3><ul>{template.items.map((item,index)=><li key={index}>{exercises.find(e=>e.id===item.exerciseId)?.name[locale]??item.exerciseId} · {item.sets} × {targetText(item.target,locale)}</li>)}</ul></div>)}{canApply&&<Button disabled={busy||applying||saved} onClick={()=>{if(!candidate||applyLock.current)return;applyLock.current=true;setApplying(true);void onApply(candidate).then(()=>setSaved(true)).catch(()=>setError(t.stale)).finally(()=>{applyLock.current=false;setApplying(false);});}}>{saved?t.saved:props.applyLabel??t.apply}</Button>}</section>}
 <div className="assistant-consent">{request?.body&&<label><input type="checkbox" checked={body} disabled={busy||applying} onChange={event=>setConsent('body',event.target.checked)}/>{t.body}</label>}{request?.history&&<label><input type="checkbox" checked={history} disabled={busy||applying} onChange={event=>setConsent('history',event.target.checked)}/>{t.historyOpt}</label>}</div>
 <p className="assistant-summary">{t.summary}{request?` · ${t.context}`:''}{body?` · ${t.body}`:''}{history?` · ${t.historyOpt}`:''}</p>
 <details><summary>{t.details}</summary>{chat.messages.slice(-20).map((m,i)=><p key={i}>{m.content}</p>)}{request?.task==='ONBOARD_PLAN'&&<p>{request.profile.goalText} · {request.profile.scheduleOriginalText} · {request.profile.weeklyTarget} {locale==='zh'?'次/周':'sessions/week'} · {request.profile.sessionMinutes} min · {request.profile.equipment.map(e=>equipmentLabel(e,locale)).join('、')}</p>}{request?.task==='MODIFY_PLAN'&&<p>{request.plan.goalText} · {request.plan.weeklyTarget} {locale==='zh'?'次/周':'sessions/week'} · {request.plan.templates.map(t=>t.name).join('、')}</p>}{request?.task==='ADJUST_TODAY'&&<p>{request.template.name}</p>}{request?.task==='PERIOD_REVIEW'&&<p>{request.facts.from} — {request.facts.to} · {locale==='zh'?'完成':'Complete'} {request.facts.complete} · {locale==='zh'?'部分完成':'Partial'} {request.facts.partial} · {locale==='zh'?'未开始':'Not started'} {request.facts.notStarted} · {request.facts.activityMinutes} min</p>}{body&&request?.body&&<p>{Object.values(request.body).filter(v=>typeof v!=='object').join(' · ')}</p>}{history&&request?.history&&<p>{request.history}</p>}</details>
 <Composer value={text} onChange={setText} onSend={()=>void send()} label={t.input} sendLabel={t.send} busy={busy} disabled={busy||applying}/>{busy&&<Button onClick={()=>controller.current?.abort()}>{t.stop}</Button>}{error&&<p role="alert">{error}</p>}
 </div></MorphPanel>;
}
