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
export function SettingsPage(){const{t,navigate,locale,run,busy}=useMainline();const location=useLocation();const[section,setSection]=useState(location.hash==='#reminders'?'reminders':'');const copy=locale==='zh'?settingsZh:settingsEn;
 useEffect(()=>{void i18n.changeLanguage(locale);},[locale]);
 return <main><h1>{t.settings}</h1><label>{copy.language}<select value={locale} disabled={busy} onChange={event=>{const next=event.target.value==='en'?'en':'zh';void run(async()=>{await profileService.setLocale(next);await i18n.changeLanguage(next);});}}><option value="zh">{copy.chinese}</option><option value="en">{copy.english}</option></select></label><Button onClick={()=>navigate('/settings/appearance')}>{t.appearance}</Button>
 <Button onClick={()=>setSection(section==='reminders'?'':'reminders')}>{copy.settingsPage0}</Button>
 <Button onClick={()=>setSection(section==='backup'?'':'backup')}>{copy.settingsPage1}</Button>
 <Button onClick={()=>setSection(section==='privacy'?'':'privacy')}>{copy.settingsPage2}</Button>
 <Button onClick={()=>navigate('/onboarding')}>{copy.settingsPage3}</Button>
 {section==='reminders'&&<ReminderSettings locale={locale}/>}{section==='backup'&&<BackupPanel/>}
 {section==='privacy'&&<section><h2>{copy.settingsPage4}</h2><p>{copy.settingsPage5}</p></section>}
 <Button onClick={()=>navigate('/')}>{t.back}</Button></main>;}
