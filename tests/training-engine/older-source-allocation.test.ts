import {scorePlan} from '../../src/engine/score';
import {expect,it} from 'vitest';
import {generatePlan,validatePlan} from '../../src/engine';
import {Rules} from '../../src/engine/data';
import {goldenProfiles} from '../../tools/eval/training-engine-profiles';
import {externalIssues} from '../../tools/eval/training-engine-invariants';
const rules=new Rules(),profile=goldenProfiles.find(x=>x.id==='older70-unrestricted')!.profile;

it('fits the unchanged older profile with genuine source doses, muscle days and elapsed shares',()=>{
 const before=structuredClone(profile),plan=generatePlan(profile);
 expect(validatePlan(plan,profile).filter(x=>x.severity==='error')).toEqual([]);
 expect(externalIssues(plan,profile)).toEqual([]);
 expect(plan.quality?.issues?.filter(i=>i.severity==='error')).toEqual([]);expect(scorePlan(plan,profile,rules).quality).toBe(plan.quality?.score);
 const expected=Math.min(profile.daysPerWeek,rules.get('goal.params.health').rt_sessions_week.max,rules.get('older.week.strength').days_per_week.max);expect(plan.templates.filter(t=>t.items.some(i=>i.prescription?.block==='main'))).toHaveLength(expected);
 expect(plan.trace.find(t=>t.ruleId==='week.days.allocation'&&t.reason==='source_rotation_and_goal_allocation')?.details?.rtDays).toBe(expected);
 expect(profile).toEqual(before);
});
it('retains real balance days and measures the separate warmup balance target across both sides',()=>{
 const plan=generatePlan(profile),source=rules.get('session.warmup.balance_older'),side=rules.get('session.time.model').per_side_multiplier;
 expect(plan.templates).toHaveLength(rules.get('older.template.balance_required').hard_balance_days_min);
 let warmupShortfall=false;
 for(const t of plan.templates){
  const balance=t.items.filter(i=>i.prescription?.block!=='cooldown'&&rules.byExercise.get(i.exerciseId)?.primary_pattern==='balance');
  expect(balance.length).toBeGreaterThanOrEqual(rules.get('older.template.balance_required').balance_items_per_session_min);
  for(const item of balance){const e=rules.byExercise.get(item.exerciseId)!;expect('durationSeconds'in item.target).toBe(true);if('durationSeconds'in item.target){expect(Number.isInteger(item.target.durationSeconds)).toBe(true);const range=e.modality==='isometric'?rules.get('dose.isometric')[profile.level].hold_s:e.default_dose[profile.level]?.seconds;expect(range).toBeDefined();expect(item.target.durationSeconds).toBeGreaterThanOrEqual(range![0]);expect(item.target.durationSeconds).toBeLessThanOrEqual(range![1]);const actual=item.sets*item.target.durationSeconds*(item.prescription?.perSide||e.time.per_side?side:1);expect(actual).toBeGreaterThan(0);}}
  const warm=balance.filter(i=>i.prescription?.block==='warmup').reduce((n,i)=>n+('durationSeconds'in i.target?i.sets*i.target.durationSeconds:0),0);if(warm<source.add_slot.seconds[0])warmupShortfall=true;
 }
 if(warmupShortfall)expect(scorePlan(plan,profile,rules).perRule.find(row=>row.id==='session.warmup.balance_older')!.satisfaction).toBeLessThan(1);
 const missing=structuredClone(plan);missing.templates[0].items=missing.templates[0].items.filter(i=>rules.byExercise.get(i.exerciseId)?.primary_pattern!=='balance');expect(validatePlan(missing,profile).some(i=>i.code==='balance_days'&&i.severity==='error')).toBe(true);
});
