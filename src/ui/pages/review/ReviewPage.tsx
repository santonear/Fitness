import {bodyProfileService} from '../../../application/body-profile';
import {bodyCopy} from '../../../i18n/features/onboarding/body';
import { trainingMinutes } from '../../../application/workout-duration';
import { countUsage } from '../../../application/monitoring-client';
import { lifestyleCopy } from '../../../i18n/features/settings/lifestyle';
import { useFeature } from '../../useFeature';
import { useEffect, useState } from 'react';
import { Button,Stat,Sheet,Toast } from '../../components/common';
import { ChoiceChip } from '../../components/kit';
import { ReviewChart } from './ReviewChart';
import { chartSeries, dayBuckets, weekBuckets, weeklyRemaining, PATTERN_MIN_COUNT, PATTERN_MIN_SESSIONS } from '../../../application/review/charts';
import { useMainline,format } from '../../mainline/context';
import { recurringDiscomfort, suggestChange } from '../../../application/review/suggest';
import { activityDate } from '../../../application/v8-activity';
import { createReviewService } from '../../../application/v8-review';
import { createV8DataService } from '../../../persistence/v8-access';
import { reviewHistory, historyInPeriod, type ReviewHistoryRow } from '../../../application/review/history';
import { repository } from '../../../persistence/repository';
import { itemTarget, templateLabel } from '../plan/PlanPage';
import type { ReviewSuggestion } from '../../../application/review/contracts';
import zh from '../../../i18n/features/review/zh.json';
import en from '../../../i18n/features/review/en.json';
import activityZh from '../../../i18n/features/training/activity.zh.json';
import activityEn from '../../../i18n/features/training/activity.en.json';
export function ReviewPage(){
 useEffect(()=>{countUsage('review_opened');},[]);
 const c=useMainline(),{data,t,name}=c,r=c.locale==='zh'?zh:en,activities=c.locale==='zh'?activityZh:activityEn;
 const nutritionEnabled=useFeature('nutrition'); const [dietDates,setDietDates]=useState<string[]>([]); useEffect(()=>{let active=true;void repository.db.nutritionRecords.toArray().then(rows=>{if(active)setDietDates(rows.map(row=>row.localDate));});return()=>{active=false;};},[data?.metadata.dataRevision]);
 const monthly=c.reviewKind==='month';
 const hasCurrentPlan=!!data?.plan&&!!data.version;
 const [dismissed,setDismissed]=useState<string[]>([]),[preview,setPreview]=useState<{suggestion:ReviewSuggestion;revision:number;generation:number}>(),[saved,setSaved]=useState(false);
 const [history,setHistory]=useState<ReviewHistoryRow[]>([]),[historyError,setHistoryError]=useState(false);
 useEffect(()=>{let active=true;setHistory([]);setHistoryError(false);const service=createV8DataService(repository);void Promise.all([service.getReviewWorkouts(),service.getLegacyHistory()]).then(([rows,legacy])=>{if(active)setHistory(reviewHistory(rows.workouts,rows.legacyWorkouts,legacy));}).catch(()=>{if(active)setHistoryError(true);});return()=>{active=false;};},[data?.metadata.dataRevision,data?.metadata.restoreGeneration,data?.metadata.localProfileId]);
 const facts=monthly?c.monthFacts:c.facts;
 const dietDays=facts&&nutritionEnabled?new Set(dietDates.filter(d=>d>=facts.from&&d<=facts.to)).size:0;
 const key=`fitness-v8-review-dismissed:${data?.metadata.localProfileId}:${data?.metadata.restoreGeneration??0}:${c.facts?.from}`;
 let stored:string[]=[];try{const value=JSON.parse(localStorage.getItem(key)??'[]');if(Array.isArray(value))stored=value.filter(v=>typeof v==='string');}catch{/* A storage error must not change a plan. */}
 const suggestionInput=data?.version&&c.facts&&c.previousFacts?{timeZone:data.profile?.timeZone,plan:data.version,current:c.facts,previous:c.previousFacts,workouts:data.workouts,dismissedIds:[...stored,...dismissed],profile:data.state?.coachProfile,todayLocalDate:activityDate(data.profile?.timeZone??'Asia/Shanghai'),completedWeeks:c.completedWeeks}:undefined;
 const suggestion=suggestionInput?suggestChange(suggestionInput):null;
 const discomfort=suggestionInput?recurringDiscomfort(suggestionInput):[];
 const suggestionText=(value:ReviewSuggestion)=>value.rule==='time'?r.time.replace('20',String(value.proposal.templates.find(template=>template.name.match(/^\d+ min$/))!.estimatedMinutes)):r[value.rule];
 const bodyEnabled=useFeature('bodyProfile'),body=data?.profile?.bodyDetails;
 const weightDue=bodyEnabled&&!monthly&&body?.confirmedAt&&Date.now()-Date.parse(body.weightPromptAt??body.updatedAt)>=28*86400000;
 if(!facts)return null;
 // V9 #13: a partial session counts as done toward the weekly target; missingCount stays a coach-only fact.
 const target=data?.version?.weeklyTarget??0,week=weeklyRemaining(target,facts.complete,facts.partial);
 const progressText=!hasCurrentPlan?format(r.noPlanFacts,{complete:facts.complete,partial:facts.partial}):monthly?format(facts.partial?r.monthProgressPartial:r.monthProgress,{done:week.done,partial:facts.partial}):format(week.left===0?r.progressMet:facts.partial?r.progressPartial:r.progress,{target,done:week.done,partial:facts.partial,left:week.left});
 const timeZone=data?.profile?.timeZone??'Asia/Shanghai';
 const buckets=monthly?weekBuckets(facts.from,facts.to).map(bucket=>({...bucket,from:bucket.from<facts.from?facts.from:bucket.from,to:bucket.to>facts.to?facts.to:bucket.to})):dayBuckets(facts.from);
 const points=chartSeries(historyInPeriod(history,facts.from,facts.to,timeZone),buckets,timeZone);
 const chartLabels=monthly?points.map(point=>point.from.slice(5).replace('-','/')):r.weekdays;
 // Timing patterns need enough sessions and at least two occurrences in one slot; otherwise say nothing about patterns.
 const savedSessions=facts.complete+facts.partial+facts.notStarted;
 const patternLines=(['weekday','weekend'] as const).flatMap(day=>(['overnight','morning','daytime','evening'] as const).map(band=>{const n=facts.incompleteTiming[day][band]??{partial:0,notStarted:0};return n.partial+n.notStarted>=PATTERN_MIN_COUNT?<p key={day+band}>{format(r.pattern,{day:r[day],band:r[band],count:n.partial+n.notStarted})}</p>:null;})).filter(Boolean);
 return <main className="rv-page"><div className="v8-row"><ChoiceChip selected={!monthly} onClick={()=>c.setReviewKind('week')}>{r.week}</ChoiceChip><ChoiceChip selected={monthly} onClick={()=>c.setReviewKind('month')}>{r.month}</ChoiceChip></div>
 <h1>{monthly?r.month:r.week}</h1><p>{facts.from} — {facts.to}</p>
 <c.slots.FeatureCard context="review" motionReduced={false} trainingActive={!!data?.active}>
 <p>{format(monthly?r.monthOpening:r.weekOpening,{count:facts.movementCount})}</p><p>{r.encouragement}</p>
 <p>{progressText}</p>
 <p>{!hasCurrentPlan?r.noPlanNext:suggestion?suggestionText(suggestion):r.continuePlan}</p>
 {!hasCurrentPlan&&<div className="v8-row"><Button onClick={()=>c.navigate('/manual')}>{r.manualTraining}</Button><Button onClick={c.restartPlanning}>{r.newPlan}</Button></div>}
 <div className="v8-facts"><Stat label={t.complete} value={facts.complete}/><Stat label={t.partial} value={facts.partial}/><Stat label={t.movement} value={facts.movementCount}/><Stat label={t.minutes} value={trainingMinutes(facts.trainingSeconds)}/><Stat label={r.activityMinutes} value={facts.activityMinutes}/></div></c.slots.FeatureCard>
 <ReviewChart key={monthly?'month':'week'} title={monthly?r.chartMonth:r.chartWeek} points={points} labels={chartLabels} copy={r}/>
 {savedSessions<PATTERN_MIN_SESSIONS?<section className="rv-patterns"><h2>{r.patterns}</h2><p>{format(r.patternsLater,{count:PATTERN_MIN_SESSIONS})}</p></section>:patternLines.length>0&&<section className="rv-patterns"><h2>{r.patterns}</h2>{patternLines}</section>}
 {!facts.hasBodyWeight&&<p>{r.noWeight}</p>}{!dietDays&&/减脂|体重|weight|fat/i.test(data?.version?.goalText??'')&&<p>{r.diet}</p>}
 {discomfort.length>0&&<p>{discomfort.map(name).join(' / ')} · {r.discomfort}</p>}
 <Toast message={saved?r.versionSaved:null} onDismiss={()=>setSaved(false)}/>
 {suggestion&&!preview&&<Sheet><h2>{r.suggestion}</h2><p>{suggestionText(suggestion)}</p><div className="v8-row"><Button onClick={()=>setPreview({suggestion,revision:data!.metadata.dataRevision,generation:data!.metadata.restoreGeneration??0})}>{r.accept}</Button><Button onClick={()=>void c.run(async()=>{localStorage.setItem(key,JSON.stringify([...stored,suggestion.id]));setDismissed([...dismissed,suggestion.id]);})}>{r.dismiss}</Button></div></Sheet>}
 {preview&&<Sheet><h2>{r.preview}</h2><p>{r.weekTarget}: {preview.suggestion.proposal.weeklyTarget}</p>{preview.suggestion.proposal.templates.map(template=><section key={template.id}><h3>{templateLabel(template,c.locale)} · {template.estimatedMinutes}</h3>{template.items.map((i,index)=><p key={index}>{name(i.exerciseId)} · {itemTarget(i,c.locale)}</p>)}</section>)}<div className="v8-row"><Button variant="primary" disabled={c.busy} onClick={()=>void c.run(async()=>{await createReviewService(repository).adopt(preview.suggestion,preview.revision,preview.generation,suggestionText(preview.suggestion));setPreview(undefined);setSaved(true);})}>{r.accept}</Button><Button onClick={()=>setPreview(undefined)}>{r.cancel}</Button></div></Sheet>}
 {dietDays>0&&<p>{lifestyleCopy[c.locale].dietBoundary.replace('{days}',String(dietDays))}</p>}
 <h2>{r.activity}</h2>{data?.activities.filter(a=>a.localDate>=facts.from&&a.localDate<=facts.to).map(a=><Sheet key={a.id}><p>{a.localDate} · {a.customName||activities.types[a.type]} · {a.minutes} {c.locale==='zh'?'分钟':'min'}</p>{a.note&&<p>{a.note}</p>}</Sheet>)}
 <h2>{t.history}</h2>{historyError&&<p role="alert">{r.historyError}</p>}{historyInPeriod(history,facts.from,facts.to,data?.profile?.timeZone??'Asia/Shanghai').map(w=><Sheet key={w.id}><p>{w.localDate} · {w.sets.length} / {w.plannedSetCount} {t.sets}</p>{w.sets.map((s,i)=><p key={i}>{name(s.exerciseId)} · {[s.reps!==undefined?`${s.reps} ${t.reps}`:undefined,s.loadGrams!=null?`${s.loadGrams/1000} ${t.kg}`:undefined,s.durationSeconds!==undefined?`${s.durationSeconds} ${t.seconds}`:undefined,s.distanceMeters!==undefined?`${s.distanceMeters} ${r.meters}`:undefined].filter(Boolean).join(' · ')}{w.setNotes?.[i]&&<> · {w.setNotes[i]}</>}</p>)}{w.feedback?.note&&<p>{w.feedback.note}</p>}{w.originalNotes&&<p>{w.originalNotes}</p>}{w.appendedNotes?.map((note,i)=><p key={i}>{note.text}</p>)}</Sheet>)}{weightDue&&<aside><Button onClick={()=>{void c.run(async()=>{await bodyProfileService.dismissWeightPrompt();c.navigate('/settings/body')})}}>{bodyCopy[c.locale].review}</Button><Button onClick={()=>void c.run(async()=>{await bodyProfileService.dismissWeightPrompt()})}>{bodyCopy[c.locale].ignore}</Button></aside>}<Button onClick={()=>c.navigate('/')}>{t.next}</Button></main>;
}
