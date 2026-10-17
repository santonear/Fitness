import {durationText} from '../../components/ExerciseTargets';
import {painPromptAreas} from '../../../application/pain-followup';
import {Rules} from '../../../engine/data';
import {PregnancySafetyControls} from './PregnancySafetyControls';
import {OlderFallPanel} from './OlderFallPanel';
import {CardiacStopPanel} from './CardiacStopPanel';
import {PostpartumSafetyPanel} from './PostpartumSafetyPanel';
import {painExcludedItemIndexes} from '../../../application/pain-restrictions';
import {historyDangerReview} from '../../../application/pain-events';
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
import { useRestVibration } from './useRestVibration';
import { useState,useEffect,useRef } from 'react';
import { Button,Chip,MorphPanel } from '../../components/common';
import { useMainline,workflow,format } from '../../mainline/context';
import { exercises } from '../../../catalog/exercises';
import { useTrainingWakeLock } from './useTrainingWakeLock';
import { CoachVisual } from '../../components/CoachVisual';
import { ExerciseGuideImage, ExerciseGuidePanel, ExerciseGuideAttribution } from '../../components/ExerciseGuide';
import { getExerciseGuide } from '../../../catalog/exercise-guide';
import { manualTrainingItems } from '../../../application/rules/manual-items';
import guideZh from '../../../i18n/features/training/guide.zh.json';
import guideEn from '../../../i18n/features/training/guide.en.json';
const painPromptRules=new Rules();
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
 const [panel,setPanel]=useState<'pause'|'edit'|'swap'>(),[replacement,setReplacement]=useState(''),[reason,setReason]=useState<'other'|'discomfort'>('other');
 const panelTrigger=useRef<HTMLElement|null>(null),guideTrigger=useRef<HTMLElement|null>(null),[guideOpen,setGuideOpen]=useState(false);
 const showPanel=(next:'pause'|'edit'|'swap',trigger?:HTMLElement)=>{if(trigger)panelTrigger.current=trigger;setPanel(next);};
 const copy=locale==='zh'?guideZh:guideEn,engineCopyText=engineTrainingCopy[locale];
 const [rest,setRest]=useState(0);useTrainingWakeLock(!!active&&!panel);useRestVibration(active?.sets.at(-1)?.completedAt,!!active&&!panel);
 useEffect(()=>{const last=active?.sets.at(-1)?.completedAt;if(!last)return;const update=()=>setRest(Math.max(0,Math.floor((Date.now()-Date.parse(last))/1000)));update();const timer=window.setInterval(update,1000);return()=>clearInterval(timer);},[active?.sets.length]);
 const cardiacPanel=data?<CardiacStopPanel locale={locale} busy={busy} paused={!!data.state?.cardiacPause} onStop={symptoms=>void run(async()=>{await workflow.reportCardiacSymptoms(active?.id,symptoms,data.metadata.dataRevision);navigate('/workout/recovery');})}/>:null;
 if(!active)return <main>{cardiacPanel}<OlderFallPanel/><PostpartumSafetyPanel/><PregnancySafetyControls/><p>{t.noTraining}</p><Button onClick={()=>navigate('/')}>{t.next}</Button></main>;
 const items=active.plannedExercises??[],item=items[index]??items[0];if(!item)return null;
 const effective=engineEnabled||active.painActions?.length?effectivePainItem(active,item.itemIndex):undefined;
 const effectiveId=effective?.exerciseId??active.substitutions?.filter(s=>s.itemIndex===item.itemIndex).at(-1)?.toExerciseId??item.exerciseId;
 const exercise=exercises.find(e=>e.id===effectiveId)!;
 const template=active.templateSnapshot??data?.versions.find(v=>v.id===active.planVersionId)?.templates.find(s=>s.id===active.templateId),planned=effective??template?.items[item.itemIndex];
 const prescription=planned?.exerciseId===effectiveId?planned.prescription:undefined;
 const latestSet=active.sets.at(-1);
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
 const done=active.sets.filter(s=>s.itemIndex===item.itemIndex).length,allDone=items.every(row=>excluded.has(row.itemIndex)||active.sets.filter(set=>set.itemIndex===row.itemIndex).length>=row.plannedSetCount),thisDone=excluded.has(item.itemIndex)||done>=item.plannedSetCount;
 const complete=(event:React.MouseEvent<HTMLButtonElement>)=>{panelTrigger.current=event.currentTarget;if(!allDone&&!thisDone&&needsLoad&&!hasLoad){showPanel('edit');return;}void run(async()=>{if(painBlocked)return;if(allDone){navigate(`/workout/${active.id}/finish`);return;}if(thisDone){setIndex(items.findIndex(p=>!excluded.has(p.itemIndex)&&active.sets.filter(s=>s.itemIndex===p.itemIndex).length<p.plannedSetCount));return;}let nextSet=0;while(active.sets.some(s=>s.itemIndex===item.itemIndex&&s.setIndex===nextSet))nextSet++;await workflow.recordSet(active.id,item.itemIndex,nextSet,timed?{durationSeconds:value,...(exercise.metricType==='duration_distance'&&distance!==undefined&&Number.isFinite(distance)?{distanceMeters:distance}:{})}:{reps:value,...(needsLoad?{loadGrams:Math.round(load!*1000)}:{})});});};
 return <main data-training-active="true">{cardiacPanel}<OlderFallPanel/><PostpartumSafetyPanel/><PregnancySafetyControls exerciseId={effectiveId} itemIndex={item.itemIndex}/><div className="v8-topline"><Button onClick={event=>showPanel('pause',event.currentTarget)}>{t.pause}</Button><span>{template?templateLabel(template,locale):t.manual}</span><Button aria-label={t.askCoach} onClick={()=>openCoach('ADJUST_TODAY',active.templateId)}><CoachVisual/></Button></div>
 {!excluded.has(item.itemIndex)&&<section className="v8-focus" onClickCapture={event=>{const button=(event.target as HTMLElement).closest('button');if(button)panelTrigger.current=button;}}><p>{format(t.setCount,{current:Math.min(done+1,item.plannedSetCount),total:item.plannedSetCount})}</p><h1>{name(effectiveId)}</h1>
 <button className="exercise-guide-open" aria-label={copy.details} onClick={event=>{guideTrigger.current=event.currentTarget;setGuideId(effectiveId);setGuideOpen(true);}}><ExerciseGuideImage key={effectiveId} id={effectiveId} locale={locale}/></button><ExerciseGuideAttribution id={effectiveId} locale={locale}/>
 <ul className="exercise-guide-points" aria-label={copy.points}>{guide.keyPoints.map((point,i)=><li key={i}>{point}</li>)}</ul>
 <slots.SetValue label={t.edit} loadText={relativePower&&prescription?.loadDescription?prescription.loadDescription[locale]:needsLoad?(hasLoad?`${load} ${t.kg}`:engineEnabled&&prescription?.loadDescription?prescription.loadDescription[locale]:copy.chooseLoad):t.bodyweight} targetText={`${timed?durationText(value,locale):`${value} ${t.reps}`}${exercise.metricType==='duration_distance'&&distance!==undefined&&Number.isFinite(distance)?` · ${distance} ${t.meters}`:''}`} onEdit={()=>showPanel('edit')} disabled={busy||thisDone}/><p>{t.metricHint}</p>
 {(engineEnabled||relativePower)&&<><SourceWarmupSteps template={template} itemIndex={item.itemIndex} exerciseId={effectiveId} unreplayedChanges={Boolean(active.substitutions?.length||active.painActions?.length)}/><PrescriptionDetails prescription={prescription} locale={locale}/></>}
 <Button onClick={()=>{setReplacement('');setSwapQuery('');setSwapFilters({});setReason('other');showPanel('swap');}} disabled={thisDone||painBlocked}>{t.changeExercise}</Button></section>}
 {active.sets.length>0&&<slots.RestClock label={t.rest} elapsedSeconds={rest}/>}
 <Button variant="primary" workout disabled={busy||!!panel||painBlocked} onClick={complete}>{allDone?(excluded.size?engineCopyText.end:t.allDone):thisDone?t.exerciseDone:t.completeSet}</Button>
 {excluded.size>0&&!painPreview?.value.notices.includes(engineCopy('pain.copy.drop_pattern',locale))&&<p role="status">{engineCopy('pain.copy.drop_pattern',locale)}</p>}
 {(engineEnabled||promptedPainAreas.length>0)&&latestSet&&<section><p>{name(latestSet.exerciseId)}</p><SetFeedback key={`${active.id}:${latestSet.itemIndex}:${latestSet.setIndex}`} fact={latestSet} events={active.setFeedbackEvents??[]} locale={locale} busy={busy} painAllowed={!!data.state?.coachProfile?.healthStorageConsent} promptPainAreas={promptedPainAreas} onHealthSettings={()=>navigate('/settings/engine')} onAppend={event=>void run(async()=>{await workflow.appendSetFeedback(active.id,event,data.metadata.dataRevision);})}/></section>}
 {painPreview&&<PainFeedbackPanel key={painPreview.eventId} preview={painPreview.value} locale={locale} busy={busy||painPreviewLoading} name={name} confirmLabel={t.confirm} onAnswersChange={answers=>{const serial=++painSequence.current;if(!painPreview.value.questions.every(question=>typeof answers[question.key]==='boolean')){setPainPreviewLoading(false);setPainPreview({...painPreview,value:{...painPreview.value,replacement:undefined,redFlagsRequired:true}});return;}setPainPreviewLoading(true);void workflow.painFeedbackPreview(active.id,painPreview.eventId,answers).then(value=>{if(serial===painSequence.current){setPainPreview({eventId:painPreview.eventId,value});setPainPreviewLoading(false);}}).catch(()=>{if(serial===painSequence.current){setPainPreview(undefined);setPainPreviewLoading(false);}});}} onApply={answers=>void run(async()=>{await workflow.applyPainFeedback(active.id,painPreview.eventId,data.metadata.dataRevision,answers);})}/>}
 {(active.painReviewRequired||data.state?.trainingPause)&&<><p role="status">{engineCopy('redflag.copy.paused_banner',locale)}</p><Button onClick={()=>navigate(`/workout/${active.id}/finish`)}>{engineCopyText.end}</Button></>}
 {(active.painReviewRequired||data.state?.trainingPause)&&data.state?.coachProfile?.healthStorageConsent?.acceptedAt&&data.state.coachProfile.screening?.completedAt&&data.state.coachProfile.screening.parqAnswers?.length===7&&data.state.coachProfile.screening.rescreenRequired!==true&&(!data.state.trainingPause||Date.parse(data.state.coachProfile.screening.completedAt)>=Date.parse(data.state.trainingPause.requiredAt))&&<PainProfessionalConfirmation pauseRequiredAt={data.state?.trainingPause?.requiredAt} review={historyDangerReview(data.workouts,data.state.coachProfile.screening?.redFlagReview)} locale={locale} busy={busy} confirmLabel={t.confirm} onConfirm={()=>void run(async()=>{await workflow.confirmPainProfessionalSeen(data.metadata.dataRevision);})}/>}
 {engineEnabled&&(population?.kind==='pregnant'||population?.kind==='postpartum')&&<details><summary>{engineCopyText.stop}</summary>{population.kind==='pregnant'?<p>{engineCopy('pregnancy.stop.copy.stop',locale)}</p>:<><p>{engineCopy('postpartum.copy.warning.warning',locale)}</p><p>{engineCopy('postpartum.copy.urgent.urgent',locale)}</p></>}<Button onClick={()=>navigate(`/workout/${active.id}/finish`)}>{engineCopyText.end}</Button></details>}
 <div className="v8-capsules" aria-label={t.actions}>{items.map((p,i)=>{const id=(engineEnabled||active.painActions?.length?effectivePainItem(active,p.itemIndex)?.exerciseId:undefined)??active.substitutions?.filter(s=>s.itemIndex===p.itemIndex).at(-1)?.toExerciseId??p.exerciseId;return <Chip key={p.itemIndex} selected={i===index} disabled={excluded.has(p.itemIndex)} onClick={()=>{setIndex(i);setPanel(undefined);}}>{active.sets.filter(s=>s.itemIndex===p.itemIndex).length>=p.plannedSetCount?'✓ ':''}{name(id)}</Chip>;})}</div>
 <ExerciseGuidePanel id={guideId??effectiveId} locale={locale} open={guideOpen} onClose={()=>setGuideOpen(false)} triggerRef={guideTrigger}/>
 <MorphPanel open={!!panel} placement={panel==='pause'?'bottom':'center'} title={panel==='pause'?t.pauseTitle:panel==='edit'?t.edit:t.changeExercise} closeLabel={t.close} triggerRef={panelTrigger} onClose={()=>setPanel(undefined)}><div className="v8-pause-actions">
 {panel==='pause'?<><p>{t.pauseHint}</p><Button onClick={()=>setPanel(undefined)}>{t.resume}</Button><Button onClick={()=>navigate(`/workout/${active.id}/finish`)}>{t.end}</Button><Button onClick={()=>void run(async()=>{await workflow.finish(active.id,{reasons:[]},true);navigate('/');})}>{t.abandon}</Button></>:panel==='edit'?<><label>{timed?t.seconds:t.reps}<input type="number" min="1" value={value} onChange={e=>setValues({...values,[key]:Number(e.target.value)})}/></label>{exercise.metricType==='duration_distance'&&<label>{t.meters}<input type="number" min="0" step="1" value={distance===undefined||Number.isNaN(distance)?'':distance} onChange={e=>setValues({...values,[`${key}:meters`]:e.target.valueAsNumber})}/></label>}{needsLoad&&<label>{t.kg}<input placeholder={copy.chooseLoad} type="number" min="0" step="0.5" value={load===undefined||Number.isNaN(load)?'':load} onChange={e=>setValues({...values,[`${key}:kg`]:e.target.valueAsNumber})}/></label>}<Button disabled={!(value>0)||!Number.isInteger(value)||(needsLoad&&!hasLoad)||(distance!==undefined&&!Number.isNaN(distance)&&(!Number.isInteger(distance)||distance<0))} onClick={()=>setPanel(undefined)}>{t.confirm}</Button></>:panel==='swap'?<><ExerciseBrowser locale={locale} query={swapQuery} setQuery={setSwapQuery} filters={{...swapFilters,allowedIds:allowedSwapIds.filter(id=>id!==effectiveId)}} setFilters={setSwapFilters} selected={replacement?[replacement]:[]} onSelect={id=>setReplacement(id)} onDetail={(id,trigger)=>{guideTrigger.current=trigger;setGuideId(id);setGuideOpen(true)}} cautionAreas={data.state?.coachProfile?.cautions??[]} rank={id=>replacementScore(id,effectiveId,initialFilters([data.state?.coachProfile?.place,...(data.state?.coachProfile?.equipment??[])].join(' ')).equipment,data.state?.coachProfile?.cautions)}/><p aria-live="polite">{replacement?`${t.replacement}: ${name(replacement)}`:t.choose}</p><label>{t.reasonLabel}<select aria-label={t.reasonLabel} value={reason} onChange={e=>setReason(e.target.value as typeof reason)}><option value="other">{t.other}</option><option value="discomfort">{t.discomfort}</option></select></label><Button disabled={!replacement||!allowedSwapIds.includes(replacement)||busy} onClick={()=>void run(async()=>{await workflow.substitute(active.id,item.itemIndex,replacement,reason);setPanel(undefined);})}>{t.confirm}</Button></>:null}
 </div></MorphPanel>
 </main>;
}



