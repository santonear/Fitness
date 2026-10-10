import settingsZh from '../../../i18n/features/settings/zh.json';
import settingsEn from '../../../i18n/features/settings/en.json';
import { Button } from '../../components/common';
import { useMainline } from '../../mainline/context';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BackupPanel } from '../../components/BackupPanel';
import { ReminderSettings } from './ReminderSettings';
export function SettingsPage(){const{t,navigate,locale}=useMainline();const location=useLocation();const[section,setSection]=useState(location.hash==='#reminders'?'reminders':'');const copy=locale==='zh'?settingsZh:settingsEn;return <main><h1>{t.settings}</h1><Button onClick={()=>navigate('/settings/appearance')}>{t.appearance}</Button>
 <Button onClick={()=>setSection(section==='reminders'?'':'reminders')}>{copy.settingsPage0}</Button>
 <Button onClick={()=>setSection(section==='backup'?'':'backup')}>{copy.settingsPage1}</Button>
 <Button onClick={()=>setSection(section==='privacy'?'':'privacy')}>{copy.settingsPage2}</Button>
 <Button onClick={()=>navigate('/onboarding')}>{copy.settingsPage3}</Button>
 {section==='reminders'&&<ReminderSettings locale={locale}/>}{section==='backup'&&<BackupPanel/>}
 {section==='privacy'&&<section><h2>{copy.settingsPage4}</h2><p>{copy.settingsPage5}</p></section>}
 <Button onClick={()=>navigate('/')}>{t.back}</Button></main>;}
