import {useEffect,useRef,useState} from 'react';
import {pendingPainReviews} from '../../application/pain-events';
import type {PainFeedbackPreview} from '../../application/training-pain';
import {engineCopy} from '../../coach/engine-copy';
import {useMainline,workflow} from '../mainline/context';
import {PainFeedbackPanel} from '../pages/training/PainFeedbackPanel';
import {Button} from './common';

/** Existing unanswered safety reviews remain reachable even after engine rollout is disabled. */
export function PendingPainReview({onComplete}:{onComplete?:()=>void}={}){
 const c=useMainline(),pending=pendingPainReviews(c.data?.workouts??[])[0];
 const sequence=useRef(0);
 const [loading,setLoading]=useState(false);
 const [preview,setPreview]=useState<{key:string;revision:number;value:PainFeedbackPreview}>(),[failed,setFailed]=useState(false);
 const key=pending?`${pending.workoutId}:${pending.event.id}`:undefined,revision=c.data?.metadata.dataRevision;
 const consent=!!c.data?.state?.coachProfile?.healthStorageConsent?.acceptedAt;
 useEffect(()=>{let alive=true;const serial=++sequence.current;setPreview(undefined);setFailed(false);setLoading(false);if(!pending||!key||revision===undefined||!consent)return;
  void workflow.painFeedbackPreview(pending.workoutId,pending.event.id).then(value=>{if(alive&&serial===sequence.current)setPreview({key,revision,value});}).catch(()=>{if(alive)setFailed(true)});return()=>{alive=false;sequence.current++};
 },[key,revision,consent]);
 if(!pending)return null;
 if(!consent)return <section><p>{engineCopy('safety.copy.local_health_consent',c.locale)}</p><Button onClick={()=>c.navigate('/settings/engine')}>{c.t.settings}</Button></section>;
 const ended=c.data?.workouts.find(row=>row.id===pending.workoutId)?.status!=='in_progress';
 const current=preview&&preview.key===key&&preview.revision===revision?preview.value:undefined;
 return <section><p>{c.name(pending.event.exerciseId)}</p>{failed&&<p role="alert">{engineCopy('engine.copy.unavailable',c.locale)}</p>}{current&&<PainFeedbackPanel key={key} reviewOnly={ended} preview={current} locale={c.locale} busy={c.busy||loading} name={c.name} confirmLabel={c.t.confirm} onAnswersChange={answers=>{const serial=++sequence.current;if(!current.questions.every(question=>typeof answers[question.key]==='boolean')){setLoading(false);setPreview({key:key!,revision:revision!,value:{...current,replacement:undefined,redFlagsRequired:true}});return;}setLoading(true);void workflow.painFeedbackPreview(pending.workoutId,pending.event.id,answers).then(value=>{if(serial===sequence.current){setPreview({key:key!,revision:revision!,value});setLoading(false);}}).catch(()=>{if(serial===sequence.current){setFailed(true);setPreview(undefined);setLoading(false);}});}} onApply={answers=>void c.run(async()=>{
  const active=c.data?.workouts.find(row=>row.id===pending.workoutId)?.status==='in_progress';
  if(active)await workflow.applyPainFeedback(pending.workoutId,pending.event.id,c.data!.metadata.dataRevision,answers);
  else await workflow.completePastPainReview(pending.workoutId,pending.event.id,c.data!.metadata.dataRevision,answers);
  onComplete?.();
 })}/>}</section>;
}
