import {expect,it} from 'vitest';
import {Rules} from '../../src/engine/data';
import {prescribe} from '../../src/engine/dose';
import {safety} from '../../src/engine/gates/strength-scoring';
import {engineProfileSchema,type EnginePlan} from '../../src/engine/contracts';
import {baseProfile} from '../../tools/eval/training-engine-profiles';
import {independentElapsedAllocation} from '../unit/engine/reference/training-engine-goal-share';
import {generatePlan,validatePlan,nextTargets} from '../../src/engine';
import {estimateSeconds} from '../../src/engine/fit';
import {runGates} from '../../src/engine/gates';
import {scorePlan} from '../../src/engine/score';
import profiles from '../unit/engine/fixtures/v1-surplus-inputs.json';
const r=new Rules(),p=baseProfile({goal:'mobility',sessionMinutes:63}),s=safety(p,r);
function fixture():EnginePlan{
 const move=(slug:string,block:'mobility'|'warmup'|'cooldown'|'conditioning',seconds:number,sets=1)=>{const e=r.data.exercises.find(e=>e.slug===slug)!;expect(e,slug).toBeDefined();const item=prescribe(e,p,r,s,block,sets);item.sets=sets;item.target={metricType:'duration',durationSeconds:seconds};if(block==='conditioning')item.prescription!.targetRpe=[5,6];return item;};
 const items=[move('standing-quad-stretch','mobility',30,2),move('custom-standing-upper-back-stretch','mobility',30,2),move('pilates-roll-down','mobility',30,2),move('custom-step-jack','warmup',290),move('custom-quiet-march','cooldown',290),move('custom-quiet-shadow-boxing','conditioning',330)];
 return {weeklyTarget:p.daysPerWeek,sessionMinutes:p.sessionMinutes,meta:{engineVersion:'2.0.0-test',rulesVersion:r.data.rulesVersion,seed:'source-target'},gates:[],notices:[],trace:[],templates:[{id:'source-target',name:'source target',estimatedMinutes:63,targetMinutes:20,items}]};
}
function regions(t:EnginePlan['templates'][number]){
 const found=new Map<string,number>(),map=r.get('dose.muscle_groups').catalog_map;
 for(const item of t.items.filter(i=>i.prescription?.block==='mobility')){const e=r.byExercise.get(item.exerciseId);if(!e||!('durationSeconds'in item.target))continue;const seconds=item.sets*item.target.durationSeconds*(item.prescription?.perSide||e.time.per_side?r.get('session.time.model').per_side_multiplier:1),targets=e.stretch_targets??[];
 for(const [region,applies]of [['lower_body',e.mobility_type==='static'&&targets.some(g=>['quads','glutes','hamstrings'].includes(g))],['upper_body',e.mobility_type==='static'&&targets.some(g=>['chest','back','shoulders'].includes(g))],['trunk',e.mobility_type==='dynamic'&&(e.primaryMuscles??[]).some(m=>['core','lower_back'].includes(map[m]))]] as const)if(applies)found.set(region,(found.get(region)??0)+seconds);}
 return found;
}
it('uses the saved target and actual elapsed work independently of displayed timing',()=>{
 const plan=fixture(),before=structuredClone(plan),t=plan.templates[0];expect(estimateSeconds(t,r)).toBe(1200);expect(independentElapsedAllocation(plan).total).toBe(1200);expect(validatePlan(plan,p).some(i=>i.code==='duration_tolerance')).toBe(false);
 t.estimatedMinutes=90;t.estimatedSeconds=1;expect(estimateSeconds(t,r)).toBe(1200);expect(validatePlan(plan,p).some(i=>i.code==='duration_tolerance')).toBe(false);expect(t.targetMinutes).toBe(20);expect(p.sessionMinutes).toBe(63);
 delete t.targetMinutes;expect(validatePlan(plan,p).some(i=>i.code==='duration_tolerance')).toBe(true);expect(before.templates[0].targetMinutes).toBe(20);
});
it.each([1,20.5])('rejects malformed declared target %s without reconstructing it from exercise selection',target=>{const plan=fixture();plan.templates[0].targetMinutes=target;expect(validatePlan(plan,p).some(i=>i.code==='declared_target_invalid'&&i.severity==='error')).toBe(true);});
it.each([60,64])('retains well-formed saved target %s and independently rejects insufficient actual duration',target=>{const plan=fixture();plan.templates[0].targetMinutes=target;const before=structuredClone(plan),issues=validatePlan(plan,p);expect(issues.some(i=>i.code==='declared_target_invalid')).toBe(false);expect(issues.some(i=>i.code==='duration_tolerance')).toBe(true);expect(plan).toEqual(before);});
it('keeps saved targets across goals while checking actual selected doses despite misleading block labels',()=>{
 const plan=fixture();expect(validatePlan(plan,{...p,goal:'health'}).some(i=>i.code==='declared_target_invalid'||i.code==='duration_tolerance')).toBe(false);
 for(const block of ['warmup','cooldown','mobility'] as const){const copy=structuredClone(plan),e=r.data.exercises.find(e=>e.modality==='strength')!,item=prescribe(e,p,r,s,'main',1);item.prescription!.block=block;item.target={metricType:'reps',reps:999};copy.templates[0].items.push(item);expect(validatePlan(copy,p).some(i=>i.code==='reps_bounds')).toBe(true);expect(copy.templates[0].targetMinutes).toBe(20);}
});
it('detects missing real regions and rejects unknown poses without treating saved minutes as proof of coverage',()=>{
 const t=fixture().templates[0];for(const region of ['lower_body','upper_body','trunk'])expect(regions(t).get(region)??0).toBeGreaterThanOrEqual(r.get('week.day.mobility').seconds_per_region_min);
 const missing=structuredClone(t);missing.items=missing.items.filter(i=>r.byExercise.get(i.exerciseId)?.slug!=='pilates-roll-down');expect(regions(missing).has('trunk')).toBe(false);expect(missing.targetMinutes).toBe(20);
 const unknown=fixture();unknown.templates[0].items[0].exerciseId='unknown-pose';expect(validatePlan(unknown,p).some(i=>i.code==='unknown_exercise')).toBe(true);
});
it('keeps the original mobility84 incomplete-screening input blocked and unchanged',()=>{const legacy=engineProfileSchema.parse(profiles.find(row=>row.index===84)!.profile),before=structuredClone(legacy);expect(runGates(legacy,r).status).toBe('blocked');expect(generatePlan(legacy).templates).toEqual([]);expect(legacy).toEqual(before);});
it('checks mobility84 actual time, source stretch doses and target deficits with explicit new synthetic screening',()=>{
 const legacy=engineProfileSchema.parse(profiles.find(row=>row.index===84)!.profile),profile=baseProfile({...structuredClone(legacy),screening:baseProfile().screening}),before=structuredClone(profile),plan=generatePlan(profile);expect(plan.templates).toHaveLength(profile.daysPerWeek);expect(validatePlan(plan,profile).filter(i=>i.severity==='error')).toEqual([]);
 for(const t of plan.templates){expect(estimateSeconds(t,r)).toBe(independentElapsedAllocation({templates:[t]}).total);expect(t.targetMinutes).toBe(63);const perMuscle=new Map<string,number>();
  for(const i of t.items){const e=r.byExercise.get(i.exerciseId)!;if(e.mobility_type!=='static')continue;expect('durationSeconds'in i.target).toBe(true);if(!('durationSeconds'in i.target))continue;const populationRange=r.get('dose.stretch').hold_s.range,range=e.stretch_hold_s??populationRange;expect(i.target.durationSeconds).toBeGreaterThanOrEqual(Math.max(populationRange[0],range[0]));expect(i.target.durationSeconds).toBeLessThanOrEqual(Math.min(populationRange[1],range[1]));for(const muscle of e.stretch_targets??[])perMuscle.set(muscle,(perMuscle.get(muscle)??0)+i.sets);}
  for(const count of perMuscle.values())expect(count).toBeLessThanOrEqual(r.get('dose.stretch').reps_per_muscle[1]);
  if(!t.items.some(i=>['main','accessory'].includes(i.prescription?.block??'')))for(const region of ['lower_body','upper_body','trunk'])expect(regions(t).get(region)??0,region).toBeGreaterThanOrEqual(r.get('week.day.mobility').seconds_per_region_min);
 }
 const score=scorePlan(plan,profile,r);expect(score.perRule.some(row=>row.id==='goal.params.mobility')).toBe(true);const saved=plan.templates.map(t=>t.targetMinutes);expect(nextTargets([],plan,profile).value.templates.map(t=>t.targetMinutes)).toEqual(saved);expect(generatePlan(profile)).toEqual(plan);expect(profile).toEqual(before);expect(profile.sessionMinutes).toBe(63);
});
