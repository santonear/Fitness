import { validV4Answer, type Answer } from '../domain/onboarding-v4';
import type { LocalProfile } from '../domain/models';
import type { WorkoutRecord, LegacyWorkoutProjection } from '../domain/v8/contracts';
import { exercises } from '../catalog/exercises';

/** Local availability only. The consent layer removes both fields until selected. */
export function optionalCoachBody(profile:LocalProfile|undefined,answers:Record<string,Answer>={}) {
 const body:Record<string,string|number>={};
 for(const key of ['biologicalSex','age','heightCm','weightKg','waistCm']){
  const answer=answers[key];if(answer?.status==='answered'&&validV4Answer(key,answer)&&!Array.isArray(answer.value))body[key]=answer.value;
 }
 const preferences=profile?.trainingPreferences;
 if(preferences?.heightCm!==undefined)body.heightCm=preferences.heightCm;
 if(preferences?.weightGrams!==undefined)body.weightKg=preferences.weightGrams/1000;
 return Object.keys(body).length?body:undefined;
}

/** Last 28 local dates, completed facts only, no measurements, notes or identifiers. */
export function optionalCoachHistory(workouts:readonly (WorkoutRecord|LegacyWorkoutProjection)[],today:string,timeZone:string,locale:'zh'|'en') {
 const from=new Date(Date.parse(today+'T00:00:00Z')-27*86400000).toISOString().slice(0,10);
 const rows=[...new Map(workouts.map(w=>[w.id,w])).values()].filter(w=>['complete','partial','not_started'].includes(w.status)).sort((a,b)=>b.startedAt.localeCompare(a.startedAt));
 let result='';
 for(const record of rows){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(record.startedAt));
  const date=['year','month','day'].map(k=>parts.find(p=>p.type===k)!.value).join('-');if(date<from||date>today)continue;
  const state=locale==='zh'?({complete:'完整',partial:'部分',not_started:'未开始'} as Record<string,string>)[record.status]:record.status;
  const line=`${date} · ${state}\n`+record.sets.map(s=>`${exercises.find(e=>e.id===s.exerciseId)?.name[locale]??s.exerciseId}: ${[s.reps!==undefined?`${s.reps} ${locale==='zh'?'次':'reps'}`:'',s.loadGrams!=null?`${s.loadGrams/1000} kg`:'',s.durationSeconds!==undefined?`${s.durationSeconds} s`:'',s.distanceMeters!==undefined?`${s.distanceMeters} m`:''].filter(Boolean).join(', ')}`).join('\n')+'\n';
  if(new TextEncoder().encode(result+line).length>30000)break;
  result+=line;
 }
 return result||undefined;
}
