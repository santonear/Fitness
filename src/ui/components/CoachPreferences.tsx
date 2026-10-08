import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { coachReminderService } from '../../application/coach-reminders';
import type { CoachPreferences as Preferences } from '../../domain/coach-reminders';
export function CoachPreferences() {
  const {i18n}=useTranslation();const zh=i18n.resolvedLanguage==='zh';
  const [value,setValue]=useState<Preferences>();const [error,setError]=useState('');const [saved,setSaved]=useState(false);
  useEffect(()=>{void coachReminderService.preferences().then(v=>setValue(v.preferences)).catch(e=>setError(String(e)));},[]);
  const change=(patch:Partial<Preferences>)=>{setValue(v=>v&&({...v,...patch}));setSaved(false);};
  return <section className="coach-preferences"><h2>{zh?'芽芽 · 应用内提醒':'Coach · In-app reminders'}</h2><p>{zh?'仅在应用已打开且位于前台时提醒。关闭浏览器后不会发送通知。偏好保留在此设备，不随训练备份迁移。':'Reminders work only while this app is open in the foreground. No notifications when closed. These device preferences stay outside training backups.'}</p>{error&&<p role="alert">{error}</p>}{value&&<>
    <label><input type="checkbox" checked={value.enabled} onChange={e=>change({enabled:e.target.checked})}/>{zh?'启用应用内提醒':'Enable in-app reminders'}</label>
    <label>{zh?'每天最多':'Daily maximum'}<select value={value.dailyLimit} onChange={e=>change({dailyLimit:Number(e.target.value) as 0|1|2})}>{[0,1,2].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
    <label>{zh?'安静时段开始':'Quiet hours start'}<input type="time" value={value.quietStart} onChange={e=>change({quietStart:e.target.value})}/></label><label>{zh?'安静时段结束':'Quiet hours end'}<input type="time" value={value.quietEnd} onChange={e=>change({quietEnd:e.target.value})}/></label>
    <p>{zh?'固定提醒时区：':'Reminder time zone: '}{value.timeZone}</p><label>{zh?'助手停靠位置':'Coach dock side'}<select value={value.side} onChange={e=>change({side:e.target.value as 'left'|'right'})}><option value="left">{zh?'左侧':'Left'}</option><option value="right">{zh?'右侧':'Right'}</option></select></label>
    <button onClick={()=>void coachReminderService.preferences(value).then(()=>{setSaved(true);setError('');window.dispatchEvent(new Event('fitness:coach-preferences'));}).catch(e=>setError(String(e)))}>{zh?'保存提醒偏好':'Save reminder preferences'}</button>{saved&&<p role="status">{zh?'提醒偏好已保存':'Reminder preferences saved'}</p>}
  </>}</section>;
}
