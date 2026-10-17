import {Rules} from '../../../engine/data';
import {engineCopy} from '../../../coach/engine-copy';
export function cmrAnswerSummary(answers:Record<string,boolean>){const keys=new Rules().get('safety.screen.cmr_symptoms').symptoms as string[];return {complete:keys.every(key=>typeof answers[key]==='boolean'),symptoms:keys.some(key=>answers[key]===true)};}
/** Each missing answer stays unknown; selecting No is an explicit answer. */
export function CmrSymptomsQuestions({answers,onChange,locale}:{answers:Record<string,boolean>;onChange:(answers:Record<string,boolean>)=>void;locale:'zh'|'en'}){
 const keys=new Rules().get('safety.screen.cmr_symptoms').symptoms as string[];
 return <>{keys.map(key=><label key={key}>{engineCopy(`safety.copy.cmr_${key}`,locale)}<select value={typeof answers[key]==='boolean'?String(answers[key]):''} onChange={event=>{if(event.target.value!=='')onChange({...answers,[key]:event.target.value==='true'});}}><option value="">{locale==='zh'?'请选择':'Choose'}</option><option value="false">{locale==='zh'?'否':'No'}</option><option value="true">{locale==='zh'?'是':'Yes'}</option></select></label>)}</>;
}
