import type {ProgressionResult} from '../../../engine/contracts';
import type {PlannedItem} from '../../../domain/v8/contracts';
import {engineTrainingCopy} from '../../../i18n/features/training/engine';
export function targetChanges(before:PlannedItem,after:PlannedItem,locale:'zh'|'en'){
 const t=engineTrainingCopy[locale],changes:string[]=[];
 const signed=(value:number)=>value>0?`+${value}`:String(value);
 if(before.sets!==after.sets)changes.push(`${signed(after.sets-before.sets)} ${t.sets}`);
 if('reps'in before.target&&'reps'in after.target&&before.target.reps!==after.target.reps)changes.push(`${signed(after.target.reps-before.target.reps)} ${t.reps}`);
 if('loadGrams'in before.target&&'loadGrams'in after.target&&(before.target.loadGrams??0)!==(after.target.loadGrams??0))changes.push(`${signed(((after.target.loadGrams??0)-(before.target.loadGrams??0))/1000)} ${t.kg}`);
 if('durationSeconds'in before.target&&'durationSeconds'in after.target&&before.target.durationSeconds!==after.target.durationSeconds)changes.push(`${signed(after.target.durationSeconds-before.target.durationSeconds)} ${t.seconds}`);
 return changes.join(' · ');
}
export function TargetChanges({suggestions,templateId,locale,name}:{suggestions:ProgressionResult['suggestions'];templateId:string;locale:'zh'|'en';name:(id:string)=>string}){
 const changes=suggestions.filter(suggestion=>suggestion.templateId===templateId);
 if(!changes.length)return null;
 return <section><h2>{engineTrainingCopy[locale].next}</h2><ul>{changes.map(suggestion=><li key={suggestion.itemIndex}>{name(suggestion.before.exerciseId)}{suggestion.before.exerciseId!==suggestion.after.exerciseId?` → ${name(suggestion.after.exerciseId)}`:''} · {targetChanges(suggestion.before,suggestion.after,locale)}</li>)}</ul></section>;
}
