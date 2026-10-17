import {expect,it} from 'vitest';
import {allocatedVolumeCapacity} from '../../../src/engine/dose';
import {Rules} from '../../../src/engine/data';
import {runGates} from '../../../src/engine/gates';
import {targetSatisfactions,intervalSatisfaction} from '../../../src/engine/score';
import {fixtureProfile,planFixture} from './fixtures';
const rules=new Rules();
it.each(['beginner','intermediate'] as const)('uses a time-feasible lower bound but retains the %s upper bound and weight',level=>{
 const p={...fixtureProfile,level,trainingAgeWeeks:52,daysPerWeek:1,sessionMinutes:20},id=`dose.sets_week.${level}`,rule=rules.byId.get(id)!,before=structuredClone(rule),capacity=allocatedVolumeCapacity(p,runGates(p,rules),rules),groups=rules.get('dose.muscle_groups').target_groups as string[],v=rule.value!;
 for(const actual of [1,4,40]){const sets=Object.fromEntries(groups.map(group=>[group,actual])),expected=groups.reduce((sum,group)=>sum+intervalSatisfaction(actual,capacity.byMuscle[group]!==null&&capacity.byMuscle[group]!>0?Math.min(v.default_min,capacity.byMuscle[group]!):v.default_min,v.default_max),0)/groups.length;
  expect(targetSatisfactions[id]({plan:planFixture(),p,r:rules,f:{sets} as never,v})).toBeCloseTo(expected,12);
 }
 expect(rule).toEqual(before);
});
it('keeps the original lower bound when the complete legal pool is missing',()=>{
 const p={...fixtureProfile,trainingAgeWeeks:52,preferences:{...fixtureProfile.preferences,excludedExerciseIds:rules.data.exercises.map(e=>e.id)}},v=rules.get('dose.sets_week.beginner'),sets=Object.fromEntries(rules.get('dose.muscle_groups').target_groups.map((group:string)=>[group,1]));
 expect(targetSatisfactions['dose.sets_week.beginner']({plan:planFixture(),p,r:rules,f:{sets} as never,v})).toBeCloseTo(1/v.default_min,12);
});
it('invalidates cached capacities when the same profile object changes',()=>{
 const p={...fixtureProfile,trainingAgeWeeks:52,sessionMinutes:10},v=rules.get(`dose.sets_week.${p.level}`),groups=rules.get('dose.muscle_groups').target_groups as string[],sets=Object.fromEntries(groups.map(group=>[group,1])),row=()=>targetSatisfactions[`dose.sets_week.${p.level}`]({plan:planFixture(),p,r:rules,f:{sets} as never,v});
 row();p.sessionMinutes=60;const capacity=allocatedVolumeCapacity(p,runGates(p,rules),rules),expected=groups.reduce((sum,group)=>sum+intervalSatisfaction(1,capacity.byMuscle[group]!==null&&capacity.byMuscle[group]!>0?Math.min(v.default_min,capacity.byMuscle[group]!):v.default_min,v.default_max),0)/groups.length;
 expect(row()).toBeCloseTo(expected,12);
});
