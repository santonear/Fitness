import {Rules} from '../../src/engine/data';
import type {EngineProfile} from '../../src/engine/contracts';
import {describe,expect,it} from 'vitest';
import {generatePlan,validatePlan} from '../../src/engine';
import {enginePlanSchema,engineProfileSchema} from '../../src/engine/contracts';
import {goldenProfiles} from '../../tools/eval/training-engine-profiles';
import index from '../../src/engine/generated/exercise-index.json';
import {externalIssues} from '../../tools/eval/training-engine-invariants';
import inputs from '../../tools/eval/training-engine-golden-inputs.json';
import {independentlyRepeatedExerciseIds} from './reference/independent-ramp-repeat';

// Independent expectation reads the approved source mechanic, never production eligibility.
const household=new Rules().get('environment.household_support');
function independentlyOwned(profile:EngineProfile){const support=profile.householdSupport??household.default_places.includes(profile.place);return new Set<string>(['none','yoga-mat-optional',...profile.equipment,...(support?household.equipment:[])]);}

/** Each fixture generates its plan twice; on a busy shared runner mobility6x90 exceeded the 5 s default. */
const GOLDEN_TIMEOUT_MS=20000;
describe('20 explicit synthetic golden profiles',()=>{
 it('keeps all 20 reviewable input fixtures in sync with the fixed generator',()=>{expect(inputs).toEqual(goldenProfiles);expect(inputs).toHaveLength(20);});
 for(const fixture of goldenProfiles)it(fixture.id,()=>{
  engineProfileSchema.parse(fixture.profile);
  const plan=generatePlan(fixture.profile),issues=validatePlan(plan,fixture.profile);
  enginePlanSchema.parse(plan);
  expect(issues.filter(issue=>issue.severity==='error')).toEqual([]);
  expect(externalIssues(plan,fixture.profile)).toEqual([]);
  expect(generatePlan(fixture.profile)).toEqual(plan);
  if(fixture.expectedBlocked){expect(plan.gates.some(gate=>gate.status==='blocked')).toBe(true);expect(plan.templates).toEqual([]);}
  for(const template of plan.templates){
   expect(independentlyRepeatedExerciseIds(template,fixture.profile)).toEqual([]);
   const conditioning=template.items.flatMap((item,index)=>item.prescription?.block==='conditioning'?[index]:[]),cooldown=template.items.findIndex(item=>item.prescription?.block==='cooldown');
   for(const [index,item]of template.items.entries())if(['main','accessory'].includes(item.prescription?.block??''))expect(conditioning.every(position=>position>index)).toBe(true);
   if(cooldown>=0)expect(template.items.slice(cooldown).every(item=>item.prescription?.block==='cooldown')).toBe(true);
   for(const item of template.items){
    const exercise=index.exercises.find(exercise=>exercise.id===item.exerciseId);
    expect(exercise).toBeDefined();if(!exercise)continue;
    const equipment=independentlyOwned(fixture.profile);
    for(const required of exercise.equipment_required)expect(required==='yoga-mat-optional'||equipment.has(required as never)||(exercise.equipment_alternatives as Record<string,string[]>)[required]?.some(alternative=>equipment.has(alternative as never)),`${fixture.id}: missing ${required} for ${exercise.slug}`).toBe(true);
    if(fixture.profile.constraints.quiet)expect(exercise.noise).toBe(0);
    if(fixture.profile.constraints.noJump)expect((exercise.flags as string[]).includes('jumping')).toBe(false);
    if(fixture.profile.population.kind==='pregnant'&&fixture.profile.population.week>=13){expect(exercise.position).not.toContain('supine');expect(exercise.position).not.toContain('prone');}
    if(item.target.metricType==='reps_load')expect(item.target.loadGrams>0||Boolean(item.prescription?.loadDescription?.zh&&item.prescription.loadDescription.en)).toBe(true);
   }
  }
  // Full output is reviewed for changes. Quality assertions remain separate from snapshots.
  expect({plan,issues}).toMatchSnapshot();
 },GOLDEN_TIMEOUT_MS);
});
