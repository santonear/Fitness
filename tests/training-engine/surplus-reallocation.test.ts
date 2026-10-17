import {baseProfile} from '../../tools/eval/training-engine-profiles';
import {runGates} from '../../src/engine/gates';
import {it,expect} from 'vitest';
import {generatePlan,validatePlan} from '../../src/engine';
import {Rules} from '../../src/engine/data';
import {weeklyVolume,volumeLimits} from '../../src/engine/dose';
import {engineProfileSchema} from '../../src/engine/contracts';
import profiles from '../unit/engine/fixtures/v1-surplus-inputs.json';
import {scorePlan} from '../../src/engine/score';
import {independentlyPossibleIds} from '../../tools/eval/training-engine-quality';

for(const index of [84,100,108])it(`measures weekly volume targets with explicit new synthetic answers for retained input index ${index}`,()=>{
 const input=profiles.find(row=>row.index===index)!;expect(input.originalSeed).toBe(20261015);
 const legacy=engineProfileSchema.parse(input.profile),before=structuredClone(legacy);expect(runGates(legacy).status).toBe('blocked');expect(generatePlan(legacy).templates).toEqual([]);expect(legacy).toEqual(before);const profile=baseProfile({...structuredClone(legacy),screening:baseProfile().screening}),plan=generatePlan(profile),rules=new Rules(),limits=volumeLimits(profile,rules);
 expect(plan.templates).toHaveLength(profile.daysPerWeek);expect(validatePlan(plan,profile).filter(issue=>issue.severity==='error')).toEqual([]);
 const volume=weeklyVolume(plan,rules);
 const deviations=rules.get('dose.muscle_groups').target_groups.filter((muscle:string)=>(volume[muscle]??0)<limits.min||(volume[muscle]??0)>limits.max);const target=scorePlan(plan,profile,rules).perRule.find(row=>row.id==='dose.sets_week.goal_matrix');expect(target).toBeDefined();if(deviations.length)expect(target!.satisfaction).toBeLessThan(1);else expect(target!.satisfaction).toBe(1);for(const muscle of rules.get('dose.muscle_groups').target_groups)expect(Number.isFinite(volume[muscle]??0)).toBe(true);const excess=structuredClone(plan),item=excess.templates.flatMap(t=>t.items).find(i=>['main','accessory'].includes(i.prescription?.block??''))!;item.sets=999;expect(validatePlan(excess,profile).some(i=>i.severity==='error'&&i.code==='exercise_set_cap')).toBe(true);
});
it('keeps exact index18 carry absence factual advice without a removed source-constraint exemption',()=>{
 const legacy=engineProfileSchema.parse(profiles.find(row=>row.index===18)!.profile),before=structuredClone(legacy);expect(runGates(legacy).status).toBe('blocked');expect(generatePlan(legacy).templates).toEqual([]);expect(legacy).toEqual(before);const profile=baseProfile({...structuredClone(legacy),screening:baseProfile().screening}),plan=generatePlan(profile),issues=validatePlan(plan,profile);
 const rules=new Rules(),possible=new Set(independentlyPossibleIds(profile)),carry=rules.get('balance.week.carry_ground');expect(rules.data.exercises.filter(e=>possible.has(e.id)&&carry.patterns.includes(e.primary_pattern))).toEqual([]);expect(scorePlan(plan,profile,rules).advice.find(row=>row.id==='balance.week.carry_ground')?.satisfied).toBe(false);expect(issues.filter(issue=>issue.severity==='error')).toEqual([]);expect(plan.templates).toHaveLength(profile.daysPerWeek);});
