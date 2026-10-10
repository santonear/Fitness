import { operationsCopy } from '../../i18n/features/settings/operations';
import { showSystemReminder } from '../../application/pwa';
import { backgroundPushEnabled, disableBackgroundPush } from '../../application/pwa-push';
import settingsZh from '../../i18n/features/settings/zh.json';
import settingsEn from '../../i18n/features/settings/en.json';
import { useEffect, useState } from 'react';
import { coachReminderService } from '../../application/coach-reminders';
import type { ReminderRecord } from '../../domain/coach-reminders';
import { Button } from './common';
export function V8Reminder({chatOpen,onStart,locale}:{chatOpen:boolean;onStart:()=>void;locale:'zh'|'en'}){
 const [warning,setWarning]=useState('');const [record,setRecord]=useState<ReminderRecord>();const copy=locale==='zh'?settingsZh:settingsEn;
 useEffect(()=>{let alive=true,busy=false;
  async function check(){if(busy)return;busy=true;try{
   const visible=document.visibilityState==='visible'&&document.hasFocus();
   const modal=Array.from(document.querySelectorAll('dialog[open],[role="dialog"]')).some(el=>(el as HTMLElement).getClientRects().length>0);
   const result=await coachReminderService.evaluate({now:Date.now(),foreground:visible,focused:document.hasFocus(),chat:chatOpen,modal,idleSince:Date.now()});
   if(alive&&result.record&&!backgroundPushEnabled())void showSystemReminder(result.record.id,locale);
   if(alive)setRecord(previous=>result.record??(!result.suppressed&&visible&&!chatOpen&&!modal&&result.ledger.records.some(r=>r.id===previous?.id&&r.status==='shown')?previous:undefined));
  }catch{if(alive)setRecord(undefined);}finally{busy=false;}}
  const tick=()=>void check();const interval=setInterval(tick,30000);tick();document.addEventListener('visibilitychange',tick);window.addEventListener('focus',tick);window.addEventListener('blur',tick);window.addEventListener('fitness:coach-preferences',tick);
  return()=>{alive=false;clearInterval(interval);document.removeEventListener('visibilitychange',tick);window.removeEventListener('focus',tick);window.removeEventListener('blur',tick);window.removeEventListener('fitness:coach-preferences',tick);};
 },[chatOpen]);
 async function act(action:'opened'|'snoozed'|'dismissed'){if(!record)return;if(action==='snoozed'&&backgroundPushEnabled())setWarning(await disableBackgroundPush()?operationsCopy[locale].snoozedBackground:operationsCopy[locale].pending);await coachReminderService.act(record.id,action);setRecord(undefined);if(action==='opened')onStart();}
 if(!record||chatOpen)return warning?<p role="status">{warning}</p>:null;
 return <aside aria-label={copy.reminder0}><p>{record.startTime} · {copy.reminder1}</p><Button onClick={()=>void act('opened')}>{copy.reminder2}</Button><Button onClick={()=>void act('snoozed')}>{copy.reminder3}</Button><Button onClick={()=>void act('dismissed')}>{copy.reminder4}</Button><Button onClick={()=>void coachReminderService.preferences().then(v=>coachReminderService.preferences({...v.preferences,enabled:false})).then(async()=>{setRecord(undefined);if(!await disableBackgroundPush())setWarning(operationsCopy[locale].pending);}).catch(()=>setWarning(operationsCopy[locale].failed))}>{copy.reminder5}</Button></aside>;
}
