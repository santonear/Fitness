import { Button } from '../../components/common';
import { useMainline } from '../../mainline/context';
export function SettingsPage(){const{t,navigate}=useMainline();return <main><h1>{t.settings}</h1><Button onClick={()=>navigate('/settings/appearance')}>{t.appearance}</Button><Button onClick={()=>navigate('/')}>{t.back}</Button></main>;}
