import {useEffect,useRef,useState} from 'react';
import {exerciseFavorites} from '../../../application/exercise-favorites';
import type {ExerciseSearchFilters} from '../../../catalog/catalog-service';
import {ExerciseBrowser} from '../../components/ExerciseBrowser';
import {ExerciseGuidePanel} from '../../components/ExerciseGuide';
import {RepDBAttribution} from '../../components/RepDBAttribution';
import {Button,Chip} from '../../components/common';
import {useMainline} from '../../mainline/context';
import zh from '../../../i18n/features/plan/library.zh.json';
import en from '../../../i18n/features/plan/library.en.json';
export function ExercisesPage(){
 const c=useMainline(),t=c.locale==='zh'?zh:en;
 const[query,setQuery]=useState(''),[filters,setFilters]=useState<ExerciseSearchFilters>({}),[favoriteOnly,setFavoriteOnly]=useState(false),[favorites,setFavorites]=useState<string[]>([]),[selected,setSelected]=useState<string>(),[error,setError]=useState('');
 const triggerRef=useRef<HTMLElement|null>(null);
 useEffect(()=>{let alive=true;void exerciseFavorites.list().then(rows=>{if(alive)setFavorites(rows)}).catch(()=>{if(alive)setError(t.storageError)});return()=>{alive=false}},[c.data?.metadata.dataRevision,t.storageError]);
 function detail(id:string,trigger?:HTMLElement){triggerRef.current=trigger??document.activeElement as HTMLElement;setSelected(id)}
 return <main><Button onClick={()=>c.navigate('/plans')}>{c.t.back}</Button><h1>{t.title}</h1><RepDBAttribution/>
 <label><input type="checkbox" checked={favoriteOnly} onChange={e=>setFavoriteOnly(e.target.checked)}/>{t.favorites}</label><p>{t.favoriteNote}</p>{error&&<p role="alert">{error}</p>}
 <ExerciseBrowser locale={c.locale} query={query} setQuery={setQuery} filters={{...filters,allowedIds:favoriteOnly?favorites:undefined}} setFilters={setFilters} onSelect={id=>detail(id)} onDetail={detail} renderAction={id=><Chip selected={favorites.includes(id)} aria-label={`${t.favorite} ${c.name(id)}`} onClick={()=>{void exerciseFavorites.toggle(id).then(rows=>{setFavorites(rows);setError('')}).catch(()=>setError(t.storageError))}}>{t.favorite}</Chip>}/>
 <ExerciseGuidePanel id={selected} locale={c.locale} open={!!selected} onClose={()=>setSelected(undefined)} triggerRef={triggerRef}/>
 </main>;
}
