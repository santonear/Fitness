import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { coachReminderService } from '../../application/coach-reminders';
import {scheduledInstant,zonedMinute} from '../../domain/coach-reminders';
import type { ReminderRecord } from '../../domain/coach-reminders';
import {liveQuery} from 'dexie';
import {repository} from '../../persistence/repository';
export function CoachNudge({chatOpen,onOpen}:{chatOpen:boolean;onOpen:()=>void}){
  const {i18n}=useTranslation(),navigate=useNavigate();const zh=i18n.resolvedLanguage==='zh';
  const [record,setRecord]=useState<ReminderRecord>();const idle=useRef(Date.now());const busy=useRef(false);
  useEffect(()=>{
    let live=true;
    const activity=()=>{idle.current=Date.now();};
    const check=async()=>{
      if(busy.current)return;busy.current=true;
      const visible=document.visibilityState==='visible',focused=document.hasFocus();
      const modal=Array.from(document.querySelectorAll('dialog[open],[role="dialog"],[aria-modal="true"]')).some(node=>(node as HTMLElement).getClientRects().length>0);
      if(chatOpen||!visible||!focused||modal)setRecord(undefined);
      try {const value=await coachReminderService.evaluate({now:Date.now(),foreground:visible,focused,chat:chatOpen,modal,idleSince:idle.current});if(live)setRecord(previous=>value.record??(!value.suppressed&&value.ledger.preferences.enabled&&!chatOpen&&visible&&focused&&!modal&&value.ledger.records.some(r=>r.id===previous?.id&&r.status==='shown')?previous:undefined));}catch{if(live)setRecord(undefined);}finally{busy.current=false;}
    };
    const visible=()=>{activity();void check();};
    const timer=setInterval(()=>void check(),30000);void check();
    const sourceChanges=liveQuery(async()=>Promise.all([repository.db.plans.toArray(),repository.db.scheduledWorkouts.toArray(),repository.db.sessions.toArray(),repository.db.guidedStates.toArray(),repository.db.metadata.toArray()])).subscribe({next:()=>void check(),error:()=>setRecord(undefined)});
    const deviceChanges=liveQuery(()=>repository.db.coachDevice.toArray()).subscribe({next:ledgers=>setRecord(previous=>previous&&ledgers.some(l=>l.preferences.enabled&&l.preferences.dailyLimit>0&&l.records.some(r=>r.id===previous.id&&r.status==='shown'))?previous:undefined),error:()=>setRecord(undefined)});
    document.addEventListener('pointerdown',activity);document.addEventListener('keydown',activity);document.addEventListener('visibilitychange',visible);window.addEventListener('focus',visible);window.addEventListener('blur',visible);window.addEventListener('fitness:coach-preferences',visible);
    return()=>{live=false;sourceChanges.unsubscribe();deviceChanges.unsubscribe();clearInterval(timer);document.removeEventListener('pointerdown',activity);document.removeEventListener('keydown',activity);document.removeEventListener('visibilitychange',visible);window.removeEventListener('focus',visible);window.removeEventListener('blur',visible);window.removeEventListener('fitness:coach-preferences',visible);};
  },[chatOpen]);
  const act=async(action:'opened'|'dismissed'|'snoozed')=>{if(!record)return;try{await coachReminderService.act(record.id,action);}catch{setRecord(undefined);return;}setRecord(undefined);if(action==='opened'){if(record.kind==='workout'){const profile=await repository.db.profiles.toCollection().first();const at=record.startTime?scheduledInstant(record.date,record.startTime,record.timeZone):null;const day=profile&&at!==null?zonedMinute(at,profile.timeZone).day:record.date;navigate('/plans?date='+encodeURIComponent(day));}else onOpen();}};
  if(!record||chatOpen)return null;
  return <aside className="coach-nudge" aria-label={zh?'训练提醒':'Training reminder'} onKeyDown={e=>{if(e.key==='Escape')void act('dismissed');}}><p role="status">{record.kind==='workout'?`${record.name} · ${record.startTime} (${record.timeZone})`:record.kind==='completion'?(zh?'这次训练已记录，按自己的节奏继续就好。':'This workout is recorded. Keep going at your own pace.'):(zh?'需要我帮你一起看看下一次安排吗？':'Would you like to review your next training plan together?')}</p><div><button onClick={()=>void act('opened')}>{zh?'查看':'View'}</button><button onClick={()=>void act('snoozed')}>{zh?'4 小时后':'In 4 hours'}</button><button onClick={()=>void act('dismissed')}>{zh?'关闭本次':'Dismiss'}</button><button onClick={()=>void coachReminderService.preferences().then(v=>coachReminderService.preferences({...v.preferences,enabled:false})).then(()=>setRecord(undefined)).catch(()=>setRecord(undefined))}>{zh?'关闭全部提醒':'Turn off reminders'}</button></div></aside>;
}
