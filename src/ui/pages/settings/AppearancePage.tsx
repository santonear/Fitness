import { themes } from '../../../themes/registry';
import { Button,Chip } from '../../components/common';
import { useMainline } from '../../mainline/context';
import { useState } from 'react';
export function AppearancePage(){const{t,locale,appearance,navigate}=useMainline();const[more,setMore]=useState(false);return <main><h1>{t.appearance}</h1><div className="v8-capsules">{themes.map(theme=><Chip key={theme.id} selected={theme.id===appearance.theme} onClick={()=>appearance.change(theme.id as typeof appearance.theme)}>{theme.name[locale]}</Chip>)}</div><Button onClick={()=>setMore(!more)}>{locale==='zh'?'更多模板':'More themes'}</Button>{more&&<p role="status">{locale==='zh'?'新模板正在酝酿':'New themes are on the way'}</p>}<Button onClick={()=>navigate('/settings')}>{t.back}</Button></main>;}

