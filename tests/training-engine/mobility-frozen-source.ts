import type {EnginePlan} from '../../src/engine/contracts';
import {Rules} from '../../src/engine/data';
import frozen from '../fixtures/training-engine/mobility6x90-682989c.json';
import {independentElapsedAllocation} from '../unit/engine/reference/training-engine-goal-share';

/** Counterfactual source correction; the original frozen bytes remain an invalid-dose fixture. */
export function mobilityFrozenSource():EnginePlan{
 const plan=structuredClone(frozen) as EnginePlan,r=new Rules();
 for(const template of plan.templates){
  for(const item of template.items){
   const exercise=r.byExercise.get(item.exerciseId);
   if(item.prescription?.block==='warmup'&&exercise?.modality==='cardio'&&'durationSeconds'in item.target){
    item.target.durationSeconds=r.get('session.warmup.general').seconds_by_duration['90'][1];
   }
  }
  // The source overrun order permits omitting conditioning; never reinterpret 4x45 as continuous CN1.
  template.items=template.items.filter(item=>item.prescription?.block!=='conditioning');
  template.estimatedSeconds=independentElapsedAllocation({templates:[template]}).total;
  template.estimatedMinutes=Math.ceil(template.estimatedSeconds/60);
 }
 return plan;
}
