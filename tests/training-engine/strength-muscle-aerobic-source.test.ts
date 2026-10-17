import {verifyObservedGoalShares} from './v2-quality-observation';
import {scorePlan} from '../../src/engine/score';
import {expect,it} from 'vitest';
import {generatePlan,validatePlan} from '../../src/engine';
import {sampledProfiles} from '../../tools/eval/training-engine-profiles';
import {externalIssues} from '../../tools/eval/training-engine-invariants';
import {Rules} from '../../src/engine/data';
import {actualWarmupSeconds,blockSeconds,weeklyElapsedAllocation} from '../../src/engine/fit/elapsed-time';

it('measures actual muscle aerobic share and warmup/cooldown targets without requiring V1 fixed allocations',()=>{
 const profile=sampledProfiles()[5],before=structuredClone(profile),plan=generatePlan(profile),rules=new Rules();
 expect(validatePlan(plan,profile).filter(issue=>issue.severity==='error')).toEqual([]);
 expect(externalIssues(plan,profile).filter(issue=>issue.severity==='error')).toEqual([]);
 expect(plan.quality?.issues).toEqual([]);expect(plan.gates.some(g=>g.status==='blocked')).toBe(false);
 const allocation=weeklyElapsedAllocation(plan.templates,rules),range=rules.get('goal.params.muscle').time_share.aerobic;
 expect(range).toHaveLength(2);verifyObservedGoalShares(plan,profile,rules);if(allocation.aerobic===0)expect(scorePlan(plan,profile,rules).perRule.find(row=>row.id==='goal.params.muscle')!.satisfaction).toBeLessThan(1);
 for(const day of plan.templates){
  const cardio=day.items.filter(item=>item.prescription?.block==='conditioning');
  const cooldownIndex=day.items.findIndex(item=>item.prescription?.block==='cooldown');
  expect(cooldownIndex).toBeGreaterThanOrEqual(0);
  expect(day.items.every((item,index)=>item.prescription?.block!=='conditioning'||index<cooldownIndex)).toBe(true);
  for(const item of cardio)expect(item.prescription?.targetRpe).toEqual(rules.get('session.conditioning.slot').continuous_intensity.rpe);
  expect(actualWarmupSeconds(day,profile,rules)).toBeGreaterThan(0);expect(blockSeconds(day,'cooldown',rules)).toBeGreaterThan(0);const stripped=structuredClone(plan);stripped.templates.find(t=>t.id===day.id)!.items=stripped.templates.find(t=>t.id===day.id)!.items.filter(i=>!['warmup','cooldown'].includes(i.prescription?.block??''));const score=(x:typeof plan)=>scorePlan(x,profile,rules).perRule.find(row=>row.id==='safety.session.warmup_cooldown')!.satisfaction;const applicable=day.items.some(i=>i.prescription?.structure==='circuit'||i.prescription?.block==='conditioning'&&(i.prescription.targetRpe?.[0]??0)>=rules.get('aerobic.intensity.rpe_scale').moderate[0]);if(applicable)expect(score(stripped)).toBeLessThan(score(plan));else expect(score(stripped)).toBe(score(plan));
 }
 expect(profile).toEqual(before);
});

it('retains frequency and carry deficits in target scoring without restoring obsolete hard errors',()=>{
 const profile=sampledProfiles()[15],plan=generatePlan(profile),issues=validatePlan(plan,profile).filter(issue=>issue.severity==='error');
 expect(issues.some(issue=>['goal_frequency_min','carry_ground_gap'].includes(issue.code))).toBe(false);const rules=new Rules();expect(rules.byId.get('goal.params.'+profile.goal)?.severity).toBe('target');verifyObservedGoalShares(plan,profile,rules);expect(scorePlan(plan,profile,rules).perRule.find(row=>row.id==='goal.params.'+profile.goal)!.satisfaction).toBeLessThan(1);
});
