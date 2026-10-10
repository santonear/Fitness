import { useState } from 'react';
import { exercises } from '../../../catalog/exercises';
import { Button } from '../../components/common';
import { useMainline } from '../../mainline/context';
export function ManualPage(){const {t,locale,start,busy}=useMainline();const[id,setId]=useState(exercises[0].id);return <main><h1>{t.manual}</h1><label>{t.choose}<select value={id} onChange={e=>setId(e.target.value)}>{exercises.map(e=><option key={e.id} value={e.id}>{e.name[locale]}</option>)}</select></label><p>{t.manualHint}</p><Button variant="primary" disabled={busy} onClick={()=>void start(undefined,id)}>{t.start}</Button></main>;}
