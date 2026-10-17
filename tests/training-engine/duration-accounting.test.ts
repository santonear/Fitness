import {independentElapsedAllocation} from '../unit/engine/reference/training-engine-goal-share';
import {independentDurationIssues} from '../unit/engine/reference/training-engine-goal-share';
import {scorePlan} from '../../src/engine/score';
import {describe,expect,it} from 'vitest';
import {estimatedSeconds} from '../../src/engine/fit/elapsed-time';
import {Rules} from '../../src/engine/data';

import type {Template} from '../../src/engine/dose';
import {generatePlan,validatePlan} from '../../src/engine';
import {blockSeconds} from '../../src/engine/fit/elapsed-time';
import {baseProfile,equipmentScenarios} from '../../tools/eval/training-engine-profiles';
import uiCounterexample from '../unit/engine/fixtures/v1-ui-duration.json';
import type {EngineProfile} from '../../src/engine/contracts';
import {independentWarmupAudit,independentlyApplicableSessionTypes} from '../unit/engine/reference/training-engine-session-time';
import {independentlyGroupedSeconds} from '../unit/engine/reference/training-engine-session-time';
import {EXERCISE_IDS} from '../../src/catalog/exercises';

describe('actual elapsed seconds across grouped prescriptions',()=>{
 it('counts both straight stations even when an old group ID remains on both prescriptions',()=>{
  const r=new Rules(),items:Template['items']=[EXERCISE_IDS.bodyweightSquat,EXERCISE_IDS.selfResistedRow].map(exerciseId=>({exerciseId,equipment:'none',sets:3,target:{metricType:'reps',reps:8},prescription:{pattern:r.byExercise.get(exerciseId)!.primary_pattern,block:'main',rir:[3,4],restSeconds:90,secondsPerRep:3,structure:'straight',groupId:'old-pair'}}));
  const t:Template={id:'straight-residue',name:'actual straight stations',estimatedMinutes:30,items},overhead=r.get('duration.set.overhead').overhead_s_per_set,buffer=r.get('duration.transition.setup').buffer_s;
  const expected=items.reduce((sum,i)=>sum+r.byExercise.get(i.exerciseId)!.time.setup_s+buffer+3*(8*3+overhead)+2*90,0);
  expect(estimatedSeconds(t,r)).toBe(expected);
 });
 it.each(['superset','circuit'] as const)('counts transitions only between actual remaining sets of an unequal %s',structure=>{
  const rules=new Rules(),items:Template['items']=[
   {exerciseId:EXERCISE_IDS.bodyweightSquat,equipment:'none',sets:1,target:{metricType:'reps',reps:8},prescription:{pattern:'squat',block:'main',rir:[3,4],restSeconds:90,structure,groupId:'unequal'}},
   {exerciseId:EXERCISE_IDS.selfResistedRow,equipment:'none',sets:3,target:{metricType:'reps',reps:8},prescription:{pattern:'pull_horizontal',block:'main',rir:[3,4],restSeconds:90,structure,groupId:'unequal'}},
  ];
  if(structure==='circuit')items.push({exerciseId:EXERCISE_IDS.plank,equipment:'none',sets:1,target:{metricType:'duration',durationSeconds:20},prescription:{pattern:'anti_extension',block:'accessory',rir:[3,4],restSeconds:90,structure,groupId:'unequal'}});
  const template:Template={id:'unequal',name:'合成不等组数',estimatedMinutes:30,items};
  expect(estimatedSeconds(template,rules)).toBe(independentlyGroupedSeconds(items,structure));
 });
 const warmupProfiles=[baseProfile({equipment:[...equipmentScenarios[3]]}),{...uiCounterexample.profile,screening:{...uiCounterexample.profile.screening,cmrSymptoms:baseProfile().screening.cmrSymptoms}} as EngineProfile,baseProfile({goal:'strength',level:'intermediate',trainingAgeWeeks:52,equipment:[...equipmentScenarios[4]],sessionMinutes:45})];
 it.each(warmupProfiles.flatMap((profile,index)=>[0,1,2,3].map(variant=>({profile,index,variant}))))('counts real warmup work and both sides for original profile $index variant $variant',({profile,variant})=>{
  const rules=new Rules(),generated=generatePlan(profile,{variant}),multiplier=rules.get('session.time.model').per_side_multiplier,overhead=rules.get('duration.set.overhead');
  expect(generated.templates.length).toBeGreaterThan(0);for(const template of generated.templates){let actual=0;
   for(const item of template.items.filter(item=>item.prescription?.block==='warmup')){
    const e=rules.byExercise.get(item.exerciseId)!,work='durationSeconds'in item.target?item.target.durationSeconds:'reps'in item.target?item.target.reps*(item.prescription?.secondsPerRep??e.time.s_per_rep??rules.get('duration.rep.seconds').default_if_unknown):0;expect(work).toBeGreaterThan(0);
    const sides=item.prescription?.perSide||e.time.per_side?multiplier:1;actual+=item.sets*(work*sides+(e.modality==='mobility'?overhead.mobility_overhead_s_per_set:overhead.overhead_s_per_set));
   }
   expect(blockSeconds(template,'warmup',rules)).toBe(actual);
   if(independentlyApplicableSessionTypes(template,profile).length){const audit=independentWarmupAudit(template,profile);expect(audit.issues).toEqual([]);if(audit.seconds<rules.get('safety.session.warmup_cooldown').warmup_min_minutes*60)expect(scorePlan({...generated,templates:[template]},profile,rules).perRule.find(row=>row.id==='safety.session.warmup_cooldown')!.satisfaction).toBeLessThan(1);}
   expect(estimatedSeconds(template,rules)).toBeCloseTo(independentElapsedAllocation({templates:[template]}).total,6);expect(independentDurationIssues({...generated,templates:[template]},profile)).toEqual([]);expect(validatePlan({...generated,templates:[template]},profile).filter(i=>i.severity==='error')).toEqual([]);
  }
 });
 it('counts a real per-side dynamic source warmup independently of candidate ordering',()=>{
  const rules=new Rules(),e=rules.data.exercises.find(e=>e.mobility_type==='dynamic'&&e.time.per_side&&e.use.includes('warmup'))!;expect(e).toBeDefined();
  const multiplier=rules.get('session.time.model').per_side_multiplier,duration=rules.get('session.warmup.dynamic').seconds[0]/multiplier,item:Template['items'][number]={exerciseId:e.id,equipment:'none',sets:1,target:{metricType:'duration',durationSeconds:duration},prescription:{pattern:e.primary_pattern,block:'warmup',rir:[3,4],restSeconds:0,perSide:true}};
  expect(blockSeconds({id:'real-sided-warmup',name:'side accounting',estimatedMinutes:1,items:[item]},'warmup',rules)).toBe(duration*multiplier+rules.get('duration.set.overhead').mobility_overhead_s_per_set);
 }); it('includes the second grouped member ramp instead of silently discarding it',()=>{
  const rules=new Rules(),ramp=rules.get('duration.ramp.sets').first_loaded_compound.ramp_s;
  expect(ramp).toBe(180);
  const template:Template={id:'ramp-group',name:'合成计时验证',estimatedMinutes:30,items:[
   {exerciseId:'d16325d9-fc00-4c41-88a1-000000000001',equipment:'dumbbell',sets:2,target:{metricType:'reps_load',reps:10,loadGrams:10000},prescription:{pattern:'squat',block:'main',rir:[3,4],restSeconds:90,structure:'superset',groupId:'pair',warmupSeconds:0}},
   {exerciseId:'d16325d9-fc00-4c41-88a1-000000000003',equipment:'none',sets:2,target:{metricType:'reps',reps:10},prescription:{pattern:'squat',block:'accessory',rir:[3,4],restSeconds:90,structure:'superset',groupId:'pair',warmupSeconds:0}},
  ]};
  const baseline=estimatedSeconds(template,rules);template.items[1].prescription!.warmupSeconds=ramp;
  expect(estimatedSeconds(template,rules)-baseline).toBe(ramp);
 });
});

