import {Rules} from '../../../engine/data';
import type {WorkoutRecord} from '../../../domain/v8/contracts';
import {engineTrainingCopy} from '../../../i18n/features/training/engine';
import type {PainFollowupInput} from '../../../application/pain-followup';
import {useEffect,useState} from 'react';
import type {TrainingCheckinInput} from '../../../application/training-checkin';
import {JointPainCheckinFields} from './JointPainCheckinFields';
import {engineCopy} from '../../../coach/engine-copy';
import {useMainline,workflow} from '../../mainline/context';
import {useFeature} from '../../useFeature';
import {Button} from '../../components/common';

const followupRules=new Rules();
export function PainFollowupFields({answers,onChange,locale,workouts=[]}:{answers:PainFollowupInput;onChange:(answers:PainFollowupInput)=>void;locale:'zh'|'en';workouts?:WorkoutRecord[]}){
 const t=engineTrainingCopy[locale],zh=locale==='zh';
 const [selection,setSelection]=useState(answers.painFollowup?JSON.stringify([answers.painFollowup.workoutId,answers.painFollowup.itemIndex]):''),[area,setArea]=useState(answers.painFollowup?.painArea);
 const choices=workouts.filter(w=>['complete','partial'].includes(w.status)&&w.endedAt).flatMap(w=>[...new Set(w.sets.map(s=>s.itemIndex))].flatMap(index=>{const ids=[...new Set(w.sets.filter(s=>s.itemIndex===index).map(s=>s.exerciseId))],e=ids.length===1?followupRules.byExercise.get(ids[0]):undefined;return e?[{value:JSON.stringify([w.id,index]),name:`${w.localDate} · ${e.name[locale]}`}]:[]}));
 function link(value:string,nextArea:typeof area){setSelection(value);setArea(nextArea);const pair=value?JSON.parse(value) as [string,number]:undefined;onChange({...answers,painFollowup:pair&&nextArea?{workoutId:pair[0],itemIndex:pair[1],painArea:nextArea}:undefined});}
 return <>{(['painLastedToNextMorning','painOrStiffnessWorseThanLastWeek'] as const).map((key,index)=><label key={key}>{(zh?['上次的疼痛是否持续到第二天早上','疼痛或僵硬是否比上周更重']:['Did the pain from your last session last until the next morning?','Is the pain or stiffness worse than last week?'])[index]}<select value={answers[key]===undefined?'':String(answers[key])} onChange={event=>onChange({...answers,[key]:event.target.value===''?undefined:event.target.value==='true'})}><option value="">{zh?'请选择':'Choose'}</option><option value="true">{zh?'是':'Yes'}</option><option value="false">{zh?'否':'No'}</option></select></label>)}
 {(answers.painLastedToNextMorning===true||answers.painOrStiffnessWorseThanLastWeek===true)&&<><select aria-label={t.choose} value={selection} onChange={event=>link(event.target.value,area)}><option value="">{t.choose}</option>{choices.map(choice=><option key={choice.value} value={choice.value}>{choice.name}</option>)}</select><label>{t.area}<select value={area??''} onChange={event=>link(selection,event.target.value as typeof area||undefined)}><option value="">{t.choose}</option>{(['knee','back','shoulder','wrist','other'] as const).map((value,index)=><option key={value} value={value}>{t.areas[index]}</option>)}</select></label></>}
 </>;
}
export function TrainingCheckinFields({answers,onChange,locale,disabled,workouts=[]}:{answers:TrainingCheckinInput;onChange:(answers:TrainingCheckinInput)=>void;locale:'zh'|'en';disabled:boolean;workouts?:WorkoutRecord[]}){
 const zh=locale==='zh',hasPreviousTraining=workouts.some(workout=>['complete','partial'].includes(workout.status)&&!!workout.endedAt&&workout.sets.length>0);
 return <fieldset disabled={disabled}>
  {hasPreviousTraining&&<PainFollowupFields answers={answers} onChange={next=>onChange({...answers,...next})} locale={locale} workouts={workouts}/>}
  <label>{engineCopy('deload.copy.checkin.0',locale)}<select value={answers.energyMotivation??''} onChange={event=>onChange({...answers,energyMotivation:event.target.value?Number(event.target.value):undefined})}><option value="">{zh?'请选择':'Choose'}</option>{[1,2,3,4,5].map(value=><option key={value}>{value}</option>)}</select></label>
  {hasPreviousTraining&&<label>{engineCopy('deload.copy.checkin.1',locale)}<input type="number" min="0" max="30" step="1" value={answers.poorSleepNights??''} onChange={event=>{const value=event.target.value===''?undefined:Number(event.target.value);if(value===undefined||Number.isInteger(value)&&value>=0&&value<=30)onChange({...answers,poorSleepNights:value});}}/></label>}
  {(['sorenessResolved','newOrWorseJointPain'] as const).map((key,index)=>hasPreviousTraining||key==='newOrWorseJointPain'?<label key={key}>{engineCopy(`deload.copy.checkin.${index+2}`,locale)}<select value={answers[key]===undefined?'':String(answers[key])} onChange={event=>{const answer=event.target.value===''?undefined:event.target.value==='true';onChange({...answers,[key]:answer,...(key==='newOrWorseJointPain'&&answer!==true?{jointPain:undefined}:{})});}}><option value="">{zh?'请选择':'Choose'}</option><option value="true">{zh?'是':'Yes'}</option><option value="false">{zh?'否':'No'}</option></select></label>:null)}
  {(answers.newOrWorseJointPain===true||hasPreviousTraining&&(answers.painLastedToNextMorning===true||answers.painOrStiffnessWorseThanLastWeek===true))&&<><p role="status">{engineCopy('pain.copy.stop_exercise',locale)}</p><JointPainCheckinFields value={{...answers.jointPain,...(answers.painFollowup?{painArea:answers.painFollowup.painArea}:{})}} onChange={jointPain=>onChange({...answers,jointPain})} locale={locale} disabled={disabled}/></>}
 </fieldset>;
}
function ConsentedCheckin(){
 const c=useMainline(),revision=c.data!.metadata.dataRevision;
 const [draft,setDraft]=useState<{revision:number;answers:TrainingCheckinInput}>();
 useEffect(()=>{let alive=true;void workflow.pendingTrainingCheckin().then(answers=>{if(alive)setDraft({revision,answers:answers??{}})}).catch(()=>{if(alive)setDraft(undefined)});return()=>{alive=false}},[revision]);
 const ready=draft?.revision===revision;
 return <section><TrainingCheckinFields answers={ready?draft.answers:{}} onChange={answers=>setDraft({revision,answers})} locale={c.locale} disabled={c.busy||!ready} workouts={c.data?.workouts??[]}/><Button disabled={c.busy||!ready} onClick={()=>void c.run(async()=>{await workflow.saveTrainingCheckin(draft!.answers,revision);await c.reload();})}>{c.t.confirm}</Button></section>;
}
export function PreTrainingCheckin(){
 const enabled=useFeature('trainingEngine'),c=useMainline();
 return enabled&&c.data?.state?.coachProfile?.healthStorageConsent&&!c.data.active?<ConsentedCheckin/>:null;
}
