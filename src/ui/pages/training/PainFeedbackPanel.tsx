import {useState} from 'react';
import type {PainFeedbackPreview} from '../../../application/training-pain';
import {engineCopy} from '../../../coach/engine-copy';
import {Button,Chip} from '../../components/common';
import {PrescriptionDetails} from './PrescriptionDetails';

export function PainFeedbackPanel({preview,locale,busy,name,confirmLabel,onApply,onAnswersChange,reviewOnly=false}:{preview:PainFeedbackPreview;locale:'zh'|'en';busy:boolean;name:(id:string)=>string;confirmLabel:string;onApply:(answers:Record<string,boolean>)=>void;onAnswersChange?:(answers:Record<string,boolean>)=>void;reviewOnly?:boolean}){
 const [answers,setAnswers]=useState<Record<string,boolean>>({});
 const positive=Object.values(answers).some(Boolean);
 const complete=preview.questions.every(question=>typeof answers[question.key]==='boolean');
 return <section>{preview.notices.map((notice,index)=><p role="status" key={index}>{notice}</p>)}{!reviewOnly&&preview.replacement&&!preview.blocked&&!positive&&<div><p>{name(preview.replacement.exerciseId)} · {preview.replacement.sets} {locale==='zh'?'组':'sets'} · {'reps'in preview.replacement.target?`${preview.replacement.target.reps} ${locale==='zh'?'次':'reps'}`:'durationSeconds'in preview.replacement.target?`${preview.replacement.target.durationSeconds} ${locale==='zh'?'秒':'seconds'}`:''}</p><PrescriptionDetails prescription={preview.replacement.prescription} locale={locale}/></div>}{!preview.applied&&preview.action!=='none'&&<><fieldset disabled={busy}>{preview.questions.map(question=><fieldset key={question.key}><legend>{engineCopy(question.copyKey,locale)}</legend>{([true,false] as const).map(answer=><Chip key={String(answer)} selected={answers[question.key]===answer} onClick={()=>{const next={...answers};if(next[question.key]===answer)delete next[question.key];else next[question.key]=answer;setAnswers(next);onAnswersChange?.(next);}}>{locale==='zh'?(answer?'是':'否'):(answer?'Yes':'No')}</Chip>)}</fieldset>)}</fieldset>{!reviewOnly&&complete&&preview.action==='substitute'&&!preview.replacement&&!preview.blocked&&!positive&&!positive&&<p role="status">{engineCopy('engine.copy.unavailable',locale)}</p>}<Button disabled={busy||!complete||!reviewOnly&&preview.action==='substitute'&&!preview.replacement&&!preview.blocked&&!positive&&!positive} onClick={()=>onApply(answers)}>{confirmLabel}</Button></>}</section>;
}
