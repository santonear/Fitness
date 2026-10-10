import settingsZh from '../../../i18n/features/settings/zh.json';
import settingsEn from '../../../i18n/features/settings/en.json';
import { useEffect, useState } from 'react';
import { coachReminderService } from '../../../application/coach-reminders';
import type { CoachPreferences } from '../../../domain/coach-reminders';
import { Button, Toggle } from '../../components/common';
export function ReminderSettings({locale}:{locale:'zh'|'en'}){
 const zh=locale==='zh';const copy=zh?settingsZh:settingsEn;const [value,setValue]=useState<CoachPreferences>(),[message,setMessage]=useState('');
 useEffect(()=>{void coachReminderService.preferences().then(v=>setValue(v.preferences)).catch(()=>setMessage(copy.reminderSettings0));},[zh]);
 const change=(patch:Partial<CoachPreferences>)=>setValue(v=>v?{...v,...patch}:v);
 return <section id="reminders"><h2>{copy.reminderSettings1}</h2><p>{copy.reminderSettings2}</p><p>{copy.reminderSettings3}</p>{value&&<>
  <Toggle checked={value.enabled} onCheckedChange={enabled=>change({enabled})}>{copy.reminderSettings4}</Toggle>
  <fieldset><legend>{copy.reminderSettings5}</legend>{copy.weekdays.map((label,i)=><label key={i}><input type="checkbox" checked={value.weekdays?.includes(i+1)??false} onChange={e=>change({weekdays:e.target.checked?[...(value.weekdays??[]),i+1]:(value.weekdays??[]).filter(d=>d!==i+1)})}/>{label}</label>)}</fieldset>
  <label>{copy.reminderSettings6}<input type="time" value={value.time??''} onChange={e=>change({time:e.target.value})}/></label><p>{value.timeZone}</p>
  <Button disabled={value.enabled&&(!value.time||!value.weekdays?.length)} onClick={()=>void coachReminderService.preferences(value).then(()=>{setMessage(copy.reminderSettings7);window.dispatchEvent(new Event('fitness:coach-preferences'));}).catch(()=>setMessage(copy.reminderSettings8))}>{copy.reminderSettings9}</Button></>}
  <p role="status">{message}</p></section>;
}
