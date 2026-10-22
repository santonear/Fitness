import {bodyProfileService} from '../../../application/body-profile';
import {bodyCopy} from '../../../i18n/features/onboarding/body';
import { trainingMinutes } from '../../../application/workout-duration';
import { countUsage } from '../../../application/monitoring-client';
import { lifestyleCopy } from '../../../i18n/features/settings/lifestyle';
import { useFeature } from '../../useFeature';
import { useEffect, useState, type CSSProperties } from 'react';
import { Button,Sheet,Toast } from '../../components/common';
import { AppIcon } from '../../components/AppIcon';
import { PrimaryButton, ProgressRing, SegmentedTabs, Yaya } from '../../components/kit';
import { BodyParts, FactTile, PatternProgress, TimingGrid, type TimingCell } from './ReviewVisuals';
import { activeBuckets, groupSets, regionShares, shortDate } from './visuals';
import { ReviewChart } from './ReviewChart';
import './review.css';
import { chartSeries, dayBuckets, weekBuckets, weeklyRemaining, weekStreak, PATTERN_MIN_COUNT, PATTERN_MIN_SESSIONS } from '../../../application/review/charts';
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
import { PageSwitches } from '../../components/PageSwitches';
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
 const timing:TimingCell[]=(['weekday','weekend'] as const).flatMap(day=>(['overnight','morning','daytime','evening'] as const).map(band=>{const n=facts.incompleteTiming[day][band]??{partial:0,notStarted:0};return {day,band,count:n.partial+n.notStarted};}));
 const patternLines=timing.filter(cell=>cell.count>=PATTERN_MIN_COUNT).map(cell=>format(r.pattern,{day:r[cell.day],band:r[cell.band],count:cell.count}));
 const periodRows=historyInPeriod(history,facts.from,facts.to,timeZone);
 const periodActivities=data?.activities.filter(a=>a.localDate>=facts.from&&a.localDate<=facts.to)??[];
 const empty=facts.movementCount===0&&savedSessions===0&&periodRows.length===0&&periodActivities.length===0;
 const today=activityDate(timeZone),streak=weekStreak(history,today,timeZone),active=activeBuckets(points);
 const shares=regionShares(periodRows.filter(row=>row.status==='complete'||row.status==='partial'));
 // Ring: week with a plan = sessions done vs weekly target; month = weeks with training; no plan = days with training.
 const ring=monthly?{value:points.length?active/points.length:0,center:`${active}/${points.length}`,caption:r.ringMonth}:hasCurrentPlan?{value:target>0?week.done/target:0,center:`${week.done}/${target}`,caption:r.ringWeek}:{value:active/7,center:`${active}/7`,caption:r.ringDays};
 const met=!monthly&&hasCurrentPlan&&target>0&&week.left===0;
 const setText=(s:ReviewHistoryRow['sets'][number])=>[s.reps!==undefined?`${s.reps} ${t.reps}`:undefined,s.loadGrams!=null?`${s.loadGrams/1000} ${t.kg}`:undefined,s.durationSeconds!==undefined?`${s.durationSeconds} ${t.seconds}`:undefined,s.distanceMeters!==undefined?`${s.distanceMeters} ${r.meters}`:undefined].filter(Boolean).join(' · ');
 const weightGoal=/减脂|体重|weight|fat/i.test(data?.version?.goalText??'');
 const notes=[discomfort.length>0&&{tone:'warn',text:`${discomfort.map(name).join(' / ')} · ${r.discomfort}`},!empty&&!facts.hasBodyWeight&&{tone:'info',text:r.noWeight},!dietDays&&weightGoal&&{tone:'info',text:r.diet},dietDays>0&&{tone:'info',text:lifestyleCopy[c.locale].dietBoundary.replace('{days}',String(dietDays))}].filter((note):note is {tone:string;text:string}=>!!note);
 const noPlanActions=!hasCurrentPlan&&<div className="rv-actions"><PrimaryButton tone="quiet" size="sm" onClick={()=>c.navigate('/manual')}>{r.manualTraining}</PrimaryButton><PrimaryButton tone="quiet" size="sm" onClick={c.restartPlanning}>{r.newPlan}</PrimaryButton></div>;
 return <main className="rv-page">
 <PageSwitches/>
 <header className="rv-head"><h1 className="rv-title">{monthly?r.month:r.week}</h1><p className="rv-range v9-num">{shortDate(facts.from)} – {shortDate(facts.to)}</p></header>
 <SegmentedTabs label={r.period} value={monthly?'month':'week'} onChange={value=>c.setReviewKind(value==='month'?'month':'week')} options={[{value:'week',label:r.weekTab},{value:'month',label:r.monthTab}]}/>
 <c.slots.FeatureCard context="review" motionReduced={false} trainingActive={!!data?.active}>
 {empty?<div className="rv-hero rv-empty">
  <Yaya pose="side" size={120} float={false} alt=""/>
  <p className="rv-empty-title">{r.chartEmpty}</p>
  <p className="rv-caption">{r.emptyHint}</p>
  {hasCurrentPlan?<PrimaryButton size="sm" onClick={()=>c.navigate('/')}>{t.next}</PrimaryButton>:noPlanActions}
 </div>:<div className="rv-hero">
  <div className="rv-hero-main">
   <ProgressRing value={ring.value} size={132} stroke={11} label={progressText}>
    <span className="rv-ring-value v9-num" aria-hidden="true">{ring.center}</span>
    <span className="rv-ring-caption" aria-hidden="true">{met?r.ringMet:ring.caption}</span>
   </ProgressRing>
   <dl className="rv-legend rv-facts">
    <div className="rv-legend-row" data-kind="complete"><dt><span className="rv-swatch" aria-hidden="true"/>{r.legendComplete}</dt><dd className="v9-num">{facts.complete}</dd></div>
    <div className="rv-legend-row" data-kind="partial"><dt><span className="rv-swatch" aria-hidden="true"/>{r.legendPartial}</dt><dd className="v9-num">{facts.partial}</dd></div>
   </dl>
  </div>
  {streak>=2&&<p className="rv-streak"><span className="rv-streak-icon" aria-hidden="true"><AppIcon name="flame" ceramic/></span><span>{format(r.streak,{count:streak})}</span></p>}
  <p className="rv-yaya-line"><Yaya pose="think" size={36} alt=""/><span>{r.encouragement}</span></p>
  {noPlanActions}
 </div>}
 </c.slots.FeatureCard>
 {!empty&&<dl className="rv-tiles rv-facts">
  <FactTile icon="run" label={r.tileMoves} value={facts.movementCount}/>
  <FactTile icon="clock" label={r.tileMinutes} value={trainingMinutes(facts.trainingSeconds)}/>
  <FactTile icon="leaf" label={r.tileActivity} value={facts.activityMinutes}/>
 </dl>}
 {!empty&&points.some(point=>point.sessions>0)&&<ReviewChart key={monthly?'month':'week'} title={monthly?r.chartMonth:r.chartWeek} points={points} labels={chartLabels} copy={r} current={today}/>}
 {shares.length>0&&<BodyParts title={r.bodyParts} unit={t.sets} shares={shares} locale={c.locale}/>}
 {!empty&&(savedSessions<PATTERN_MIN_SESSIONS?<PatternProgress title={r.patterns} saved={savedSessions} needed={PATTERN_MIN_SESSIONS} caption={format(r.patternsLater,{count:PATTERN_MIN_SESSIONS})}/>:patternLines.length>0&&<TimingGrid title={r.patterns} cells={timing} labels={r} description={patternLines.join(' ')}/>)}
 {notes.length>0&&<ul className="rv-notes">{notes.map(note=><li key={note.text} data-tone={note.tone}><AppIcon name={note.tone==='warn'?'warning':'info'}/><span>{note.text}</span></li>)}</ul>}
 <Toast message={saved?r.versionSaved:null} onDismiss={()=>setSaved(false)}/>
 {suggestion&&!preview&&<Sheet><h2>{r.suggestion}</h2><p>{suggestionText(suggestion)}</p><div className="v8-row"><Button onClick={()=>setPreview({suggestion,revision:data!.metadata.dataRevision,generation:data!.metadata.restoreGeneration??0})}>{r.accept}</Button><Button onClick={()=>void c.run(async()=>{localStorage.setItem(key,JSON.stringify([...stored,suggestion.id]));setDismissed([...dismissed,suggestion.id]);})}>{r.dismiss}</Button></div></Sheet>}
 {preview&&<Sheet><h2>{r.preview}</h2><p>{r.weekTarget}: {preview.suggestion.proposal.weeklyTarget}</p>{preview.suggestion.proposal.templates.map(template=><section key={template.id}><h3>{templateLabel(template,c.locale,preview.suggestion.proposal.templates)} · {template.estimatedMinutes}</h3>{template.items.map((i,index)=><p key={index}>{name(i.exerciseId)} · {itemTarget(i,c.locale)}</p>)}</section>)}<div className="v8-row"><Button variant="primary" disabled={c.busy} onClick={()=>void c.run(async()=>{await createReviewService(repository).adopt(preview.suggestion,preview.revision,preview.generation,suggestionText(preview.suggestion));setPreview(undefined);setSaved(true);})}>{r.accept}</Button><Button onClick={()=>setPreview(undefined)}>{r.cancel}</Button></div></Sheet>}
 {periodActivities.length>0&&<section className="rv-log-section" aria-label={r.activity}><h2 className="rv-section-title v9-body">{r.activity}</h2><ul className="rv-log-list">{periodActivities.map(a=><li key={a.id} className="rv-log v9-card" data-variant="raised" data-padding="sm">
  <div className="rv-log-head"><span className="rv-date v9-num">{shortDate(a.localDate)}</span><span className="rv-log-name">{a.customName||activities.types[a.type]}</span><span className="rv-log-meta v9-num">{a.minutes} {r.minutesUnit}</span></div>
  {a.note&&<p className="rv-log-note">{a.note}</p>}</li>)}</ul></section>}
 {(historyError||periodRows.length>0)&&<section className="rv-log-section" aria-label={t.history}><h2 className="rv-section-title v9-body">{t.history}</h2>{historyError&&<p role="alert">{r.historyError}</p>}<ul className="rv-log-list">{periodRows.map(w=><li key={w.id} className="rv-log v9-card" data-variant="raised" data-padding="sm" data-status={w.status}>
  <div className="rv-log-head"><span className="rv-date v9-num">{shortDate(activityDate(timeZone,0,new Date(w.startedAt)))}</span><span className="rv-log-meter" aria-hidden="true"><span style={{'--rv-level':w.plannedSetCount?Math.min(1,w.sets.length/w.plannedSetCount):1} as CSSProperties}/></span><span className="rv-log-meta v9-num">{w.sets.length} / {w.plannedSetCount} {t.sets}</span></div>
  {w.sets.length>0&&<ul className="rv-sets">{groupSets(w.sets.map((s,i)=>({exerciseId:s.exerciseId,text:setText(s),note:w.setNotes?.[i]}))).map((g,i)=><li key={i}><span className="rv-set-name">{name(g.exerciseId)}</span><span className="rv-set-value">{g.text}</span></li>)}</ul>}
  {w.feedback?.note&&<p className="rv-log-note">{w.feedback.note}</p>}{w.originalNotes&&<p className="rv-log-note">{w.originalNotes}</p>}{w.appendedNotes?.map((note,i)=><p key={i} className="rv-log-note">{note.text}</p>)}</li>)}</ul></section>}
 {weightDue&&<aside className="rv-actions"><Button onClick={()=>{void c.run(async()=>{await bodyProfileService.dismissWeightPrompt();c.navigate('/settings/body')})}}>{bodyCopy[c.locale].review}</Button><Button onClick={()=>void c.run(async()=>{await bodyProfileService.dismissWeightPrompt()})}>{bodyCopy[c.locale].ignore}</Button></aside>}
 {!(empty&&hasCurrentPlan)&&<Button onClick={()=>c.navigate('/')}>{t.next}</Button>}</main>;
}
