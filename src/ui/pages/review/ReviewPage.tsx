import { useState, type CSSProperties } from 'react';
import { Button,Stat,Sheet,Chip } from '../../components/common';
import { useMainline } from '../../mainline/context';
import { recurringDiscomfort, suggestChange } from '../../../application/review/suggest';
import { activityDate } from '../../../application/v8-activity';
import { createReviewService } from '../../../application/v8-review';
import { repository } from '../../../persistence/repository';
import { itemTarget } from '../plan/PlanPage';
import type { ReviewSuggestion } from '../../../application/review/contracts';
import zh from '../../../i18n/features/review/zh.json';
import en from '../../../i18n/features/review/en.json';
import activityZh from '../../../i18n/features/training/activity.zh.json';
import activityEn from '../../../i18n/features/training/activity.en.json';
export function ReviewPage(){
 const c=useMainline(),{data,t,name}=c,r=c.locale==='zh'?zh:en,activities=c.locale==='zh'?activityZh:activityEn;
 const [monthly,setMonthly]=useState(false),[dismissed,setDismissed]=useState<string[]>([]),[preview,setPreview]=useState<{suggestion:ReviewSuggestion;revision:number;generation:number}>(),[saved,setSaved]=useState(false);
 const facts=monthly?c.monthFacts:c.facts;
 const key=`fitness-v8-review-dismissed:${data?.metadata.localProfileId}:${data?.metadata.restoreGeneration??0}:${c.facts?.from}`;
 let stored:string[]=[];try{const value=JSON.parse(localStorage.getItem(key)??'[]');if(Array.isArray(value))stored=value.filter(v=>typeof v==='string');}catch{/* A storage error must not change a plan. */}
 const suggestionInput=data?.version&&c.facts&&c.previousFacts?{plan:data.version,current:c.facts,previous:c.previousFacts,workouts:data.workouts,dismissedIds:[...stored,...dismissed],profile:data.state?.coachProfile,todayLocalDate:activityDate(data.profile?.timeZone??'Asia/Shanghai'),completedWeeks:c.completedWeeks}:undefined;
 const suggestion=suggestionInput?suggestChange(suggestionInput):null;
 const discomfort=suggestionInput?recurringDiscomfort(suggestionInput):[];
 if(!facts)return null;
 return <main><div className="v8-row"><Chip selected={!monthly} onClick={()=>setMonthly(false)}>{r.week}</Chip><Chip selected={monthly} onClick={()=>setMonthly(true)}>{r.month}</Chip></div>
 <h1>{monthly?r.month:r.week}</h1><p>{facts.from} — {facts.to}</p>
 <div className="v8-facts"><Stat label={t.complete} value={facts.complete}/><Stat label={t.partial} value={facts.partial}/><Stat label={t.movement} value={facts.movementCount}/><Stat label={t.minutes} value={Math.round(facts.trainingSeconds/60)}/><Stat label={r.activityMinutes} value={facts.activityMinutes}/></div>
 {monthly&&c.monthFacts&&<section className="v8-month-chart" aria-label={r.month}>{c.monthFacts.weeks.map(w=><div key={w.from}><div className="v8-month-column" role="img" aria-label={`${w.from}: ${t.complete} ${w.complete}, ${t.partial} ${w.partial}`} style={{'--complete-ratio':w.complete/Math.max(7,...c.monthFacts!.weeks.map(x=>x.complete+x.partial)),'--partial-ratio':w.partial/Math.max(7,...c.monthFacts!.weeks.map(x=>x.complete+x.partial))} as CSSProperties}><span className="v8-month-complete"/><span className="v8-month-partial"/></div><p>{w.from.slice(5)}<br/>{w.complete} / {w.partial}</p></div>)}</section>}
 <section><h2>{r.patterns}</h2>{(['weekday','weekend'] as const).flatMap(day=>(['morning','daytime','evening'] as const).map(band=>{const n=facts.incompleteTiming[day][band];return n.partial+n.notStarted>0?<p key={day+band}>{r[day]} · {r[band]}: {n.partial+n.notStarted}</p>:null;}))}</section>
 {!facts.hasBodyWeight&&<p>{r.noWeight}</p>}{/减脂|体重|weight|fat/i.test(data?.version?.goalText??'')&&<p>{r.diet}</p>}
 {discomfort.length>0&&<p>{discomfort.map(name).join(' / ')} · {r.discomfort}</p>}
 {saved&&<p role="status">{r.versionSaved}</p>}
 {suggestion&&!preview&&<Sheet><h2>{r.suggestion}</h2><p>{r[suggestion.rule]}</p><div className="v8-row"><Button onClick={()=>setPreview({suggestion,revision:data!.metadata.dataRevision,generation:data!.metadata.restoreGeneration??0})}>{r.accept}</Button><Button onClick={()=>void c.run(async()=>{localStorage.setItem(key,JSON.stringify([...stored,suggestion.id]));setDismissed([...dismissed,suggestion.id]);})}>{r.dismiss}</Button></div></Sheet>}
 {preview&&<Sheet><h2>{r.preview}</h2><p>{r.weekTarget}: {preview.suggestion.proposal.weeklyTarget}</p>{preview.suggestion.proposal.templates.map(template=><section key={template.id}><h3>{template.name} · {template.estimatedMinutes}</h3>{template.items.map((i,index)=><p key={index}>{name(i.exerciseId)} · {itemTarget(i,c.locale)}</p>)}</section>)}<div className="v8-row"><Button variant="primary" disabled={c.busy} onClick={()=>void c.run(async()=>{await createReviewService(repository).adopt(preview.suggestion,preview.revision,preview.generation,r[preview.suggestion.rule]);setPreview(undefined);setSaved(true);})}>{r.accept}</Button><Button onClick={()=>setPreview(undefined)}>{r.cancel}</Button></div></Sheet>}
 <h2>{r.activity}</h2>{data?.activities.filter(a=>a.localDate>=facts.from&&a.localDate<=facts.to).map(a=><Sheet key={a.id}><p>{a.localDate} · {a.customName||activities.types[a.type]} · {a.minutes}</p>{a.note&&<p>{a.note}</p>}</Sheet>)}
 <h2>{t.history}</h2>{data?.workouts.filter(w=>!['in_progress','abandoned'].includes(w.status)&&w.localDate>=facts.from&&w.localDate<=facts.to).map(w=><Sheet key={w.id}><p>{w.localDate} · {w.sets.length} / {w.plannedSetCount} {t.sets}</p>{w.sets.map((s,i)=><p key={i}>{name(s.exerciseId)} · {s.reps??s.durationSeconds} {s.reps!==undefined?t.reps:t.seconds}</p>)}{w.feedback?.note&&<p>{w.feedback.note}</p>}</Sheet>)}<Button onClick={()=>c.navigate('/')}>{t.next}</Button></main>;
}
