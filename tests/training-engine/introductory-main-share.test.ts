import {expect,it} from 'vitest';
import {generatePlan,validatePlan} from '../../src/engine';
import {Rules} from '../../src/engine/data';
import {weeklyElapsedAllocation} from '../../src/engine/fit/elapsed-time';
import {goldenProfiles} from '../../tools/eval/training-engine-profiles';
import {independentElapsedAllocation} from '../unit/engine/reference/training-engine-goal-share';
import {verifyObservedGoalShares} from './v2-quality-observation';
const rules=new Rules(),profile=goldenProfiles.find(x=>x.id==='first-week-health2x20')!.profile;
it('preserves introductory source set caps and measures real first-week shares without a removed exchange proof',()=>{
 const plan=generatePlan(profile),allocation=weeklyElapsedAllocation(plan.templates,rules),independent=independentElapsedAllocation(plan),cap=rules.get('progression.new.week_caps').week_1;
 expect(allocation).toEqual(independent);expect(independent.total).toBeGreaterThan(0);verifyObservedGoalShares(plan,profile,rules);expect(validatePlan(plan,profile).filter(i=>i.severity==='error')).toEqual([]);
 const work=plan.templates.flatMap(t=>t.items).filter(i=>['main','accessory'].includes(i.prescription?.block??''));expect(work.length).toBeGreaterThan(0);for(const i of work){expect(i.sets).toBeGreaterThanOrEqual(cap.sets_per_exercise[0]);expect(i.sets).toBeLessThanOrEqual(cap.sets_per_exercise[1]);}
 const excess=structuredClone(plan),item=excess.templates.flatMap(t=>t.items).find(i=>['main','accessory'].includes(i.prescription?.block??''))!;item.sets=cap.sets_per_exercise[1]+1;expect(validatePlan(excess,profile).some(i=>i.code==='intro_dose'&&i.severity==='error')).toBe(true);
});
it('does not apply the introductory two-set cap to the retained trained user',()=>{
 const trained=goldenProfiles.find(x=>x.id==='quiet-bodyweight-2x20')!.profile,plan=generatePlan(trained),item=plan.templates.flatMap(t=>t.items).find(i=>['main','accessory'].includes(i.prescription?.block??''))!;expect(trained.trainingAgeWeeks).toBeGreaterThan(4);item.sets=rules.get('progression.new.week_caps').week_1.sets_per_exercise[1]+1;expect(item.sets).toBeLessThanOrEqual(rules.get('dose.sets_exercise').max[trained.level]);expect(validatePlan(plan,trained).some(i=>i.code==='intro_dose')).toBe(false);
});
