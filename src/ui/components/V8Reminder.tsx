import { useEffect, useState } from 'react';
import { coachReminderService } from '../../application/coach-reminders';
import type { ReminderRecord } from '../../domain/coach-reminders';
import { Button } from './common';
export function V8Reminder({chatOpen,onStart,locale}:{chatOpen:boolean;onStart:()=>void;locale:'zh'|'en'}){
 const [record,setRecord]=useState<ReminderRecord>();const zh=locale==='zh';
 useEffect(()=>{let alive=true,busy=false;
  async function check(){if(busy)return;busy=true;try{
   const visible=document.visibilityState==='visible'&&document.hasFocus();
   const modal=Array.from(document.querySelectorAll('dialog[open],[role="dialog"]')).some(el=>(el as HTMLElement).getClientRects().length>0);
   const result=await coachReminderService.evaluate({now:Date.now(),foreground:visible,focused:document.hasFocus(),chat:chatOpen,modal,idleSince:Date.now()});
   if(alive)setRecord(previous=>result.record??(!result.suppressed&&visible&&!chatOpen&&!modal&&result.ledger.records.some(r=>r.id===previous?.id&&r.status==='shown')?previous:undefined));
  }catch{if(alive)setRecord(undefined);}finally{busy=false;}}
  const tick=()=>void check();const interval=setInterval(tick,30000);tick();document.addEventListener('visibilitychange',tick);window.addEventListener('focus',tick);window.addEventListener('blur',tick);window.addEventListener('fitness:coach-preferences',tick);
  return()=>{alive=false;clearInterval(interval);document.removeEventListener('visibilitychange',tick);window.removeEventListener('focus',tick);window.removeEventListener('blur',tick);window.removeEventListener('fitness:coach-preferences',tick);};
 },[chatOpen]);
 async function act(action:'opened'|'snoozed'|'dismissed'){if(!record)return;await coachReminderService.act(record.id,action);setRecord(undefined);if(action==='opened')onStart();}
 if(!record||chatOpen)return null;
 return <aside aria-label={zh?'训练提醒':'Training reminder'}><p>{record.startTime} · {zh?'只是提醒，不代表那天必须练':'A reminder does not mean you have to train that day.'}</p><Button onClick={()=>void act('opened')}>{zh?'开始训练':'Start training'}</Button><Button onClick={()=>void act('snoozed')}>{zh?'4 小时后再说':'In 4 hours'}</Button><Button onClick={()=>void act('dismissed')}>{zh?'关闭本次':'Dismiss'}</Button><Button onClick={()=>void coachReminderService.preferences().then(v=>coachReminderService.preferences({...v.preferences,enabled:false})).then(()=>setRecord(undefined))}>{zh?'关闭全部提醒':'Turn off reminders'}</Button></aside>;
}
