import type { LocalProfile } from '../domain/models';
import type { WorkoutRecord, LegacyWorkoutProjection } from '../domain/v8/contracts';
import { exercises } from '../catalog/exercises';
import { addDays, todayIn } from '../domain/local-date';

/** Local availability only. The consent layer removes both fields until selected. */
export function optionalCoachBody(profile:LocalProfile|undefined) {
 const details=profile?.bodyDetails;return details?.confirmedAt&&Object.keys(details.values).length?{...details.values}:undefined;
}

/** Last 28 local dates, completed facts only, no measurements, notes or identifiers. */
export function optionalCoachHistory(workouts:readonly (WorkoutRecord|LegacyWorkoutProjection)[],today:string,timeZone:string,locale:'zh'|'en') {
 const from=addDays(today,-27);
 const rows=[...new Map(workouts.map(w=>[w.id,w])).values()].filter(w=>['complete','partial','not_started'].includes(w.status)).sort((a,b)=>b.startedAt.localeCompare(a.startedAt));
 let result='';
 for(const record of rows){
  const date=todayIn(timeZone,record.startedAt);if(date<from||date>today)continue;
  const state=locale==='zh'?({complete:'完整',partial:'部分',not_started:'未开始'} as Record<string,string>)[record.status]:record.status;
  const line=`${date} · ${state}\n`+record.sets.map(s=>`${exercises.find(e=>e.id===s.exerciseId)?.name[locale]??s.exerciseId}: ${[s.reps!==undefined?`${s.reps} ${locale==='zh'?'次':'reps'}`:'',s.loadGrams!=null&&s.loadGrams>0?`${s.loadGrams/1000} ${locale==='zh'?'公斤':'kg'}`:'',s.durationSeconds!==undefined?`${s.durationSeconds} s`:'',s.distanceMeters!==undefined?`${s.distanceMeters} m`:''].filter(Boolean).join(', ')}`).join('\n')+'\n';
  if(new TextEncoder().encode(result+line).length>30000)break;
  result+=line;
 }
 return result||undefined;
}
