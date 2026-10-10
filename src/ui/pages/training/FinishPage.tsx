import { useState } from 'react';
import type { Feedback } from '../../../domain/v8/contracts';
import { Button,Chip } from '../../components/common';
import { useMainline,workflow,format } from '../../mainline/context';
const feels=['easy','right','tired','very_tired'] as const;
const reasons=['time','fatigue','discomfort','equipment_busy','not_today','other'] as const;
export function FinishPage(){
 const {data,facts,t,slots,name,run,navigate,busy}=useMainline();const [feedback,setFeedback]=useState<Feedback>({reasons:[]});const active=data?.active;
 if(!active)return <main><p>{t.noTraining}</p><Button onClick={()=>navigate('/')}>{t.next}</Button></main>;
 const done=active.sets.length,complete=done===active.plannedSetCount;
 const message=done===0?t.zeroMessage:complete?format(t.completeMessage,{count:(facts?.complete??0)+1}):format(t.partialMessage,{count:done});
 return <main><h1>{t.finish}</h1><slots.FeatureCard context="finish" motionReduced={false} trainingActive={false}><p>{message}</p><p>{done} / {active.plannedSetCount} {t.sets}</p></slots.FeatureCard>
 <fieldset><legend>{t.feel}</legend><div className="v8-capsules">{feels.map((feel,i)=><Chip key={feel} selected={feedback.feel===feel} onClick={()=>setFeedback({...feedback,feel:feedback.feel===feel?undefined:feel})}>{t.feelOptions[i]}</Chip>)}</div></fieldset>
 {!complete&&<fieldset><legend>{t.shortfall}</legend><div className="v8-capsules">{reasons.map((reason,i)=><Chip key={reason} selected={feedback.reasons.includes(reason)} onClick={()=>{const next=feedback.reasons.includes(reason)?feedback.reasons.filter(r=>r!==reason):[...feedback.reasons,reason];setFeedback({...feedback,reasons:next,...(!next.includes('discomfort')?{discomfortExerciseIds:undefined}:{})});}}>{t.reasonOptions[i]}</Chip>)}</div></fieldset>}
 {feedback.reasons.includes('discomfort')&&<fieldset><legend>{t.which}</legend><div className="v8-capsules">{[...new Set(active.sets.map(s=>s.exerciseId))].map(id=><Chip key={id} selected={feedback.discomfortExerciseIds?.includes(id)??false} onClick={()=>setFeedback({...feedback,discomfortExerciseIds:feedback.discomfortExerciseIds?.includes(id)?feedback.discomfortExerciseIds.filter(i=>i!==id):[...feedback.discomfortExerciseIds??[],id]})}>{name(id)}</Chip>)}</div></fieldset>}
 <label>{t.note}<textarea value={feedback.note??''} onChange={e=>setFeedback({...feedback,note:e.target.value})}/></label><Button variant="primary" disabled={busy} onClick={()=>void run(async()=>{await workflow.finish(active.id,feedback);navigate('/review');})}>{t.save}</Button></main>;
}
