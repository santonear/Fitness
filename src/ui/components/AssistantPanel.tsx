import {assistantApplyErrorCopy} from '../../assistant/application-error';
import {currentWorkoutContext} from '../../assistant/client-context';
import {AssistantAttachment} from './AssistantAttachment';
import coachZh from '../../i18n/features/coach/zh.json';
import coachEn from '../../i18n/features/coach/en.json';
import {inferAssistantLocale,applyAssistantPreferences} from '../../assistant/contracts';
import {displayTimeZone} from '../../coach/disclosure-format';
import {useFeature} from '../useFeature';
import {nutritionForCoach} from '../../application/nutrition';
import {lifestyleCopy} from '../../i18n/features/settings/lifestyle';
import {assistantCopy as copy} from '../../i18n/features/coach/assistant';
import {ExerciseGuideContent} from './ExerciseGuide';
import {useEffect,useRef,useState} from 'react';
import type {CoachApplication,CoachPanelProps} from './CoachPanel';
import {Button,Composer,MorphPanel} from './common';
import {CoachVisual} from './CoachVisual';
import {repository} from '../../persistence/repository';
import {conversationStore,type AssistantConversation} from '../../persistence/assistant-conversations';
import {assistantPreferences,confirmedPreferenceChanges,type AssistantPreference} from '../../persistence/assistant-preferences';
import {sendAssistant,AssistantError} from '../../assistant/client';
import {approveCoachScope,coachScope} from '../../coach/consent';
import {localCoachReply} from '../../coach/local-fallback';
import {exercises} from '../../catalog/exercises';
import './AssistantPanel.css';
const store=conversationStore(repository.db);
const fresh=():AssistantConversation=>({id:crypto.randomUUID(),title:'',updatedAt:new Date().toISOString(),messages:[]});
const rememberedBody=()=>{try{return localStorage.getItem('fitness-assistant-body-consent')==='yes';}catch{return false;}};
/** Historical conversations contain text only: restoring them cannot revive actionable candidates. */
export function AssistantPanel(props:CoachPanelProps){
 const {open,onClose,request,expectedRevision,onApply,beforeSend,onResponse,initialSend}=props;
 const locale=props.locale??request?.locale??'zh',t=copy[locale];
 const [chat,setChat]=useState(fresh),[rows,setRows]=useState<AssistantConversation[]>([]),[text,setText]=useState(''),[busy,setBusy]=useState(false),[applying,setApplying]=useState(false),[body,setBody]=useState(rememberedBody),[history,setHistory]=useState(false),[error,setError]=useState(''),[pending,setPending]=useState(false),[candidate,setCandidate]=useState<CoachApplication>(),[saved,setSaved]=useState(false),[historyOpen,setHistoryOpen]=useState(false),[remembered,setRemembered]=useState<{ids:string[];items:AssistantPreference[]}>();
 const [workoutContext,setWorkoutContext]=useState<Awaited<ReturnType<typeof currentWorkoutContext>>>();
 const [preferenceCount,setPreferenceCount]=useState(0);
 const activeWorkoutId=request?.task==='ADJUST_TODAY'?request.workoutId:undefined;
 const [localReply,setLocalReply]=useState(false);
 const nutritionEnabled=useFeature('nutrition')&&!props.disableNutrition;
 const [diet,setDiet]=useState(false),[dietWithdrawn,setDietWithdrawn]=useState(false);
 useEffect(()=>{if(!open&&diet){setDiet(false);setDietWithdrawn(true);}},[open,diet]);
 const [bodyFields,setBodyFields]=useState<string[]|undefined>();
 const [guide,setGuide]=useState<string>();
 const [onlyToday,setOnlyToday]=useState(false);
 const [retryMessage,setRetryMessage]=useState('');
 const loaded=useRef(false),applyLock=useRef(false);
 const [privacy,setPrivacy]=useState(()=>{try{return localStorage.getItem('fitness-assistant-privacy')!=='seen';}catch{return true;}});
 const fallbackTrigger=useRef<HTMLElement>(null);
 const controller=useRef<AbortController>(null),lock=useRef(false),sequence=useRef(0),consumed=useRef(new Set<string>()),end=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(open)void store.list().then(found=>{setRows(found);if(!loaded.current){loaded.current=true;if(found[0]&&!lock.current&&!initialSend){setChat(found[0]);setBody(found[0].consent?.body??false);setBodyFields(found[0].consent?.bodyFields);setHistory(found[0].consent?.history??false);}}}).catch(()=>setError(t.storage));},[open,t.storage]);
 useEffect(()=>{let alive=true;if(open)void currentWorkoutContext(request,repository.db).then(value=>{if(alive)setWorkoutContext(value);}).catch(()=>{if(alive)setWorkoutContext(undefined);});return()=>{alive=false;};},[open,activeWorkoutId,expectedRevision,request?.restoreGeneration]);
 useEffect(()=>{let alive=true;if(open)void assistantPreferences.forRequest().then(items=>{if(alive)setPreferenceCount(items.length)}).catch(()=>{if(alive)setPreferenceCount(0)});return()=>{alive=false;};},[open,remembered]);
 useEffect(()=>{end.current?.scrollIntoView({block:'nearest'});},[chat.messages,pending]);
 useEffect(()=>()=>{sequence.current++;controller.current?.abort();},[]);
 useEffect(()=>{sequence.current++;controller.current?.abort();lock.current=false;setBusy(false);setCandidate(undefined);setBody(rememberedBody());setHistory(false);},[request?.restoreGeneration]);
 useEffect(()=>{if(open&&initialSend&&!consumed.current.has(initialSend.nonce)){consumed.current.add(initialSend.nonce);void send(initialSend.message,initialSend.request,initialSend.expectedRevision);}},[open,initialSend?.nonce]);
 async function persist(next:AssistantConversation){try{await store.save(next);setRows(await store.list());}catch{setError(t.storage);}}
 function select(next:AssistantConversation){setDiet(false);setDietWithdrawn(false);setLocalReply(false);setChat(next);setBodyFields(next.consent?.bodyFields);setCandidate(undefined);setGuide(undefined);setSaved(false);setRemembered(undefined);setOnlyToday(false);setBody(next.consent?.body??rememberedBody());setHistory(next.consent?.history??false);setText('');setHistoryOpen(false);setError('');}
 function setConsent(key:'body'|'history',value:boolean,fields=bodyFields){const consent={body,history,...(fields?{bodyFields:fields}:{}),[key]:value};if(key==='body'){setBody(value);try{localStorage.setItem('fitness-assistant-body-consent',value?'yes':'no');}catch{/* The current conversation still remembers consent. */}}else setHistory(value);const next={...chat,consent};setChat(next);if(next.messages.length)void persist(next);}
 async function send(message=text,source=request,revision=expectedRevision){
  if(lock.current||!message.trim())return;lock.current=true;setBusy(true);setPending(false);setLocalReply(false);setError('');setRetryMessage('');setCandidate(undefined);setGuide(undefined);setSaved(false);setRemembered(undefined);setOnlyToday(false);setText('');
  const replyLocale=inferAssistantLocale(message,locale);
  const routed=source?props.resolveRequest?.(message,source)??source:undefined;
  const routedRevision=routed&&'target' in routed?routed.target.revision:revision;
  setOnlyToday(source?.task==='ADJUST_TODAY'&&routed?.task==='MODIFY_PLAN'&&/(?:今天|这次|今日|\btoday\b|\bthis workout\b)/i.test(message));
  const serial=++sequence.current,abort=new AbortController();controller.current=abort;
  const next:AssistantConversation={...chat,consent:{body,history,...(bodyFields?{bodyFields}:{})},title:chat.title||message.trim().slice(0,80),updatedAt:new Date().toISOString(),messages:[...chat.messages,{role:'user',content:message.trim()},{role:'assistant',content:''}] as AssistantConversation['messages']};
  setChat({...next});let responseText='';
  try{
   const nutrition=diet&&nutritionEnabled?nutritionForCoach(await repository.db.nutritionRecords.toArray(),true):undefined;
   const scoped=routed?coachScope({...routed,...(nutrition?{nutrition}:{}),...(bodyFields&&routed.body?{body:Object.fromEntries(Object.entries(routed.body).filter(([key])=>bodyFields.includes(key)))}:{}),locale:replyLocale,requestId:crypto.randomUUID(),conversationId:chat.id,messages:[{role:'user',content:message.trim().slice(0,1600)}],...('instruction' in routed?{instruction:message.trim()}: {})},body,history,diet&&nutritionEnabled):undefined;
   const preferences=await assistantPreferences.forRequest();
   const context=scoped?await approveCoachScope(applyAssistantPreferences({...scoped,candidateContext:{equipment:scoped.candidateContext?.equipment??(scoped.task==='ONBOARD_PLAN'?scoped.profile.equipment:[]),cautions:scoped.candidateContext?.cautions??(scoped.task==='ONBOARD_PLAN'?scoped.profile.cautions:[]),preferences}},next.messages.slice(0,-1).slice(-20))):undefined;
   if(context)await beforeSend?.(context);
   const currentWorkout=await currentWorkoutContext(context,repository.db);setWorkoutContext(currentWorkout);
   if(props.localOnly){setLocalReply(true);const profile=(await repository.db.v8State.get('v8'))?.coachProfile;const reply=localCoachReply(message,context,profile,replyLocale);responseText=reply.lines.join('\n');setGuide(reply.guideExerciseId);if(context&&reply.response)setCandidate({request:context,response:reply.response,expectedRevision:routedRevision});}
   else{
    try{localStorage.setItem('fitness-assistant-privacy','seen');}catch{/* Explanation stays visible when storage is unavailable. */}setPrivacy(false);
    let streamIssue:'model'|'attachment'|'no_change'|undefined;
    await sendAssistant({version:'fitness-assistant-v2',requestId:context?.requestId??crypto.randomUUID(),conversationId:chat.id,locale:replyLocale,timeZone:source?.timeZone??Intl.DateTimeFormat().resolvedOptions().timeZone,adultConfirmed:source?.adultConfirmed??false,context,currentWorkout,consent:{body,history,nutrition:diet&&nutritionEnabled},preferences,messages:next.messages.slice(0,-1).slice(dietWithdrawn?-1:-20).map(m=>({...m,content:m.content.slice(0,4000)}))},abort.signal,event=>{
     if(serial!==sequence.current)return;
     if(event.type==='text_delta'){responseText+=event.delta;next.messages[next.messages.length-1]={role:'assistant',content:responseText};setChat({...next,messages:[...next.messages]});}
     if(event.type==='attachment_pending')setPending(true);
     if(event.type==='attachment'){setPending(false);if(event.attachment.type==='exercise_info'){const asksReplacement=/(换|替|疼|痛|replace|swap|hurt|pain)/i.test(message);const currentIds=context?.task==='ADJUST_TODAY'?context.template.items.map(item=>item.exerciseId):context?.task==='MODIFY_PLAN'?context.plan.templates.flatMap(template=>template.items.map(item=>item.exerciseId)):[];if(asksReplacement&&currentIds.includes(event.attachment.exerciseId))streamIssue='attachment';else setGuide(event.attachment.exerciseId);}else if(context){if(event.attachment.requestId!==context.requestId||event.attachment.restoreGeneration!==context.restoreGeneration)throw new Error('STALE_INPUT');const value={request:context,response:event.attachment,expectedRevision:routedRevision};setCandidate(value);onResponse?.(value);}}
     if(event.type==='done'&&(!event.success||event.result==='no_change')){setCandidate(undefined);streamIssue=event.result==='no_change'?'no_change':'model';}
     if(event.type==='attachment_failed'){setPending(false);streamIssue=event.code==='NO_CHANGE'?'no_change':'attachment';}
    });
    if(streamIssue==='no_change'){setCandidate(undefined);setRetryMessage(message);}
    else if(streamIssue){const profile=(await repository.db.v8State.get('v8').catch(()=>undefined))?.coachProfile;const locked=[...new Set(currentWorkout?.completedSets.map(set=>set.itemIndex)??[])];const local=localCoachReply(message,context,profile,replyLocale,locked);setLocalReply(true);responseText=local.lines.join('\n');setGuide(local.guideExerciseId);if(context&&local.response)setCandidate({request:context,response:local.response,expectedRevision:routedRevision});setError(streamIssue==='attachment'?(replyLocale==='zh'?'这次没能整理成可应用的方案。已给出本地建议，可再说一次。':'The suggestion could not be prepared. A local suggestion is ready; you can try again.'):(replyLocale==='zh'?'模型暂时没给出可用结果。已给出本地建议。':'The model could not provide a usable result. A local suggestion is ready.'));}
   }
  }catch(reason){if(!abort.signal.aborted&&serial===sequence.current){const code=reason instanceof Error?reason.message:'';setError(code==='DAILY_MESSAGE_LIMIT'?t.limit+(reason instanceof AssistantError&&reason.resetAt?new Date(reason.resetAt).toLocaleString(locale):'—'):code==='QUALIFICATION_REQUIRED'?t.invalid:code==='AI_DISABLED'?t.disabled:['MODEL_UNAVAILABLE','GENERATION_FAILED','SERVICE_UNAVAILABLE','USAGE_UNAVAILABLE'].includes(code)?t.model:code==='CONCURRENT_REQUEST'?t.concurrent:code==='NETWORK_ERROR'||reason instanceof TypeError?t.network:t.model);const profile=(await repository.db.v8State.get('v8').catch(()=>undefined))?.coachProfile;const current=await currentWorkoutContext(routed,repository.db).catch(()=>undefined);const locked=[...new Set(current?.completedSets.map(set=>set.itemIndex)??[])];const local=localCoachReply(message,routed,profile,replyLocale,locked);setLocalReply(true);responseText=local.lines.join('\n');setGuide(local.guideExerciseId);if(routed&&local.response)setCandidate({request:routed,response:local.response,expectedRevision:routedRevision});}}
  finally{if(serial===sequence.current){next.messages[next.messages.length-1]={role:'assistant',content:responseText.slice(0,16000)};if(!responseText)next.messages.pop();setChat({...next,messages:[...next.messages]});setBusy(false);setPending(false);lock.current=false;await persist(next);}}
 }
 const response=candidate?.response,proposal=response&&('proposal' in response?response.proposal:response.type==='review_summary'?response.suggestion?.proposal:undefined),templates=proposal?.templates??(response?.type==='today_adjustment'?[response.template]:[]);
 const contextSummary=request?.task==='MODIFY_PLAN'?`${request.plan.goalText} · ${request.plan.templates.length} ${locale==='zh'?'份训练单':'training templates'}`:request?.task==='ADJUST_TODAY'?request.template.name:request?.task==='ONBOARD_PLAN'?request.profile.goalText:request?.task==='PERIOD_REVIEW'?`${request.facts.from} — ${request.facts.to}`:'';
 const bodyLabels=(locale==='zh'?coachZh:coachEn).detailLabels;
 const canApply=response&&(['plan_proposal','change_proposal','today_adjustment'].includes(response.type)||response.type==='review_summary'&&response.suggestion);
 const rememberedText=remembered?.items.map(item=>item.kind==='dislike_exercise'?(locale==='zh'?`以后不安排 ${exercises.find(e=>e.id===item.value)?.name.zh??item.value}`:`Avoid ${exercises.find(e=>e.id===item.value)?.name.en??item.value}`):item.kind==='preferred_days'?(locale==='zh'?'训练日已记住':'Training days remembered'):item.kind==='cannot_do'?(item.value==='walking_carry'?(locale==='zh'?'以后不安排负重行走':'Avoid walking carries'):(locale==='zh'?'避免跳跃':'Avoid jumping')):item.kind==='caution_area'?(locale==='zh'?'注意部位已记住':'Caution area remembered'):(locale==='zh'?'器械已记住':'Equipment remembered')).join(' · ');
 return <MorphPanel open={open} onClose={onClose} triggerRef={props.triggerRef??fallbackTrigger} title={t.title} closeLabel={t.close}><div className="assistant-panel">
 <div className="assistant-toolbar"><CoachVisual state={busy?'thinking':'idle'}/><Button disabled={busy||applying} onClick={()=>select(fresh())}>{t.new}</Button><Button disabled={busy||applying} onClick={()=>setHistoryOpen(!historyOpen)}>{t.history}</Button></div>
 <div className="assistant-scroll">
 {privacy&&<p>{t.privacy}</p>}
 {historyOpen&&<ul className="assistant-history">{rows.map(row=><li key={row.id}><Button disabled={busy||applying} onClick={()=>select(row)}><span className="assistant-history-title">{row.title}</span><time dateTime={row.updatedAt}>{new Date(row.updatedAt).toLocaleString(locale)}</time></Button><Button disabled={busy||applying} aria-label={`${t.remove}: ${row.title}`} onClick={()=>void store.remove(row.id).then(async()=>{setRows(await store.list());if(row.id===chat.id)select(fresh());})}>{t.remove}</Button></li>)}</ul>}
 <div role="log" aria-label={t.title} aria-live="polite" className="assistant-messages">{chat.messages.map((message,index)=><div key={index} className={`assistant-bubble assistant-bubble--${message.role}`}><span className="assistant-speaker">{message.role==='user'?t.you:t.title}</span><p>{message.content}</p></div>)}<div ref={end}/></div>
 {retryMessage&&<p role="status">{locale==='zh'?'这次没能生成调整，点重试。':'No adjustment was generated this time. Tap to retry.'} <Button disabled={busy} onClick={()=>void send(retryMessage)}>{locale==='zh'?'重试':'Retry'}</Button></p>}
 {guide&&<details><summary>{exercises.find(e=>e.id===guide)?.name[locale]}</summary><ExerciseGuideContent id={guide} locale={locale}/></details>}
 {pending&&<p role="status">{t.pending}</p>}
 {candidate&&templates.length>0&&<section className="assistant-attachment"><AssistantAttachment candidate={candidate} locale={locale} minutes={props.templateMinutes}/>{canApply&&<Button disabled={busy||applying||saved} onClick={()=>{if(!candidate||applyLock.current)return;applyLock.current=true;setApplying(true);void onApply(candidate).then(async()=>{setSaved(true);if(props.rememberOnApply===false)return;const userMessage=chat.messages.filter(message=>message.role==='user').at(-1)?.content??'';const items=confirmedPreferenceChanges(candidate.request,candidate.response,userMessage);if(!items.length)return;try{const notes=await assistantPreferences.save(items,locale);if(notes.length){setRemembered({ids:notes.map(note=>note.id),items:notes.map(note=>({kind:note.kind!,value:note.value!}))});await props.onPreferencesChanged?.();}}catch{setError(t.storage);}}).catch(error=>setError(assistantApplyErrorCopy(error,locale))).finally(()=>{applyLock.current=false;setApplying(false);});}}>{saved?t.saved:props.applyLabel??t.apply}</Button>}{onlyToday&&candidate.request.task==='MODIFY_PLAN'&&!saved&&<Button disabled={busy||applying} onClick={()=>{setText(locale==='zh'?'只改今天这次训练，不改整体计划。请说明你想调整的动作和时长。':'Change only today’s workout, not the overall plan. Tell me which movements and duration to adjust.');setCandidate(undefined);setOnlyToday(false);}}>{locale==='zh'?'只改今天':'Only today'}</Button>}</section>}
 {remembered&&<p role="status" className="assistant-remembered">{locale==='zh'?'记住：':'Remembered: '}{rememberedText} <Button onClick={()=>void assistantPreferences.remove(remembered.ids).then(async()=>{setRemembered(undefined);await props.onPreferencesChanged?.()}).catch(()=>setError(t.storage))}>{locale==='zh'?'撤销':'Undo'}</Button></p>}
 <div className="assistant-consent">{request?.body&&<><label><input type="checkbox" checked={body} disabled={busy||applying} onChange={event=>{const fields=event.target.checked?Object.keys(request.body!):[];setBodyFields(fields);setConsent('body',event.target.checked,fields)}}/>{t.body}</label><fieldset><legend>{(locale==='zh'?coachZh:coachEn).body}</legend>{Object.entries(request.body).map(([key,value])=><label key={key}><input type="checkbox" disabled={busy||applying} checked={body&&(bodyFields===undefined||bodyFields.includes(key))} onChange={event=>{const current=body?(bodyFields??Object.keys(request.body!)):[];const next=event.target.checked?[...new Set([...current,key])]:current.filter(field=>field!==key);setBodyFields(next);setConsent('body',next.length>0,next);try{localStorage.setItem('fitness-assistant-body-consent','no')}catch{}}}/>{bodyLabels[key as keyof typeof bodyLabels]??key} · {String(value)}</label>)}<p>{(locale==='zh'?coachZh:coachEn).bodySource}</p></fieldset></>}{request?.history&&<label><input type="checkbox" checked={history} disabled={busy||applying} onChange={event=>setConsent('history',event.target.checked)}/>{t.historyOpt}</label>}</div>
 {nutritionEnabled&&<label><input type="checkbox" checked={diet} disabled={busy||applying} onChange={event=>{setDiet(event.target.checked);if(!event.target.checked)setDietWithdrawn(true);}}/>{lifestyleCopy[locale].dietConsent}</label>}<p className="assistant-summary">{t.summary}{contextSummary?` · ${contextSummary}`:''}{workoutContext?` · ${locale==='zh'?'本次已完成':'Completed this workout'} ${workoutContext.completedSets.length} ${locale==='zh'?'组':'sets'}`:''}{preferenceCount?` · ${locale==='zh'?`已记住的偏好 ${preferenceCount} 项`:`${preferenceCount} saved preferences`}`:''}{body?` · ${t.body}`:''}{history?` · ${t.historyOpt}`:''}</p>
 <details className="assistant-details"><summary>{t.details}</summary><dl><dt>{locale==='zh'?'你的消息':'Your message'}</dt><dd>{text.trim()}</dd><dt>{(locale==='zh'?coachZh:coachEn).fields.timeZone}</dt><dd>{displayTimeZone(request?.timeZone??Intl.DateTimeFormat().resolvedOptions().timeZone,locale)}</dd>{contextSummary&&<><dt>{locale==='zh'?'当前页面资料':'Current page context'}</dt><dd>{contextSummary}</dd></>}{body&&request?.body&&<><dt>{(locale==='zh'?coachZh:coachEn).fields.body}</dt><dd>{Object.keys(request.body).filter(key=>!bodyFields||bodyFields.includes(key)).length} {locale==='zh'?'项':'fields'}</dd></>}{body&&request?.body&&Object.entries(request.body).filter(([key])=>!bodyFields||bodyFields.includes(key)).map(([key,value])=><div key={key}><dt>{bodyLabels[key as keyof typeof bodyLabels]??key}</dt><dd>{String(value)}</dd></div>)}{history&&request?.history&&<><dt>{locale==='zh'?'训练历史':'Training history'}</dt><dd>{request.history.length} {locale==='zh'?'字':'characters'}</dd></>}</dl></details>
 </div><div className="assistant-input"><Composer value={text} onChange={setText} onSend={()=>void send()} label={t.input} sendLabel={t.send} busy={busy} disabled={busy||applying}/>{busy&&<Button onClick={()=>controller.current?.abort()}>{t.stop}</Button>}{error&&<p role="alert">{error}</p>}{(localReply||!request)&&<>{localReply&&<p role="status">{t.local}{props.unavailableReason&&` · ${props.unavailableReason}`}</p>}{props.onLocalReview&&<Button onClick={props.onLocalReview}>{(locale==='zh'?coachZh:coachEn).localReview}</Button>}{props.onLocalPlan&&<Button onClick={props.onLocalPlan}>{(locale==='zh'?coachZh:coachEn).localPlan}</Button>}</>}</div>
 </div></MorphPanel>;
}
