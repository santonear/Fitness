import settingsZh from '../../../i18n/features/settings/zh.json';
import settingsEn from '../../../i18n/features/settings/en.json';
import { themes } from '../../../themes/registry';
import { Button,Chip } from '../../components/common';
import { useMainline } from '../../mainline/context';
import { useState } from 'react';
export function AppearancePage(){const{t,locale,appearance,navigate}=useMainline();const copy=locale==='zh'?settingsZh:settingsEn;const[more,setMore]=useState(false);return <main><h1>{t.appearance}</h1><div className="v8-capsules">{themes.map(theme=><Chip key={theme.id} selected={theme.id===appearance.theme} onClick={()=>appearance.change(theme.id as typeof appearance.theme)}>{theme.name[locale]}</Chip>)}</div><Button onClick={()=>setMore(!more)}>{copy.appearancePage0}</Button>{more&&<p role="status">{copy.appearancePage1}</p>}<Button onClick={()=>navigate('/settings')}>{t.back}</Button></main>;}

