import { useEffect, useState } from 'react';
import { coachReminderService } from '../../../application/coach-reminders';
import type { CoachPreferences } from '../../../domain/coach-reminders';
import { Button, Toggle } from '../../components/common';
export function ReminderSettings({locale}:{locale:'zh'|'en'}){
 const zh=locale==='zh';const [value,setValue]=useState<CoachPreferences>(),[message,setMessage]=useState('');
 useEffect(()=>{void coachReminderService.preferences().then(v=>setValue(v.preferences)).catch(()=>setMessage(zh?'提醒设置暂时无法读取':'Unable to load reminder settings'));},[zh]);
 const change=(patch:Partial<CoachPreferences>)=>setValue(v=>v?{...v,...patch}:v);
 return <section id="reminders"><h2>{zh?'提醒':'Reminders'}</h2><p>{zh?'只是提醒，不代表那天必须练':'A reminder does not mean you have to train that day.'}</p><p>{zh?'仅在应用打开且在前台时出现，不发送系统推送。':'Shown only while the app is open in the foreground. No system notifications.'}</p>{value&&<>
  <Toggle checked={value.enabled} onCheckedChange={enabled=>change({enabled})}>{zh?'开启提醒':'Enable reminders'}</Toggle>
  <fieldset><legend>{zh?'星期':'Days'}</legend>{(zh?['一','二','三','四','五','六','日']:['Mon','Tue','Wed','Thu','Fri','Sat','Sun']).map((label,i)=><label key={i}><input type="checkbox" checked={value.weekdays?.includes(i+1)??false} onChange={e=>change({weekdays:e.target.checked?[...(value.weekdays??[]),i+1]:(value.weekdays??[]).filter(d=>d!==i+1)})}/>{label}</label>)}</fieldset>
  <label>{zh?'时间':'Time'}<input type="time" value={value.time??''} onChange={e=>change({time:e.target.value})}/></label><p>{value.timeZone}</p>
  <Button disabled={value.enabled&&(!value.time||!value.weekdays?.length)} onClick={()=>void coachReminderService.preferences(value).then(()=>{setMessage(zh?'已保存':'Saved');window.dispatchEvent(new Event('fitness:coach-preferences'));}).catch(()=>setMessage(zh?'保存未完成，请重试':'Could not save. Try again.'))}>{zh?'保存':'Save'}</Button></>}
  <p role="status">{message}</p></section>;
}
