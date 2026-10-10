import { useEffect, useState } from 'react';
import { searchExercises } from '../../../catalog/catalog-service';
import { knownExerciseIds } from '../../../catalog/registry';
import { EQUIPMENT, equipmentLabel } from '../../../catalog/taxonomy';
import { Button, Chip } from '../../components/common';
import { ExerciseMedia } from '../../components/ExerciseMedia';
import { RepDBAttribution } from '../../components/RepDBAttribution';
import { useMainline } from '../../mainline/context';
import zh from '../../../i18n/features/plan/library.zh.json';
import en from '../../../i18n/features/plan/library.en.json';
const key='fitness-exercise-favorites-v1';
function read(){try{const v:unknown=JSON.parse(localStorage.getItem(key)??'[]');return Array.isArray(v)?v.filter((id):id is string=>typeof id==='string'&&knownExerciseIds.has(id)):[];}catch{return [];}}
export function ExercisesPage(){
 const c=useMainline(),t=c.locale==='zh'?zh:en;
 const [query,setQuery]=useState(''),[gear,setGear]=useState<typeof EQUIPMENT[number]>(),[favoriteOnly,setFavoriteOnly]=useState(false),[favorites,setFavorites]=useState(read),[limit,setLimit]=useState(24),[selected,setSelected]=useState<string>(),[error,setError]=useState('');
 useEffect(()=>{setLimit(24);},[query,gear,favoriteOnly]);
 useEffect(()=>{const change=()=>setFavorites(read());window.addEventListener('storage',change);return()=>window.removeEventListener('storage',change);},[]);
 const rows=searchExercises(query,c.locale,{equipment:gear}).filter(e=>!favoriteOnly||favorites.includes(e.id));
 return <main><Button onClick={()=>c.navigate('/plans')}>{c.t.back}</Button><h1>{t.title}</h1><RepDBAttribution/>
 <label>{t.search}<input type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label><label>{t.equipment}<select value={gear??''} onChange={e=>setGear(e.target.value as typeof gear||undefined)}><option value="">{t.all}</option>{EQUIPMENT.map(g=><option key={g} value={g}>{equipmentLabel(g,c.locale)}</option>)}</select></label>
 <label><input type="checkbox" checked={favoriteOnly} onChange={e=>setFavoriteOnly(e.target.checked)}/>{t.favorites}</label><p>{t.favoriteNote}</p>{error&&<p role="alert">{error}</p>}
 {rows.slice(0,limit).map(e=><section key={e.id}><div className="v8-row"><Chip selected={selected===e.id} onClick={()=>setSelected(selected===e.id?undefined:e.id)}>{e.name[c.locale]}</Chip><Chip selected={favorites.includes(e.id)} aria-label={`${t.favorite} ${e.name[c.locale]}`} onClick={()=>{const previous=read(),next=previous.includes(e.id)?previous.filter(id=>id!==e.id):[...previous,e.id];try{localStorage.setItem(key,JSON.stringify(next));setFavorites(next);setError('');}catch{setError(t.storageError);}}}>{t.favorite}</Chip></div>
 {selected===e.id&&<div className="v8-inline-panel"><ExerciseMedia exerciseId={e.id} exerciseName={e.name[c.locale]} locale={c.locale}/><ol>{e.steps[c.locale].map((s,i)=><li key={i}>{s}</li>)}</ol>{e.cautions[c.locale].length>0&&<><h2>{t.cautions}</h2><ul>{e.cautions[c.locale].map((s,i)=><li key={i}>{s}</li>)}</ul></>}</div>}</section>)}
 {rows.length>limit&&<Button onClick={()=>setLimit(limit+24)}>{t.more}</Button>}</main>;
}

