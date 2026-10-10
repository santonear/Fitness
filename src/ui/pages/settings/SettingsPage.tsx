import { anonymousUsageEnabled, setAnonymousUsage } from '../../../application/monitoring-client';
import { operationsCopy } from '../../../i18n/features/settings/operations';
import { SystemNotifications } from './SystemNotifications';
import { restVibrationKey } from '../training/useRestVibration';
import settingsZh from '../../../i18n/features/settings/zh.json';
import settingsEn from '../../../i18n/features/settings/en.json';
import { Button } from '../../components/common';
import { useMainline } from '../../mainline/context';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BackupPanel } from '../../components/BackupPanel';
import { ReminderSettings } from './ReminderSettings';
import { profileService } from '../../../application/profile';
import i18n from '../../../i18n';
import { lifestyleCopy } from '../../../i18n/features/settings/lifestyle';
import { useFeature } from '../../useFeature';
export function SettingsPage(){const{t,navigate,locale,run,busy}=useMainline();const location=useLocation();const[section,setSection]=useState(location.hash==='#reminders'?'reminders':'');const copy=locale==='zh'?settingsZh:settingsEn; const [vibration,setVibration]=useState(()=>{try{return localStorage.getItem(restVibrationKey)==='on';}catch{return false;}}); const analytics=useFeature('anonymousUsage'), errorReports=useFeature('errorReports'); const [optedIn,setOptedIn]=useState(anonymousUsageEnabled); const nutritionEnabled=useFeature('nutrition'), importEnabled=useFeature('activityImport'); const [hasNutrition,setHasNutrition]=useState(false); useEffect(()=>{void import('../../../persistence/repository').then(({repository})=>repository.db.nutritionRecords.count()).then(n=>setHasNutrition(n>0));},[]); const vibrationSupported=typeof navigator.vibrate==='function';
 useEffect(()=>{void i18n.changeLanguage(locale);},[locale]);
 return <main><h1>{t.settings}</h1><label>{copy.language}<select value={locale} disabled={busy} onChange={event=>{const next=event.target.value==='en'?'en':'zh';void run(async()=>{await profileService.setLocale(next);await i18n.changeLanguage(next);});}}><option value="zh">{copy.chinese}</option><option value="en">{copy.english}</option></select></label><Button onClick={()=>navigate('/settings/appearance')}>{t.appearance}</Button>
 <Button onClick={()=>setSection(section==='reminders'?'':'reminders')}>{copy.settingsPage0}</Button>
 <Button onClick={()=>setSection(section==='backup'?'':'backup')}>{copy.settingsPage1}</Button>
 <Button onClick={()=>setSection(section==='privacy'?'':'privacy')}>{copy.settingsPage2}</Button>
 {(nutritionEnabled||hasNutrition)&&<Button onClick={()=>navigate('/settings/nutrition')}>{lifestyleCopy[locale].nutrition}</Button>}{importEnabled&&<Button onClick={()=>navigate('/settings/import')}>{lifestyleCopy[locale].importActivity}</Button>}
 <Button onClick={()=>navigate('/trial')}>{copy.trial}</Button>
 <Button onClick={()=>navigate('/onboarding')}>{copy.settingsPage3}</Button>
 <label><input type="checkbox" checked={vibration} disabled={!vibrationSupported} onChange={event=>{const value=event.target.checked;try{localStorage.setItem(restVibrationKey,value?'on':'off');setVibration(value);}catch{/* Keep the saved preference unchanged. */}}}/>{copy.restVibration}</label>{!vibrationSupported&&<p>{copy.vibrationUnavailable}</p>}{section==='reminders'&&<ReminderSettings locale={locale}/>}{section==='backup'&&<BackupPanel/>}
 {section==='privacy'&&<section><h2>{copy.settingsPage4}</h2><p>{copy.settingsPage5}</p><p>{operationsCopy[locale].dietPrivacy}</p></section>}
 <SystemNotifications locale={locale}/>{analytics&&<label><input type="checkbox" checked={optedIn} onChange={e=>{try{setAnonymousUsage(e.target.checked);setOptedIn(e.target.checked);}catch{/* No opt-in when storage fails. */}}}/>{operationsCopy[locale].analytics}<p>{operationsCopy[locale].analyticsHint}</p></label>}{errorReports&&<p>{operationsCopy[locale].errorHint}</p>}<Button onClick={()=>navigate('/')}>{t.back}</Button></main>;}
