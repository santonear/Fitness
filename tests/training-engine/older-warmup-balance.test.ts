import {prescribe} from '../../src/engine/dose';
import {safety} from '../../src/engine/gates/strength-scoring';
import {scorePlan} from '../../src/engine/score';
import {checkHard} from '../../src/engine/hard-checks';
import {runGates} from '../../src/engine/gates';
import {expect,it} from 'vitest';
import {generatePlan,validatePlan} from '../../src/engine';
import {DATA,Rules} from '../../src/engine/data';

import {goldenProfiles} from '../../tools/eval/training-engine-profiles';

const rules=new Rules(),profile=goldenProfiles.find(row=>row.id==='older70-unrestricted')!.profile,plan=generatePlan(profile);
const actualBalance=(id:string)=>rules.byExercise.get(id)?.primary_pattern==='balance';
const secondsPerDay=(next:typeof plan)=>next.templates.map(t=>t.items.filter(i=>actualBalance(i.exerciseId)).reduce((n,i)=>n+('durationSeconds'in i.target?i.sets*i.target.durationSeconds*(i.prescription?.perSide||rules.byExercise.get(i.exerciseId)?.time.per_side?rules.get('session.time.model').per_side_multiplier:1):0),0));
it('counts real source-prescribed non-cooldown balance on three distinct days',()=>{
 const required=rules.get('older.week.multicomponent').balance_functional_days_per_week.min;
 expect(required).toBe(3);
 expect(plan.templates).toHaveLength(required);
 for(const template of plan.templates){
  const balance=template.items.filter(item=>actualBalance(item.exerciseId));expect(balance.length).toBeGreaterThan(0);
  for(const item of balance){
   const exercise=rules.byExercise.get(item.exerciseId)!;expect(item.prescription?.block).not.toBe('cooldown');expect(item.sets).toBeGreaterThan(0);expect(Number.isInteger(item.sets)).toBe(true);expect('durationSeconds'in item.target).toBe(true);
   if('durationSeconds'in item.target){const range=exercise.modality==='isometric'?rules.get('dose.isometric')[profile.level].hold_s:exercise.default_dose[profile.level]?.seconds;expect(range).toBeDefined();expect(item.target.durationSeconds).toBeGreaterThanOrEqual(range![0]);expect(item.target.durationSeconds).toBeLessThanOrEqual(range![1]);}
  }
 }
 expect(validatePlan(plan,profile).filter(issue=>issue.code==='balance_days')).toEqual([]);
 expect(validatePlan(plan,profile).filter(issue=>issue.severity==='error'&&!['goal_time_share','goal_time_share_joint'].includes(issue.code))).toEqual([]);
});
it('still rejects two actual days and cannot count two balance actions on one day as three days',()=>{
 const next=structuredClone(plan),removed=next.templates[0].items.find(item=>actualBalance(item.exerciseId))!;
 next.templates[0].items=next.templates[0].items.filter(item=>!actualBalance(item.exerciseId));
 next.templates[1].items.push(structuredClone(removed));
 expect(validatePlan(next,profile).some(issue=>issue.code==='balance_days'&&issue.severity==='error')).toBe(true);
});
it('never counts a cardio exercise merely labelled as balance',()=>{
 const next=structuredClone(plan),template=next.templates[0];
 const cardio=rules.data.exercises.find(e=>e.slug==='custom-quiet-march')!;const replacement=prescribe(cardio,profile,rules,safety(profile,rules),'balance',1);expect(rules.byExercise.get(replacement.exerciseId)?.primary_pattern).not.toBe('balance');
 template.items=template.items.filter(item=>!actualBalance(item.exerciseId));replacement.prescription!.pattern='balance';template.items.push(replacement);
 expect(validatePlan(next,profile).some(issue=>issue.code==='balance_days'&&issue.severity==='error')).toBe(true);
});
it.each([1,121])('measures the %s-second warmup balance source target deviation without inventing a day-count error',seconds=>{
 const next=structuredClone(plan);for(const item of next.templates.flatMap(template=>template.items))if(actualBalance(item.exerciseId)){item.prescription!.block='warmup';item.sets=1;item.target={metricType:'duration',durationSeconds:seconds};}
 expect(scorePlan(next,profile,rules).perRule.find(row=>row.id==='session.warmup.balance_older')!.satisfaction).toBeLessThan(1);expect(validatePlan(next,profile).some(issue=>issue.code==='balance_days')).toBe(false);
});
it('keeps warmup duration applicability separate from formal balance days and respects the source warmup credit switch',()=>{
 const next=structuredClone(plan);for(const item of next.templates.flatMap(t=>t.items))if(actualBalance(item.exerciseId)){item.prescription!.block='warmup';item.prescription!.block='warmup';item.sets=1;item.prescription!.perSide=true;item.target={metricType:'duration',durationSeconds:30};}
 const short={...profile,sessionMinutes:rules.get('session.warmup.balance_older').min_session_minutes-1};expect(scorePlan(next,short,rules).perRule.some(row=>row.id==='session.warmup.balance_older')).toBe(false);expect(validatePlan(next,short).some(issue=>issue.code==='balance_days')).toBe(false);
 const data=structuredClone(DATA),source=data.rules.find(rule=>rule.id==='session.warmup.balance_older')!;source.value!.counts_toward_balance_days=false;const disabled=new Rules(data),gate=runGates(profile,disabled);
 expect(checkHard(next,profile,gate,disabled).some(issue=>issue.code==='balance_days')).toBe(true);expect(checkHard(plan,profile,gate,disabled).some(issue=>issue.code==='balance_days')).toBe(false);
});
it('counts actual per-side warmup work instead of treating thirty seconds on both sides as thirty total',()=>{
 const next=structuredClone(plan);
 for(const item of next.templates.flatMap(template=>template.items))if(actualBalance(item.exerciseId)){item.prescription!.block='warmup';item.sets=1;item.prescription!.perSide=true;item.target={metricType:'duration',durationSeconds:30};}
 expect(secondsPerDay(next)).toEqual(next.templates.map(()=>60));expect(rules.get('session.time.model').per_side_multiplier).toBe(2);expect(validatePlan(next,profile).some(issue=>issue.code==='balance_days')).toBe(false);expect(scorePlan(next,profile,rules).perRule.find(row=>row.id==='session.warmup.balance_older')!.satisfaction).toBe(1);
 for(const item of next.templates.flatMap(template=>template.items))if(actualBalance(item.exerciseId))item.target={metricType:'duration',durationSeconds:29};
 expect(secondsPerDay(next)).toEqual(next.templates.map(()=>58));
 expect(scorePlan(next,profile,rules).perRule.find(row=>row.id==='session.warmup.balance_older')!.satisfaction).toBeLessThan(1);expect(validatePlan(next,profile).some(issue=>issue.code==='balance_days')).toBe(false);
});
it('accepts the actual 120-second upper warmup dose including both sides without imposing that warmup range on formal balance',()=>{
 const next=structuredClone(plan);
 for(const item of next.templates.flatMap(template=>template.items))if(actualBalance(item.exerciseId)){const e=rules.byExercise.get(item.exerciseId)!;item.prescription!.block='warmup';item.target={metricType:'duration',durationSeconds:120/(item.sets*(item.prescription?.perSide||e.time.per_side?rules.get('session.time.model').per_side_multiplier:1))};}
 expect(validatePlan(next,profile).some(issue=>issue.code==='balance_days')).toBe(false);
 for(const item of next.templates.flatMap(template=>template.items))if(actualBalance(item.exerciseId)){item.prescription!.block='balance';item.target={metricType:'duration',durationSeconds:1};}
 // The day-count assertion does not certify formal dose or other safety constraints.
 expect(validatePlan(next,profile).some(issue=>issue.code==='balance_days')).toBe(false);
});
