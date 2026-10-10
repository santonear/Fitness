import { useEffect, useState } from 'react';
import { useFeature } from '../../useFeature';
import { Button } from '../../components/common';
import { operationsCopy } from '../../../i18n/features/settings/operations';
import { requestSystemNotifications, setSystemNotificationsEnabled } from '../../../application/pwa';
import { backgroundPushConfig, backgroundPushEnabled, disableBackgroundPush, enableBackgroundPush } from '../../../application/pwa-push';
import { coachReminderService } from '../../../application/coach-reminders';
import type { CoachPreferences } from '../../../domain/coach-reminders';
export function SystemNotifications({locale}:{locale:'zh'|'en'}) {
 const t=operationsCopy[locale], offline=useFeature('pwaOffline'), enabled=useFeature('systemNotifications');
 const [pendingRemoval,setPendingRemoval]=useState(false);
 const [message,setMessage]=useState(''),[publicKey,setPublicKey]=useState<string>(),[schedule,setSchedule]=useState<CoachPreferences>(),[subscribed,setSubscribed]=useState(backgroundPushEnabled);
 useEffect(()=>{let alive=true;const refresh=()=>{void coachReminderService.preferences().then(value=>{if(alive)setSchedule(value.preferences);});setSubscribed(backgroundPushEnabled());};refresh();void backgroundPushConfig().then(config=>{if(alive)setPublicKey(config.enabled?config.publicKey:undefined);}).catch(()=>{});window.addEventListener('fitness:coach-preferences',refresh);return()=>{alive=false;window.removeEventListener('fitness:coach-preferences',refresh);};},[enabled]);
 async function disable(all:boolean){if(all)setSystemNotificationsEnabled(false);setPendingRemoval(true);try{const done=await disableBackgroundPush();setSubscribed(backgroundPushEnabled());setPendingRemoval(!done);setMessage(done?t.disabled:t.pending);}catch{setSubscribed(backgroundPushEnabled());setMessage(t.pending);}}
 if(!offline&&!subscribed&&!pendingRemoval)return null;
 return <section><h2>{t.title}</h2>{offline&&<p>{t.offline}</p>}{enabled&&<><p>{t.ios}</p><Button onClick={()=>void requestSystemNotifications().then(status=>setMessage(status==='granted'?t.granted:status==='denied'?t.denied:status==='home-screen-required'?t.ios:t.unavailable)).catch(()=>setMessage(t.failed))}>{t.allow}</Button></>}
 {(enabled||subscribed||pendingRemoval)&&<Button onClick={()=>void disable(true)}>{t.disable}</Button>}
 {enabled&&publicKey&&<><p>{t.hint}</p><p>{t.choose}</p><Button disabled={!schedule?.enabled||!schedule.time||!schedule.weekdays?.length} onClick={()=>{if(!schedule?.time||!schedule.weekdays)return;void enableBackgroundPush({weekdays:schedule.weekdays,time:schedule.time,timeZone:schedule.timeZone,quietStart:schedule.quietStart,quietEnd:schedule.quietEnd,dailyLimit:schedule.dailyLimit},publicKey).then(()=>{setSubscribed(true);setMessage(t.enabled);}).catch(()=>setMessage(t.failed));}}>{t.background}</Button></>}
 {subscribed&&<Button onClick={()=>void disable(false)}>{t.stopBackground}</Button>}
 <p role="status">{message}</p></section>;
}
