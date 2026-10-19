import {durationText} from '../../components/ExerciseTargets';
import {painPromptAreas} from '../../../application/pain-followup';
import {Rules,calendarDay} from '../../../engine/data';
import {PregnancySafetyControls} from './PregnancySafetyControls';
import {OlderFallPanel} from './OlderFallPanel';
import {CardiacStopPanel} from './CardiacStopPanel';
import {PostpartumSafetyPanel} from './PostpartumSafetyPanel';
import {painExcludedItemIndexes} from '../../../application/pain-restrictions';
import {historyDangerReview} from '../../../application/pain-events';
import {needsPostpartumReferralCheck} from '../../../application/postpartum-referral';
import {PainProfessionalConfirmation} from '../../components/PainProfessionalConfirmation';
import {PainFeedbackPanel} from './PainFeedbackPanel';
import {effectivePainItem,latestSetFeedback,type PainFeedbackPreview} from '../../../application/training-pain';
import {SetFeedback} from './SetFeedback';
import {PrescriptionDetails} from './PrescriptionDetails';
import {SourceWarmupSteps} from './SourceWarmupSteps';
import {useFeature} from '../../useFeature';
import {engineCopy} from '../../../coach/engine-copy';
import {engineTrainingCopy} from '../../../i18n/features/training/engine';
import {templateLabel} from '../../../i18n/features/plan/labels';
import {ExerciseBrowser} from '../../components/ExerciseBrowser';
import {replacementScore,type ExerciseSearchFilters} from '../../../catalog/catalog-service';
import {initialFilters} from './manual/selection';
import {useTimerCue} from './useRestVibration';
import {useState,useEffect,useRef,type ReactNode} from 'react';
import {Button,Chip,MorphPanel} from '../../components/common';
import {PrimaryButton,CountdownRing,Yaya} from '../../components/kit';
import {useMainline,workflow,format} from '../../mainline/context';
import {exercises} from '../../../catalog/exercises';
import {useTrainingWakeLock} from './useTrainingWakeLock';
import {CoachVisual} from '../../components/CoachVisual';
import {ExerciseGuidePanel} from '../../components/ExerciseGuide';
import {getExerciseGuide} from '../../../catalog/exercise-guide';
import {manualTrainingItems} from '../../../application/rules/manual-items';
import {holdIdle,holdStart,holdPause,holdStatus,holdRemaining,holdSecondsToRecord,recommendedRestSeconds,restRemaining,restDone,restExtend,restVisible,restTotal,pauseOtherHolds,type HoldTimer,type RestPlan} from './timer-logic';
import guideZh from '../../../i18n/features/training/guide.zh.json';
import guideEn from '../../../i18n/features/training/guide.en.json';
import playerZh from '../../../i18n/features/training/player.zh.json';
import playerEn from '../../../i18n/features/training/player.en.json';
import './player.css';
const painPromptRules=new Rules();
type Panel='pause'|'edit'|'swap'|'safety';

/** Wall clock that ticks only while a countdown is on screen; nothing else re-renders. */
function useNow(ticking:boolean){
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{setNow(Date.now());if(!ticking)return;const timer=window.setInterval(()=>setNow(Date.now()),250);return()=>clearInterval(timer);},[ticking]);
 return now;
}
/** Rests the user already left stay closed after a reload in this tab (a per-tab convenience, not a fact). */
const closedRestKey='fitness.v9.closed-rests';
function readClosedRests():string[]{try{const value=JSON.parse(sessionStorage.getItem(closedRestKey)??'[]');return Array.isArray(value)?value.filter(item=>typeof item==='string'):[];}catch{return [];}}
/** Fires the end cue for one countdown; rendered only while that countdown is on screen. */
function CueAt({dueAt,active}:{dueAt?:number;active:boolean}){useTimerCue(dueAt,active);return null;}
const Icon=({d}:{d:string})=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" focusable="false"><path d={d}/></svg>;

/** Demonstration image from the exercise library (same media as 动作库); written key points when none exists. */
function ExerciseMediaHero({id,locale,label,noMedia,onOpen}:{id:string;locale:'zh'|'en';label:string;noMedia:string;onOpen:(trigger:HTMLElement)=>void}){
 const guide=getExerciseGuide(id,locale),[failed,setFailed]=useState<string>();
 const media=guide.media&&guide.media.attribution!=='Fitness original movement-pattern symbol'&&failed!==guide.media.src?guide.media:undefined;
 return <button type="button" className="exercise-guide-open wk-media" aria-label={label} onClick={event=>onOpen(event.currentTarget)}>
  {media?<img src={media.src} alt={media.alt} onError={()=>setFailed(media.src)}/>:<span className="wk-media-empty">{noMedia}</span>}
 </button>;
}

export function WorkoutPage(){
 const engineEnabled=useFeature('trainingEngine');
 const {data,t,locale,name,navigate,run,busy,slots,openCoach,focusIndex:index,setFocusIndex:setIndex,workoutValues:values,setWorkoutValues:setValues}=useMainline();const active=data?.active;
 const painSequence=useRef(0);
 const [painPreviewLoading,setPainPreviewLoading]=useState(false);
 const [painPreview,setPainPreview]=useState<{eventId:string;value:PainFeedbackPreview}>();
 useEffect(()=>{let alive=true;const serial=++painSequence.current;setPainPreview(undefined);setPainPreviewLoading(false);if(!active)return;const event=latestSetFeedback(active).filter(row=>row.effort==='discomfort'&&(row.painScore??0)>=4).at(-1);if(event)void workflow.painFeedbackPreview(active.id,event.id).then(value=>{if(alive&&serial===painSequence.current)setPainPreview({eventId:event.id,value});}).catch(()=>{});return()=>{alive=false;painSequence.current++}},[engineEnabled,active?.id,data?.metadata.dataRevision]);
 const [allowedSwapIds,setAllowedSwapIds]=useState<string[]>([]);
 useEffect(()=>{let alive=true;setAllowedSwapIds([]);void workflow.replacementCandidates().then(ids=>{if(alive)setAllowedSwapIds(ids);}).catch(()=>{});return()=>{alive=false;};},[data?.metadata.dataRevision]);
 const [swapQuery,setSwapQuery]=useState(''),[swapFilters,setSwapFilters]=useState<ExerciseSearchFilters>({}),[guideId,setGuideId]=useState<string>();
 const [panel,setPanel]=useState<Panel>(),[replacement,setReplacement]=useState(''),[reason,setReason]=useState<'other'|'discomfort'>('other');
 const panelTrigger=useRef<HTMLElement|null>(null),guideTrigger=useRef<HTMLElement|null>(null),safetyInline=useRef<HTMLElement|null>(null),[guideOpen,setGuideOpen]=useState(false);
 const showPanel=(next:Panel,trigger?:HTMLElement)=>{if(trigger)panelTrigger.current=trigger;setPanel(next);};
 const copy=locale==='zh'?guideZh:guideEn,p=locale==='zh'?playerZh:playerEn,engineCopyText=engineTrainingCopy[locale];
 // Timer state is per device and per screen visit; saved facts never depend on it.
 const [holds,setHolds]=useState<Record<string,HoldTimer>>({}),[restExtra,setRestExtra]=useState<Record<string,RestPlan>>({}),[restClosed,setRestClosedState]=useState<string[]>(readClosedRests);
 const setRestClosed=(update:(prior:string[])=>string[])=>setRestClosedState(prior=>{const next=update(prior).slice(-20);try{sessionStorage.setItem(closedRestKey,JSON.stringify(next));}catch{/* Per-tab convenience only. */}return next;});
 const latestSet=active?.sets.at(-1);
 const restKey=active&&latestSet?`${active.id}:${latestSet.itemIndex}:${latestSet.setIndex}:${latestSet.completedAt}`:'';
 const anyHoldRunning=Object.values(holds).some(hold=>hold.startedAt!==undefined);
 const now=useNow(!!active&&(anyHoldRunning||(!!restKey&&!restClosed.includes(restKey))));
 useTrainingWakeLock(!!active&&!panel);
 const cardiacPanel=data?<CardiacStopPanel locale={locale} busy={busy} paused={!!data.state?.cardiacPause} onStop={symptoms=>void run(async()=>{await workflow.reportCardiacSymptoms(active?.id,symptoms,data.metadata.dataRevision);navigate('/workout/recovery');})}/>:null;
 const items=active?.plannedExercises??[],item=items[index]??items[0];
 // Computed before any early return so hook order stays fixed.
 const template=active?(active.templateSnapshot??data?.versions.find(v=>v.id===active.planVersionId)?.templates.find(s=>s.id===active.templateId)):undefined;
 const restPlan:RestPlan|undefined=active&&latestSet?(restExtra[restKey]??{completedAt:Date.parse(latestSet.completedAt),baseSeconds:recommendedRestSeconds(template?.items[latestSet.itemIndex]?.prescription?.restSeconds),extraSeconds:0}):undefined;
 if(!active)return <main className="wk-page">{cardiacPanel}<OlderFallPanel/><PostpartumSafetyPanel/><PregnancySafetyControls/><p>{t.noTraining}</p><Button onClick={()=>navigate('/')}>{t.next}</Button></main>;
 if(!item)return null;
 const exerciseIdOf=(itemIndex:number,fallback:string)=>(engineEnabled||active.painActions?.length?effectivePainItem(active,itemIndex)?.exerciseId:undefined)??active.substitutions?.filter(s=>s.itemIndex===itemIndex).at(-1)?.toExerciseId??fallback;
 const effective=engineEnabled||active.painActions?.length?effectivePainItem(active,item.itemIndex):undefined;
 const effectiveId=effective?.exerciseId??active.substitutions?.filter(s=>s.itemIndex===item.itemIndex).at(-1)?.toExerciseId??item.exerciseId;
 const exercise=exercises.find(e=>e.id===effectiveId)!;
 const planned=effective??template?.items[item.itemIndex];
 const prescription=planned?.exerciseId===effectiveId?planned.prescription:undefined;
 const promptedPainAreas=latestSet?painPromptAreas(latestSet.exerciseId,data.state?.coachProfile?.cautions??[],painPromptRules):[];
 const population=data.state?.coachProfile?.population;
 const matching=planned?.exerciseId===effectiveId?planned.target:manualTrainingItems([effectiveId])[0]?.target;
 const previous=active.sets.filter(s=>s.itemIndex===item.itemIndex&&s.exerciseId===effectiveId).at(-1);
 const relativePower=!!prescription?.safetyCue&&planned?.target.metricType==='reps';
 const needsLoad=exercise.metricType==='reps_load'&&!relativePower;
 const timed=exercise.metricType.startsWith('duration')&&!relativePower;
 const key=`${active.id}:${index}:${effectiveId}`;
 const value=values[key]??(timed?previous?.durationSeconds??(matching&&'durationSeconds'in matching?matching.durationSeconds:30):previous?.reps??(matching&&'reps'in matching?matching.reps:8));
 const suggestedLoad=previous?.loadGrams??(matching&&'loadGrams'in matching?matching.loadGrams:undefined);
 const load=values[`${key}:kg`]??(typeof suggestedLoad==='number'&&suggestedLoad>0?suggestedLoad/1000:undefined);
 const hasLoad=load!==undefined&&Number.isFinite(load)&&load>0;
 const guide=getExerciseGuide(effectiveId,locale);
 const distance=values[`${key}:meters`]??previous?.distanceMeters??(matching&&'distanceMeters'in matching?matching.distanceMeters:undefined);
 const excluded=new Set(painExcludedItemIndexes(active,data.workouts,data.state?.coachProfile?.painState,data.state?.painFollowupRestrictions));
 const pendingPain=latestSetFeedback(active).some(event=>event.effort==='discomfort'&&(event.painScore??0)>=4&&!active.painActions?.some(action=>action.eventId===event.id));
 const painBlocked=!!data.state?.pregnancySafety?.providerPause||!!data.state?.olderSafety?.reviewRequiredAt||!!data.state?.cardiacPause||!!data.state?.postpartumSafety?.urgentAt||!!data.state?.trainingPause||!!active.painReviewRequired||pendingPain;
 const setsOf=(itemIndex:number)=>active.sets.filter(s=>s.itemIndex===itemIndex).length;
 const isDone=(row:{itemIndex:number;plannedSetCount:number})=>excluded.has(row.itemIndex)||setsOf(row.itemIndex)>=row.plannedSetCount;
 const done=setsOf(item.itemIndex),allDone=items.every(isDone),thisDone=isDone(item);
 const nextOpen=(from:number)=>{const after=items.findIndex((row,i)=>i>from&&!isDone(row));return after>=0?after:items.findIndex(row=>!isDone(row));};
 // Hold countdown for timed exercises: idle until the user taps 开始计时.
 const holdKey=`${active.id}:${index}:${done}`,hold=holds[holdKey];
 const timer=timed?(hold&&hold.total===value?hold:holdIdle(value)):undefined;
 const timerStatus=timer?holdStatus(timer,now):'idle';
 const setHold=(next:HoldTimer)=>setHolds(prior=>({...(next.startedAt!==undefined?pauseOtherHolds(prior,Date.now(),holdKey):prior),[holdKey]:next}));
 const recordValue=timer?holdSecondsToRecord(timer,now):value;
 const loadText=relativePower&&prescription?.loadDescription?prescription.loadDescription[locale]:needsLoad?(hasLoad?`${load} ${t.kg}`:engineEnabled&&prescription?.loadDescription?prescription.loadDescription[locale]:copy.chooseLoad):t.bodyweight;
 const targetText=`${timed?durationText(value,locale):`${value} ${t.reps}`}${exercise.metricType==='duration_distance'&&distance!==undefined&&Number.isFinite(distance)?` · ${distance} ${t.meters}`:''}`;
 const complete=(event:React.MouseEvent<HTMLButtonElement>)=>{panelTrigger.current=event.currentTarget;if(!allDone&&!thisDone&&needsLoad&&!hasLoad){showPanel('edit');return;}void run(async()=>{if(painBlocked)return;if(allDone){navigate(`/workout/${active.id}/finish`);return;}if(thisDone){setIndex(items.findIndex(p=>!isDone(p)));return;}let nextSet=0;while(active.sets.some(s=>s.itemIndex===item.itemIndex&&s.setIndex===nextSet))nextSet++;await workflow.recordSet(active.id,item.itemIndex,nextSet,timed?{durationSeconds:recordValue,...(exercise.metricType==='duration_distance'&&distance!==undefined&&Number.isFinite(distance)?{distanceMeters:distance}:{})}:{reps:value,...(needsLoad?{loadGrams:Math.round(load!*1000)}:{})});setHolds(prior=>{const next={...prior};delete next[holdKey];return next;});});};
 // Safety: every existing panel stays reachable. Signals that need action stay on the page; the rest open from 身体不适？.
 const state=data.state,timeZone=data.profile?.timeZone??'Asia/Shanghai';
 const referralDue=population?.kind==='postpartum'&&needsPostpartumReferralCheck(state?.postpartumReferralChecks,'weekly_checkin',{asOfDate:calendarDay(new Date().toISOString(),timeZone)!,timeZone});
 const safetyAttention=!!state?.cardiacPause||(!!state?.olderSafety&&!state.olderSafety.professionalSeenAt)||!!state?.pregnancySafety?.providerPause||!!state?.postpartumSafety?.urgentAt||!!state?.postpartumSafety?.regression||referralDue;
 const safetyPanels=<>{cardiacPanel}<OlderFallPanel/><PostpartumSafetyPanel/><PregnancySafetyControls exerciseId={effectiveId} itemIndex={item.itemIndex}/>
  {engineEnabled&&(population?.kind==='pregnant'||population?.kind==='postpartum')&&<details><summary>{engineCopyText.stop}</summary>{population.kind==='pregnant'?<p>{engineCopy('pregnancy.stop.copy.stop',locale)}</p>:<><p>{engineCopy('postpartum.copy.warning.warning',locale)}</p><p>{engineCopy('postpartum.copy.urgent.urgent',locale)}</p></>}<Button onClick={()=>navigate(`/workout/${active.id}/finish`)}>{engineCopyText.end}</Button></details>}</>;
 const openSafety=(trigger:HTMLElement)=>{if(timer&&timerStatus==='running')setHold(holdPause(timer,Date.now()));showPanel('safety',trigger);};
 // Rest between sets: counts down from the saved set; the next set never starts by itself.
 const restItem=latestSet?items.find(row=>row.itemIndex===latestSet.itemIndex):undefined;
 const restShown=!!restPlan&&!!restItem&&!allDone&&!painBlocked&&!safetyAttention&&restVisible(restPlan,now,restClosed.includes(restKey));
 const restNextIndex=restItem?(isDone(restItem)?nextOpen(items.indexOf(restItem)):items.indexOf(restItem)):-1;
 const restNext=restNextIndex>=0?items[restNextIndex]:undefined;
 const leaveRest=()=>{setRestClosed(prior=>[...prior,restKey]);if(restNextIndex>=0)setIndex(restNextIndex);};
 const progressLabel=format(p.progress,{current:index+1,total:items.length});
 const nextText=():string=>{if(allDone)return p.allDoneNext;if(!thisDone&&done+1<item.plannedSetCount)return `${p.upNext}：${name(effectiveId)} · ${format(t.setCount,{current:done+2,total:item.plannedSetCount})}`;const upcoming=nextOpen(index);const row=upcoming>=0&&upcoming!==index?items[upcoming]:undefined;return row?`${p.upNext}：${name(exerciseIdOf(row.itemIndex,row.exerciseId))}`:p.lastOne;};
 const top=<header className="wk-top">
  <button type="button" className="wk-round v8-press" aria-label={t.pause} onClick={event=>showPanel('pause',event.currentTarget)}><Icon d="M6 6l12 12M18 6L6 18"/></button>
  <div className="wk-progress" role="progressbar" aria-label={progressLabel} aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={items.filter(isDone).length}>{items.map((row,i)=><span key={row.itemIndex} data-state={isDone(row)?'done':i===index&&!restShown?'current':'todo'}/>)}</div>
  <PrimaryButton tone="warn" size="sm" onClick={event=>{if(safetyAttention)safetyInline.current?.scrollIntoView({block:'start'});openSafety(event.currentTarget);}}>{p.unwell}</PrimaryButton>
  <button type="button" className="wk-round wk-coach v8-press" aria-label={t.askCoach} onClick={()=>openCoach('ADJUST_TODAY',active.templateId)}><CoachVisual/></button>
 </header>;
 const feedback=(engineEnabled||promptedPainAreas.length>0)&&latestSet&&<section className="wk-feedback"><p className="wk-muted">{name(latestSet.exerciseId)}</p><SetFeedback key={`${active.id}:${latestSet.itemIndex}:${latestSet.setIndex}`} fact={latestSet} events={active.setFeedbackEvents??[]} locale={locale} busy={busy} painAllowed={!!data.state?.coachProfile?.healthStorageConsent} promptPainAreas={promptedPainAreas} onHealthSettings={()=>navigate('/settings/engine')} onAppend={event=>void run(async()=>{await workflow.appendSetFeedback(active.id,event,data.metadata.dataRevision);})}/></section>;
 let body:ReactNode;
 if(restShown&&restPlan){
  const left=restRemaining(restPlan,now),finished=restDone(restPlan,now),nextId=restNext?exerciseIdOf(restNext.itemIndex,restNext.exerciseId):undefined,sameItem=restNext?.itemIndex===restItem!.itemIndex;
  body=<section className="wk-rest" aria-labelledby="wk-rest-title">
   <div className="wk-rest-head"><Yaya pose="cheer" size={56} mode="disc" alt="" float={false}/><div><h1 id="wk-rest-title" className="v9-display">{p.restTitle}</h1><p className="wk-muted">{p.restHint}</p></div></div>
   <div className="wk-rest-ring"><CountdownRing remaining={left} total={restTotal(restPlan)} label={p.restLeft} caption={p.restCaption} size={232} stroke={12}/></div>
   <p className="wk-rest-status" role="status">{finished?p.restDone:''}</p>
   <div className="wk-rest-actions"><PrimaryButton tone="quiet" size="md" block aria-label={p.addRestLabel} onClick={()=>setRestExtra(prior=>({...prior,[restKey]:restExtend(restPlan,Date.now())}))}><span className="v9-num">{p.addRest}</span></PrimaryButton>{!finished&&<PrimaryButton tone="quiet" size="md" block onClick={leaveRest}>{p.skipRest}</PrimaryButton>}</div>
   {restNext&&nextId&&<div className="v9-card wk-next" data-variant="inset" data-padding="sm"><span className="wk-muted">{sameItem?p.upNext:p.nextExercise}</span><strong>{name(nextId)}</strong><span>{format(t.setCount,{current:setsOf(restNext.itemIndex)+1,total:restNext.plannedSetCount})}</span></div>}
   {finished&&<PrimaryButton onClick={leaveRest}>{sameItem?p.startNext:p.startNextExercise}</PrimaryButton>}
   {feedback}
  </section>;
 }else body=<>
  {!excluded.has(item.itemIndex)&&<section className="wk-focus" onClickCapture={event=>{const button=(event.target as HTMLElement).closest('button');if(button)panelTrigger.current=button;}}>
   <ExerciseMediaHero key={effectiveId} id={effectiveId} locale={locale} label={copy.details} noMedia={p.noMedia} onOpen={trigger=>{guideTrigger.current=trigger;setGuideId(effectiveId);setGuideOpen(true);}}/>
   <div className="wk-title"><p className="wk-muted">{format(t.setCount,{current:Math.min(done+1,item.plannedSetCount),total:item.plannedSetCount})}</p><h1 className="v9-display">{name(effectiveId)}</h1></div>
   {timer&&!thisDone?<div className="wk-timer">
    <CountdownRing remaining={holdRemaining(timer,now)} total={timer.total} label={p.timeLeft} caption={p.hold} size={156} stroke={10}/>
    <div className="wk-timer-side">
     <PrimaryButton tone="quiet" size="md" block disabled={busy||painBlocked} onClick={()=>setHold(timerStatus==='running'?holdPause(timer,Date.now()):holdStart(timer,Date.now()))}>{timerStatus==='running'?p.pauseTimer:timerStatus==='paused'?p.resumeTimer:timerStatus==='done'?p.restartTimer:p.startTimer}</PrimaryButton>
     <PrimaryButton tone="text" size="sm" aria-label={t.edit} disabled={busy||timerStatus==='running'} onClick={()=>showPanel('edit')}><span className="v9-num">{loadText} · {targetText}</span></PrimaryButton>
     <p className="wk-muted" role="status">{timerStatus==='done'?p.timeUp:''}</p>
    </div>
   </div>:<slots.SetValue label={t.edit} loadText={loadText} targetText={targetText} onEdit={()=>showPanel('edit')} disabled={busy||thisDone}/>}
  </section>}
  <PrimaryButton className="wk-complete" disabled={busy||!!panel||painBlocked} onClick={complete}>{allDone?(excluded.size?engineCopyText.end:t.allDone):thisDone?t.exerciseDone:t.completeSet}</PrimaryButton>
  <p className="wk-next-line wk-muted">{nextText()}</p>
  {excluded.size>0&&!painPreview?.value.notices.includes(engineCopy('pain.copy.drop_pattern',locale))&&<p role="status">{engineCopy('pain.copy.drop_pattern',locale)}</p>}
  {feedback}
  {!excluded.has(item.itemIndex)&&<section className="wk-details">
   <h2 className="wk-section-title">{copy.points}</h2>
   <ul className="exercise-guide-points" aria-label={copy.points}>{guide.keyPoints.map((point,i)=><li key={i}>{point}</li>)}</ul>
   {(engineEnabled||relativePower)&&<><SourceWarmupSteps template={template} itemIndex={item.itemIndex} exerciseId={effectiveId} unreplayedChanges={Boolean(active.substitutions?.length||active.painActions?.length)}/><PrescriptionDetails prescription={prescription} locale={locale}/></>}
   <Button onClick={event=>{setReplacement('');setSwapQuery('');setSwapFilters({});setReason('other');showPanel('swap',event.currentTarget);}} disabled={thisDone||painBlocked}>{t.changeExercise}</Button>
  </section>}
 </>;
 return <main className="wk-page" data-training-active="true" data-screen={restShown?'rest':'player'}>
 {top}
 {timer?.startedAt!==undefined&&<CueAt dueAt={timer.startedAt+timer.total*1000-timer.accumulatedMs} active={!panel}/>}
 {restShown&&restPlan&&<CueAt dueAt={restPlan.completedAt+restTotal(restPlan)*1000} active/>}
 <p className="wk-template wk-muted">{template?templateLabel(template,locale):t.manual} · {progressLabel}</p>
 {safetyAttention&&<section className="wk-safety-inline" ref={safetyInline} tabIndex={-1} aria-label={p.signals}>{safetyPanels}</section>}
 {body}
 {painPreview&&<PainFeedbackPanel key={painPreview.eventId} preview={painPreview.value} locale={locale} busy={busy||painPreviewLoading} name={name} confirmLabel={t.confirm} onAnswersChange={answers=>{const serial=++painSequence.current;if(!painPreview.value.questions.every(question=>typeof answers[question.key]==='boolean')){setPainPreviewLoading(false);setPainPreview({...painPreview,value:{...painPreview.value,replacement:undefined,redFlagsRequired:true}});return;}setPainPreviewLoading(true);void workflow.painFeedbackPreview(active.id,painPreview.eventId,answers).then(value=>{if(serial===painSequence.current){setPainPreview({eventId:painPreview.eventId,value});setPainPreviewLoading(false);}}).catch(()=>{if(serial===painSequence.current){setPainPreview(undefined);setPainPreviewLoading(false);}});}} onApply={answers=>void run(async()=>{await workflow.applyPainFeedback(active.id,painPreview.eventId,data.metadata.dataRevision,answers);})}/>}
 {(active.painReviewRequired||data.state?.trainingPause)&&<><p role="status">{engineCopy('redflag.copy.paused_banner',locale)}</p><Button onClick={()=>navigate(`/workout/${active.id}/finish`)}>{engineCopyText.end}</Button></>}
 {(active.painReviewRequired||data.state?.trainingPause)&&data.state?.coachProfile?.healthStorageConsent?.acceptedAt&&data.state.coachProfile.screening?.completedAt&&data.state.coachProfile.screening.parqAnswers?.length===7&&data.state.coachProfile.screening.rescreenRequired!==true&&(!data.state.trainingPause||Date.parse(data.state.coachProfile.screening.completedAt)>=Date.parse(data.state.trainingPause.requiredAt))&&<PainProfessionalConfirmation pauseRequiredAt={data.state?.trainingPause?.requiredAt} review={historyDangerReview(data.workouts,data.state.coachProfile.screening?.redFlagReview)} locale={locale} busy={busy} confirmLabel={t.confirm} onConfirm={()=>void run(async()=>{await workflow.confirmPainProfessionalSeen(data.metadata.dataRevision);})}/>}
 <div className="v8-capsules wk-capsules" aria-label={t.actions}>{items.map((row,i)=><Chip key={row.itemIndex} selected={i===index} disabled={excluded.has(row.itemIndex)} onClick={()=>{if(i!==index)setHolds(prior=>pauseOtherHolds(prior,Date.now()));setIndex(i);setPanel(undefined);if(restKey)setRestClosed(prior=>[...prior,restKey]);}}>{setsOf(row.itemIndex)>=row.plannedSetCount?'✓ ':''}{name(exerciseIdOf(row.itemIndex,row.exerciseId))}</Chip>)}</div>
 <ExerciseGuidePanel id={guideId??effectiveId} locale={locale} open={guideOpen} onClose={()=>setGuideOpen(false)} triggerRef={guideTrigger}/>
 <MorphPanel open={!!panel} placement={panel==='pause'||panel==='safety'?'bottom':'center'} title={panel==='pause'?t.pauseTitle:panel==='edit'?t.edit:panel==='safety'?p.unwellTitle:t.changeExercise} closeLabel={t.close} triggerRef={panelTrigger} onClose={()=>setPanel(undefined)}><div className="v8-pause-actions">
 {panel==='safety'?<div className="wk-safety">
  <div className="wk-safety-head"><Yaya pose="care" size={48} mode="disc" alt="" float={false}/>{safetyAttention&&<p>{p.signalsHint}</p>}</div>
  <div className="wk-safety-tiles">
   <button type="button" className="v9-card wk-tile v8-press" data-variant="raised" data-padding="sm" disabled={thisDone||painBlocked} onClick={event=>{setReplacement('');setSwapQuery('');setSwapFilters({});setReason('discomfort');showPanel('swap',event.currentTarget);}}><strong>{p.jointPain}</strong><span>{p.jointPainHint}</span></button>
   <button type="button" className="v9-card wk-tile v8-press" data-variant="raised" data-padding="sm" disabled={busy||thisDone} onClick={event=>showPanel('edit',event.currentTarget)}><strong>{p.tooHard}</strong><span>{p.tooHardHint}</span></button>
  </div>
  {!safetyAttention&&<div className="wk-safety-panels">{safetyPanels}</div>}
  <PrimaryButton tone="warn" onClick={()=>navigate(`/workout/${active.id}/finish`)}>{p.endToday}</PrimaryButton>
  <PrimaryButton onClick={()=>setPanel(undefined)}>{p.keepGoing}</PrimaryButton>
 </div>:panel==='pause'?<><p>{t.pauseHint}</p><Button onClick={()=>setPanel(undefined)}>{t.resume}</Button><Button onClick={()=>navigate(`/workout/${active.id}/finish`)}>{t.end}</Button><Button onClick={()=>void run(async()=>{await workflow.finish(active.id,{reasons:[]},true);navigate('/');})}>{t.abandon}</Button></>:panel==='edit'?<><label>{timed?t.seconds:t.reps}<input type="number" min="1" value={value} onChange={e=>setValues({...values,[key]:Number(e.target.value)})}/></label>{exercise.metricType==='duration_distance'&&<label>{t.meters}<input type="number" min="0" step="1" value={distance===undefined||Number.isNaN(distance)?'':distance} onChange={e=>setValues({...values,[`${key}:meters`]:e.target.valueAsNumber})}/></label>}{needsLoad&&<label>{t.kg}<input placeholder={copy.chooseLoad} type="number" min="0" step="0.5" value={load===undefined||Number.isNaN(load)?'':load} onChange={e=>setValues({...values,[`${key}:kg`]:e.target.valueAsNumber})}/></label>}<Button disabled={!(value>0)||!Number.isInteger(value)||(needsLoad&&!hasLoad)||(distance!==undefined&&!Number.isNaN(distance)&&(!Number.isInteger(distance)||distance<0))} onClick={()=>setPanel(undefined)}>{t.confirm}</Button></>:panel==='swap'?<><ExerciseBrowser locale={locale} query={swapQuery} setQuery={setSwapQuery} filters={{...swapFilters,allowedIds:allowedSwapIds.filter(id=>id!==effectiveId)}} setFilters={setSwapFilters} selected={replacement?[replacement]:[]} onSelect={id=>setReplacement(id)} onDetail={(id,trigger)=>{guideTrigger.current=trigger;setGuideId(id);setGuideOpen(true)}} cautionAreas={data.state?.coachProfile?.cautions??[]} rank={id=>replacementScore(id,effectiveId,initialFilters([data.state?.coachProfile?.place,...(data.state?.coachProfile?.equipment??[])].join(' ')).equipment,data.state?.coachProfile?.cautions)}/><p aria-live="polite">{replacement?`${t.replacement}: ${name(replacement)}`:t.choose}</p><label>{t.reasonLabel}<select aria-label={t.reasonLabel} value={reason} onChange={e=>setReason(e.target.value as typeof reason)}><option value="other">{t.other}</option><option value="discomfort">{t.discomfort}</option></select></label><Button disabled={!replacement||!allowedSwapIds.includes(replacement)||busy} onClick={()=>void run(async()=>{await workflow.substitute(active.id,item.itemIndex,replacement,reason);setPanel(undefined);})}>{t.confirm}</Button></>:null}
 </div></MorphPanel>
 </main>;
}
