import {scorePlan} from '../../src/engine/score';
import {independentlyPossibleIds} from '../../tools/eval/training-engine-quality';
import {verifyObservedGoalShares} from './v2-quality-observation';
import {legacySampledProfile} from './v1-inputs';
import {expect,it} from 'vitest';
import {generatePlan,validatePlan} from '../../src/engine';
import {DATA,Rules} from '../../src/engine/data';
import {runGates} from '../../src/engine/gates';
import {baseProfile} from '../../tools/eval/training-engine-profiles';
import {prescribe} from '../../src/engine/dose';
import {safety} from '../../src/engine/gates/strength-scoring';
import {goldenProfiles} from '../../tools/eval/training-engine-profiles';
import {externalIssues} from '../../tools/eval/training-engine-invariants';
const r=new Rules(),p=goldenProfiles.find(x=>x.id==='pregnancy-week20-confirmed')!.profile;
function verifyGluteOmission(plan:ReturnType<typeof generatePlan>,profile:typeof p){
 const ids=new Set(independentlyPossibleIds(profile));
 expect(r.data.exercises.filter(e=>ids.has(e.id)&&e.use.includes('cooldown')&&e.mobility_type==='static'&&e.stretch_targets?.includes('glutes'))).toEqual([]);
 expect(plan.templates.flatMap(t=>t.items).filter(i=>i.prescription?.block==='cooldown'&&r.byExercise.get(i.exerciseId)?.stretch_targets?.includes('glutes'))).toEqual([]);
 const stretch=scorePlan(plan,profile,r).perRule.find(row=>row.id==='session.cooldown.stretch');if(profile.sessionMinutes<=r.get('session.cooldown.stretch').exempt_when_session_minutes_max)expect(stretch).toBeUndefined();else {expect(stretch).toBeDefined();expect(stretch!.satisfaction).toBeLessThan(1);}
 expect(plan.notices.length).toBeLessThanOrEqual(3);for(const notice of plan.notices)expect(r.data.copy[notice.code]).toBeDefined();
}
it('reports the genuinely empty safe pregnancy stretch pool without claiming coverage',()=>{
 const plan=generatePlan(p),issues=validatePlan(plan,p);
 verifyGluteOmission(plan,p);
 expect(issues.filter(i=>i.code==='cooldown_stretch_missing')).toEqual([]);

 expect(plan.quality?.issues?.filter(i=>i.severity==='error')).toEqual([]);expect(plan.quality?.score).toBe(scorePlan(plan,p,r).quality);
 expect(issues.filter(i=>i.severity==='error')).toEqual([]);
});
for(const id of ['pregnancy-week20-confirmed','pregnancy28-confirmed'])it(`keeps the original ${id} safety, dose, exposure and elapsed-share checks`,()=>{
 const profile=goldenProfiles.find(x=>x.id===id)!.profile,before=structuredClone(profile),plan=generatePlan(profile);
 expect(plan.quality?.issues?.filter(i=>i.severity==='error')).toEqual([]);expect(plan.quality?.score).toBe(scorePlan(plan,profile,r).quality);
 expect(validatePlan(plan,profile).filter(i=>i.severity==='error')).toEqual([]);
 expect(externalIssues(plan,profile)).toEqual([]);
 expect(plan.templates).toHaveLength(3);
 expect(plan.templates.filter(t=>t.items.some(i=>i.prescription?.block==='main'))).toHaveLength(Math.min(profile.daysPerWeek,r.get('goal.params.'+profile.goal).rt_sessions_week.max));
 expect(profile).toEqual(before);
});
it('does not excuse a missing stretch when a safe registered option exists',()=>{
 const data=structuredClone(DATA),safe=data.exercises.find(e=>e.slug==='custom-standing-upper-back-stretch')??data.exercises.find(e=>e.mobility_type==='static'&&e.position.includes('standing')&&e.equipment_required.every(k=>k==='none'))!;
 safe.stretch_targets=['glutes'];const rules=new Rules(data),plan=generatePlan(p);
 const before=scorePlan(plan,p,rules).perRule.find(row=>row.id==='session.cooldown.stretch')!;const filled=structuredClone(plan);for(const t of filled.templates){const item=prescribe(safe,p,rules,safety(p,rules),'cooldown',2);item.target={metricType:'duration',durationSeconds:30};t.items.push(item);}expect(scorePlan(filled,p,rules).perRule.find(row=>row.id==='session.cooldown.stretch')!.satisfaction).toBeGreaterThan(before.satisfaction);expect(validatePlan(plan,p).some(i=>i.code==='cooldown_stretch_missing')).toBe(false);
});
it('still rejects an actually scheduled unsafe pregnancy stretch',()=>{
 const plan=generatePlan(p),e=r.data.exercises.find(e=>e.slug==='knee-to-chest-stretch')!;
 plan.templates[0].items.push(prescribe(e,p,r,safety(p,r),'cooldown',2));
 expect(validatePlan(plan,p).some(i=>i.code==='excluded_exercise')).toBe(true);
});

it.each([42,53])('discloses the actual source primary omission even without credited group volume: index %s',index=>{
 const legacy=legacySampledProfile(index),before=structuredClone(legacy);expect(runGates(legacy,r).status).toBe('blocked');expect(generatePlan(legacy).templates).toEqual([]);expect(legacy).toEqual(before);const profile=baseProfile({...structuredClone(legacy),screening:baseProfile().screening}),plan=generatePlan(profile),issues=validatePlan(plan,profile);
 verifyGluteOmission(plan,profile);verifyObservedGoalShares(plan,profile,r);expect(issues.filter(i=>i.severity==='error')).toEqual([]);
});
