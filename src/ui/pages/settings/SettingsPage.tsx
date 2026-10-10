import { Button } from '../../components/common';
import { useMainline } from '../../mainline/context';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BackupPanel } from '../../components/BackupPanel';
import { ReminderSettings } from './ReminderSettings';
export function SettingsPage(){const{t,navigate,locale}=useMainline();const location=useLocation();const[section,setSection]=useState(location.hash==='#reminders'?'reminders':'');const zh=locale==='zh';return <main><h1>{t.settings}</h1><Button onClick={()=>navigate('/settings/appearance')}>{t.appearance}</Button>
 <Button onClick={()=>setSection(section==='reminders'?'':'reminders')}>{zh?'提醒':'Reminders'}</Button>
 <Button onClick={()=>setSection(section==='backup'?'':'backup')}>{zh?'备份恢复':'Backup and restore'}</Button>
 <Button onClick={()=>setSection(section==='privacy'?'':'privacy')}>{zh?'芽芽会看到什么':'What Yaya can see'}</Button>
 <Button onClick={()=>navigate('/onboarding')}>{zh?'重新制定计划':'Create a new plan'}</Button>
 {section==='reminders'&&<ReminderSettings locale={locale}/>}{section==='backup'&&<BackupPanel/>}
 {section==='privacy'&&<section><h2>{zh?'芽芽会看到什么':'What Yaya can see'}</h2><p>{zh?'发送前可以展开查看实际内容。点击发送即同意发送列出的内容。身体资料和训练历史默认不发送，需要你单独选择。芽芽只提出建议，经你确认后才保存。':'Expand the details before sending. Selecting Send consents to sharing the listed information. Body details and training history are excluded unless you select them separately. Yaya proposes changes; they are saved only after you confirm.'}</p></section>}
 <Button onClick={()=>navigate('/')}>{t.back}</Button></main>;}
