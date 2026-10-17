import {cardiacSymptomKeys} from '../../../application/training-stop';
import {engineCopy} from '../../../coach/engine-copy';
import {Button} from '../../components/common';

/** Labels are exact fragments of the approved six-item source copy, in source key order. */
export function cardiacStopOptions(locale:'zh'|'en'){
 const text=engineCopy('safety.copy.stop_symptoms',locale),separator=locale==='zh'?'：':':';
 const labels=text.slice(text.indexOf(separator)+1).split(locale==='zh'?'；':';').map(label=>label.trim().replace(/[。.]$/,''));
 if(labels.length!==cardiacSymptomKeys.length||labels.some(label=>!label||!text.includes(label)))throw Error('Missing approved cardiac symptom copy');
 return cardiacSymptomKeys.map((key,index)=>({key,label:labels[index]}));
}
export interface CardiacStopPanelProps {locale:'zh'|'en';busy?:boolean;paused?:boolean;onStop:(keys:readonly string[])=>unknown}
export function CardiacStopPanel({locale,busy,paused,onStop}:CardiacStopPanelProps){
 if(paused)return <section><p role="alert">{engineCopy('safety.copy.stop_emergency',locale)}</p></section>;
 return <section><p>{engineCopy('safety.copy.stop_symptoms',locale)}</p>{cardiacStopOptions(locale).map(option=><Button key={option.key} disabled={busy} onClick={()=>onStop([option.key])}>{option.label}</Button>)}</section>;
}
