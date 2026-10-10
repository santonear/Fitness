import { themes } from '../../../themes/registry';
import { Button,Chip } from '../../components/common';
import { useMainline } from '../../mainline/context';
export function AppearancePage(){const{t,locale,appearance,navigate}=useMainline();return <main><h1>{t.appearance}</h1><div className="v8-capsules">{themes.map(theme=><Chip key={theme.id} selected={theme.id===appearance.theme} onClick={()=>appearance.change(theme.id as typeof appearance.theme)}>{theme.name[locale]}</Chip>)}</div><Button onClick={()=>navigate('/settings')}>{t.back}</Button></main>;}

