import {expect,it} from 'vitest';
import {Rules} from '../../../src/engine/data';
import {checkHard} from '../../../src/engine/hard-checks';
import {runGates} from '../../../src/engine/gates';
import {baseProfile} from '../../../tools/eval/training-engine-profiles';
import {boundedCardioPlanFixture as planFixture} from './bounded-cardio-fixture';
const rules=new Rules();
function inspect(weeks:number,reps:number,restSeconds:number){
 const profile=baseProfile({goal:'health',level:'beginner',trainingAgeWeeks:weeks,sessionMinutes:10,daysPerWeek:1,constraints:{noJump:false,quiet:false,space:'large'}}),plan=planFixture();
 const e=rules.data.exercises.find(e=>e.slug==='bodyweight-squat')!;
 expect(e.nsca_class).toBe('compound');
 plan.templates[0].items.unshift({exerciseId:e.id,equipment:'none',sets:2,target:{metricType:'reps',reps},prescription:{pattern:e.primary_pattern,block:'main',rir:[3,3],restSeconds,secondsPerRep:3,structure:'straight'}});
 return checkHard(plan,profile,runGates(profile,rules),rules);
}
it('rejects six-repetition beginner work before the source twelve-week unlock outside strength goal',()=>{
 const week=rules.get('dose.reps.bounds').beginner_min_reps_le_6_unlock_weeks;
 expect(week).toBe(12);expect(inspect(week-1,6,60)).toContainEqual(expect.objectContaining({ruleId:'dose.reps.bounds',severity:'error',itemIndex:0}));
});
it('permits the same six-repetition work at the source unlock boundary without a reps-bound error',()=>{
 const week=rules.get('dose.reps.bounds').beginner_min_reps_le_6_unlock_weeks;
 expect(inspect(week,6,60).filter(issue=>issue.ruleId==='dose.reps.bounds')).toEqual([]);
});
it('rejects zero rest for an ordinary two-set compound main exercise',()=>{
 expect(inspect(5,12,0)).toContainEqual(expect.objectContaining({ruleId:'duration.fit.bounds',severity:'error',itemIndex:0}));
});
it('allows the source compound rest floor with otherwise identical actual facts',()=>{
 const rest=rules.get('duration.fit.bounds').rest_floor_s.compound;expect(rest).toBe(60);expect(inspect(5,12,rest)).toEqual([]);
});
it('uses the authored accessory role instead of a main container for the strength rest minimum',()=>{
 const profile=baseProfile({goal:'strength',level:'intermediate',trainingAgeWeeks:52,daysPerWeek:1}),plan=planFixture(),e=rules.data.exercises.find(e=>e.slug==='bodyweight-squat')!;
 const floor=rules.get('duration.fit.bounds').rest_floor_s.compound;
 plan.templates[0].items.unshift({exerciseId:e.id,equipment:'none',sets:2,target:{metricType:'reps',reps:10},prescription:{pattern:e.primary_pattern,block:'main',goalRole:'accessory',rir:[3,3],restSeconds:floor,secondsPerRep:3,structure:'straight'}});
 const issues=()=>checkHard(plan,profile,runGates(profile,rules),rules).filter(issue=>issue.code==='rest_floor');
 expect(issues()).toEqual([]);
 plan.templates[0].items[0].prescription!.goalRole='main';
 expect(issues()).toContainEqual(expect.objectContaining({ruleId:'duration.fit.bounds',itemIndex:0}));
});
