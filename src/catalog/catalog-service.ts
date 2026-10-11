import { catalogMetadata } from './registry';
import { DomainError } from '../domain/errors';
import type { CatalogFilters, Exercise, Locale } from '../domain/models';
import { exercises } from './exercises';
import {getExerciseTags,type ExerciseSearchFilters} from './exercise-guide';
export type { ExerciseSearchFilters } from './exercise-guide';
function normalize(value:string){return value.toLowerCase().replace(/[\s\-_]/g,'');}
function distance(a:string,b:string):number {let previous=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const row=[i];for(let j=1;j<=b.length;j++)row[j]=Math.min(row[j-1]+1,previous[j]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1));previous=row;}return previous[b.length];}
function score(e:Exercise,query:string):number {if(!query)return 1;const names=[e.name.zh,e.name.en,...(catalogMetadata.get(e.id)?.aliases??[])].map(normalize);if(names.includes(query))return 100;if(names.some(n=>n.includes(query)))return 80;const best=Math.min(...names.map(n=>distance(n,query)));return best<=Math.max(1,Math.floor(query.length/5))?50-best:0;}
const any=(selected:string[]|undefined,available:string[])=>!selected?.length||selected.some(v=>available.includes(v));
export function searchExercises(query:string,filters?:ExerciseSearchFilters):Exercise[];
export function searchExercises(query:string,locale:Locale,filters:CatalogFilters):Exercise[];
export function searchExercises(query:string,localeOrFilters:Locale|ExerciseSearchFilters={},legacy:CatalogFilters={}):Exercise[]{
 const filters=typeof localeOrFilters==='string'?{}:localeOrFilters;
 return exercises.map(e=>({e,t:getExerciseTags(e.id),score:score(e,normalize(query))})).filter(({e,t,score})=>score>0&&(!legacy.category||e.category===legacy.category)&&(!legacy.equipment||e.equipment===legacy.equipment)&&(!legacy.metricType||e.metricType===legacy.metricType)&&any(filters.places??(filters.place?[filters.place]:undefined),t.places)&&any(filters.goals??(filters.goal?[filters.goal]:undefined),t.goals)&&any(filters.bodyParts,t.bodyParts)&&any(filters.equipment?.map(v=>v==='yoga-mat'?'none':v),t.equipment)).sort((a,b)=>{
 const aliases:Record<string,string>={knee:'knees',shoulder:'shoulders',wrist:'wrists',elbow:'elbows',hip:'hips',ankle:'ankles'};
 const caution=(t:typeof a.t)=>filters.cautionAreas?.filter(c=>t.cautionAreas.includes(aliases[c]??c)).length??0;
 return b.score-a.score||caution(a.t)-caution(b.t);
 }).map(({e})=>structuredClone(e));
}
export function suggestExercises(query:string,filters?:ExerciseSearchFilters):Exercise[]{const exact=searchExercises(query,filters);if(exact.length)return exact.slice(0,5);const needle=normalize(query);if(!needle)return [];return searchExercises('',filters).map(e=>({e,d:Math.min(distance(normalize(e.name.zh),needle),distance(normalize(e.name.en),needle))})).filter(x=>x.d<=Math.max(2,Math.floor(needle.length/3))).sort((a,b)=>a.d-b.d).slice(0,5).map(x=>x.e);}
export function getExercise(id:string):Exercise {const e=exercises.find(e=>e.id===id);if(!e)throw new DomainError('INVALID','Unknown exercise ID');return structuredClone(e);}
