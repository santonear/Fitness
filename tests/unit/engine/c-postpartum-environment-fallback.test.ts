import {validatePlan} from '../../../src/engine';
import {expect,it} from 'vitest';
import {DATA,Rules,condition} from '../../../src/engine/data';
import {isHardEligible,candidatesFor} from '../../../src/engine/candidates';
import {checkHard} from '../../../src/engine/hard-checks';
import {runGates} from '../../../src/engine/gates';
import {createContext,generatePlan} from '../../../src/engine/pipeline';
import {prescribe} from '../../../src/engine/dose';
import {estimateSeconds} from '../../../src/engine/fit';
import {baseProfile,sampledProfiles,extremeProfiles} from '../../../tools/eval/training-engine-profiles';
import type {EngineProfile} from '../../../src/engine/contracts';
const r=new Rules(),source=r.get('postpartum.gate.caesarean'),id=source.candidate_fallback.exercise_id as string,substitute=r.byExercise.get(id)!,walking=r.data.exercises.find(e=>condition(source.candidate_fallback.primary_if,e,{}))!;
function profile(space:EngineProfile['constraints']['space']='mat',level:EngineProfile['level']='beginner'){return baseProfile({level,population:{kind:'postpartum',weeksSinceBirth:6,delivery:'cesarean',cleared:false},constraints:{quiet:true,noJump:true,space},equipment:['none'],daysPerWeek:1});}
function withoutFallback(){const data=structuredClone(DATA);data.rulesVersion='prior-source-version';const rule=data.rules.find(row=>row.id==='postpartum.gate.caesarean')!;rule.value!.allow_only_if=structuredClone(rule.value!.candidate_fallback.primary_if);delete rule.value!.candidate_fallback;data.exercises=data.exercises.filter(e=>e.id!==id);if(data.byPattern)for(const key of Object.keys(data.byPattern))data.byPattern[key]=data.byPattern[key].filter(value=>value!==id);return new Rules(data);}
function content(plan:ReturnType<typeof generatePlan>){const copy=structuredClone(plan);delete (copy.meta as Partial<typeof copy.meta>).rulesVersion;return JSON.stringify(copy);}
it('registers only the approved exact identity and preserves source walking dose/time/use data',()=>{
 expect(id).toBe('83cb6674-515a-52cc-8ff4-b74c33f5da5a');expect(substitute.slug).toBe('custom-slow-walking-in-place');expect(substitute.space).toBe('mat');expect(walking.space).toBe('large');expect(substitute.impact).toBe(0);expect(substitute.noise).toBe(0);expect(substitute.default_dose).toEqual(walking.default_dose);expect(substitute.time).toEqual(walking.time);expect(substitute.use).toEqual(walking.use);expect(substitute.equipment_required).toEqual(walking.equipment_required);expect(walking).toEqual(withoutFallback().byExercise.get(walking.id));
 const p=profile(),g=runGates(p,r),alias={...substitute,id:'a1111111-1111-4111-8111-111111111111'};expect(isHardEligible(alias,p,g,{rules:r})).toBe(false);
});
it.each(['mat','small','medium'] as const)('supplies real %s-space work with the unchanged walking dose, light RPE and no target-minute invention',space=>{
 for(const level of ['beginner','intermediate'] as const){const p=profile(space,level),g=runGates(p,r),before=structuredClone(p),large={...p,constraints:{...p.constraints,space:'large' as const}},primary=prescribe(walking,large,r,runGates(large,r).restrictions,'conditioning',1),replacement=prescribe(substitute,p,r,g.restrictions,'conditioning',1);
 expect(isHardEligible(walking,p,g,{rules:r})).toBe(false);expect(isHardEligible(substitute,p,g,{rules:r})).toBe(true);expect(replacement.sets).toBe(primary.sets);if(!('durationSeconds'in replacement.target)||!('durationSeconds'in primary.target))throw Error('source walking must be timed');expect(replacement.target.durationSeconds).toBe(primary.target.durationSeconds);expect(replacement.prescription).toEqual(primary.prescription);expect(estimateSeconds({items:[replacement]},r)).toBe(estimateSeconds({items:[primary]},r));
 const plan=generatePlan(p,{rules:r});expect(plan.templates).toHaveLength(1);expect(plan.templates[0].items.map(i=>i.exerciseId)).toEqual([id]);expect(plan.templates[0].durationScope).toBe('untargeted');expect(plan.templates[0].targetMinutes).toBeUndefined();expect(plan.templates[0].items[0].prescription?.targetRpe?.[1]).toBeLessThanOrEqual(r.get('aerobic.intensity.rpe_scale').light_max);expect(checkHard(plan,p,g,r)).toEqual([]);expect(p).toEqual(before);
 }
});
it('restores exactly the 52 original empty-pool profiles without expanding any slot shortlist',()=>{
 const weighted=sampledProfiles(),extremes=extremeProfiles(),cases=[...([1635,1935].map(index=>({index,p:weighted[index]}))),...Array.from({length:50},(_,n)=>({index:2001+4*n,p:extremes[1+4*n]}))],old=withoutFallback();expect(cases).toHaveLength(52);
 for(const {index,p}of cases){const g=runGates(p,r);expect(g.status,index.toString()).not.toBe('blocked');expect(old.data.exercises.filter(e=>isHardEligible(e,p,runGates(p,old),{rules:old})),index.toString()).toEqual([]);expect(r.data.exercises.filter(e=>isHardEligible(e,p,g,{rules:r})).map(e=>e.id),index.toString()).toEqual([id]);}
});
it('keeps large-space primary plans byte-identical except source-version metadata, even after primary is used in a slot',()=>{
 const p=profile('large'),old=withoutFallback(),before=generatePlan(p,{rules:old}),after=generatePlan(p,{rules:r}),g=runGates(p,r);expect(before.meta.rulesVersion).not.toBe(after.meta.rulesVersion);expect(content(after)).toBe(content(before));expect(after.templates.flatMap(t=>t.items).map(i=>i.exerciseId)).toEqual([walking.id]);expect(isHardEligible(substitute,p,g,{rules:r})).toBe(false);
 const ctx=createContext(p,0,r);ctx.usedIds.add(walking.id);expect(candidatesFor({id:'test',role:'conditioning',patterns:['cardio_cyclic'],priority:0,optional:false,sourceRuleId:'postpartum.phase1'},p,g,ctx).some(e=>e.id===id)).toBe(false);
 const forged=structuredClone(after);forged.templates[0].items=[prescribe(substitute,p,r,g.restrictions,'conditioning',1)];expect(checkHard(forged,p,g,r).some(i=>i.code==='excluded_exercise'&&i.ruleId==='postpartum.gate.caesarean')).toBe(true);expect(validatePlan(forged,p).some(i=>i.code==='excluded_exercise'&&i.ruleId==='postpartum.gate.caesarean')).toBe(true);
});
it.each([{kind:'general'},{kind:'older_adult',fallsAnswers:[false,false,false,false]},{kind:'pregnant',week:20,providerCleared:true,contraindicationsConfirmedNone:true,lastScreenedWeek:20},{kind:'postpartum',weeksSinceBirth:2,delivery:'vaginal',cleared:false},{kind:'postpartum',weeksSinceBirth:2,delivery:'cesarean',cleared:true},{kind:'postpartum',weeksSinceBirth:20,delivery:'cesarean',cleared:true}] as EngineProfile['population'][])('does not alter other population $kind output or admit a forged fallback',population=>{
 const p=baseProfile({population,birthYearMonth:population.kind==='older_adult'?'1956-06':'1991-06',daysPerWeek:1}),old=withoutFallback(),before=generatePlan(p,{rules:old}),after=generatePlan(p,{rules:r}),g=runGates(p,r);expect(content(after)).toBe(content(before));expect(isHardEligible(substitute,p,g,{rules:r})).toBe(false);expect(after.templates.length).toBeGreaterThan(0);const forged=structuredClone(after);forged.templates[0].items.push(prescribe(substitute,p,r,g.restrictions,'conditioning',1));expect(checkHard(forged,p,g,r).some(i=>i.code==='excluded_exercise'&&i.ruleId==='postpartum.gate.caesarean')).toBe(true);expect(validatePlan(forged,p).some(i=>i.code==='excluded_exercise'&&i.ruleId==='postpartum.gate.caesarean')).toBe(true);
});
it('does not turn the fallback into an exemption from pain exclusions or source light-intensity limits',()=>{
 const p={...profile(),painState:[{pattern:'cardio_cyclic' as const,remainingSessions:1}]},g=runGates(p,r);expect(isHardEligible(substitute,p,g,{rules:r})).toBe(false);
 const allowed=profile(),plan=generatePlan(allowed,{rules:r}),item=plan.templates[0].items[0];const ref=r.get('postpartum.phase1').walking_intensity_ref,above=r.get(ref.rule_id)[ref.field]+1;item.prescription!.targetRpe=[above,above];expect(checkHard(plan,allowed,runGates(allowed,r),r).some(i=>i.code==='intensity_cap')).toBe(true);
});
