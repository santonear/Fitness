import {expect,it} from 'vitest';
import {sampledProfiles} from '../../../tools/eval/training-engine-profiles';
import {Rules} from '../../../src/engine/data';
import {generatePlan,createContext} from '../../../src/engine/pipeline';
import {buildWeek} from '../../../src/engine/structure';
import {buildSlots} from '../../../src/engine/skeleton';
import {fillSlots} from '../../../src/engine/fill';
import {assignDose,allocateVolumeBudget,allocatedVolumeCapacity} from '../../../src/engine/dose';
import {foldGeneratedBodyweightWarmup} from '../../../src/engine/source-warmup';
import {fitDuration,retainsRequirements,estimateSeconds} from '../../../src/engine/fit';
import {scorePlan,marginal} from '../../../src/engine/score';
import {checkHard} from '../../../src/engine/hard-checks';
import {isHardEligible} from '../../../src/engine/candidates';
import {improve} from '../../../src/engine/improve';
import {baseProfile} from '../../../tools/eval/training-engine-profiles';
import type {EnginePlan,EngineProfile,SessionDraft} from '../../../src/engine/contracts';
const r=new Rules(),profiles=sampledProfiles(),core=new Set<string>([...r.get('balance.week.core_three').rt_days_min_3.required_each]);
const coreItems=(items:SessionDraft['items'])=>items.filter(i=>['main','accessory'].includes(i.prescription?.block??'')&&core.has(r.byExercise.get(i.exerciseId)!.primary_pattern));
function stages(p:EngineProfile){const ctx=createContext(p,0,r),week=buildWeek(p,ctx.gate,r),plan:EnginePlan={weeklyTarget:p.daysPerWeek,sessionMinutes:p.sessionMinutes,templates:[],gates:ctx.gate.reasons,notices:[],trace:ctx.trace,meta:{engineVersion:'2',rulesVersion:r.data.rulesVersion,seed:ctx.profileHash}};ctx.plan=plan;ctx.volumeBudget=allocateVolumeBudget(p,ctx.gate,r,week.days);return week.days.map(day=>{ctx.currentWeekday=day.weekday;ctx.usedIds=new Set();ctx.usedLadders=new Set();const slots=buildSlots(day,p,day.minutes,r),draft=fillSlots(slots,ctx,{score:scorePlan,marginal});draft.id=day.id;draft.weekday=day.weekday;const dosed=foldGeneratedBodyweightWarmup(assignDose(draft,p,ctx.gate,r,ctx),p,r),fitted=fitDuration(dosed,day.minutes,ctx);plan.templates.push(fitted);return {day,slots,dosed,fitted,ctx};});}
it.each([48,50,62])('preserves feasible source core coverage through real slots, dose, fit and improve at index %i',index=>{
 const p=profiles[index],before=structuredClone(p),ctx=createContext(p,0,r),available=r.data.exercises.filter(e=>core.has(e.primary_pattern)&&isHardEligible(e,p,ctx.gate,{rules:r}));expect(available.length).toBeGreaterThan(0);const trace=stages(p);
 if(index===48){expect(p.population.kind).toBe('older_adult');expect(p.sessionMinutes).toBe(10);expect(trace.some(row=>row.slots.some(slot=>slot.patterns.some(pattern=>core.has(pattern))))).toBe(true);}else {expect(p.daysPerWeek).toBe(1);const row=trace.find(row=>coreItems(row.dosed.items).length)!;expect(row).toBeDefined();const removed={...structuredClone(row.dosed),items:row.dosed.items.filter(i=>!coreItems(row.dosed.items).includes(i))};expect(retainsRequirements(row.dosed,removed,{...row.ctx,plan:{...row.ctx.plan!,templates:[row.dosed]}})).toBe(false);expect(coreItems(row.fitted.items).length).toBeGreaterThan(0);}
 const plan=generatePlan(p,{rules:r});expect(coreItems(plan.templates.flatMap(t=>t.items)).length).toBeGreaterThan(0);expect(checkHard(plan,p,ctx.gate,r).filter(i=>i.severity==='error')).toEqual([]);expect(plan.templates).toHaveLength(p.daysPerWeek);for(const t of plan.templates){const seconds=estimateSeconds(t,r),target=(t.targetMinutes??p.sessionMinutes)*60,bounds=r.get('duration.fit.bounds'),band=target===600?bounds.min10_duration_seconds:[target*bounds.duration_band[0],target*bounds.duration_band[1]];expect(seconds).toBeGreaterThanOrEqual(band[0]);expect(seconds).toBeLessThanOrEqual(band[1]);expect(t.estimatedSeconds).toBe(seconds);}expect(p).toEqual(before);
});
it('includes every supplemental core slot in the same real capacity source and keeps required balance nonoptional',()=>{
 const p=profiles[48],ctx=createContext(p,0,r),week=buildWeek(p,ctx.gate,r),capacity=allocatedVolumeCapacity(p,ctx.gate,r,week.days);let supplemental=0;
 for(const day of week.days){const slots=buildSlots(day,p,day.minutes,r);for(const slot of slots.filter(slot=>slot.sourceRuleId==='balance.week.core_three')){supplemental++;expect(slot.optional).toBe(true);expect(capacity.days.find(value=>value.dayId===day.id)?.items.some(value=>value.item.prescription?.sourcePosition===slot.id)).toBe(true);}for(const slot of slots.filter(slot=>slot.patterns.includes('balance')))expect(slot.optional).toBe(false);}
 expect(supplemental).toBeGreaterThan(0);
});
it('does not erase source core coverage in an otherwise tempting one-day replacement',()=>{
 const p=profiles[50],plan=generatePlan(p,{rules:r}),ctx=createContext(p,0,r),before=structuredClone(plan),next=improve(plan,ctx,{score:scorePlan,marginal},3);expect(coreItems(next.templates.flatMap(t=>t.items)).length).toBeGreaterThan(0);expect(checkHard(next,p,ctx.gate,r).filter(i=>i.severity==='error')).toEqual([]);expect(plan).toEqual(before);
});
it('does not fabricate core slots for an early postpartum day or a completely excluded core pool',()=>{
 const early=baseProfile({population:{kind:'postpartum',weeksSinceBirth:2,delivery:'vaginal',cleared:false}}),ctx=createContext(early,0,r);for(const day of buildWeek(early,ctx.gate,r).days)expect(buildSlots(day,early,day.minutes,r).some(slot=>slot.sourceRuleId==='balance.week.core_three')).toBe(false);
 const p=structuredClone(profiles[48]);p.preferences.excludedExerciseIds=r.data.exercises.filter(e=>core.has(e.primary_pattern)).map(e=>e.id);const gate=createContext(p,0,r).gate;for(const day of buildWeek(p,gate,r).days)expect(buildSlots(day,p,day.minutes,r).some(slot=>slot.sourceRuleId==='balance.week.core_three')).toBe(false);
});

it('reserves actual source preparation time before admitting optional core, respecting the 10-minute cooldown exemption',()=>{
 const p=profiles[48],data=structuredClone(r.data),template=data.rules.find(rule=>rule.id==='session.template.min10')!;
 const baseline=new Rules(data),day=buildWeek(p,createContext(p,0,baseline).gate,baseline).days.find(day=>day.kind==='full')!;
 expect(buildSlots(day,p,day.minutes,baseline).some(slot=>slot.sourceRuleId==='balance.week.core_three')).toBe(true);
 const cooldown=template.value!.slots.find((slot:{block:string})=>slot.block==='cooldown');cooldown.seconds=[10000,10000];
 const exempt=new Rules(data);expect(buildSlots(day,p,day.minutes,exempt).some(slot=>slot.sourceRuleId==='balance.week.core_three')).toBe(true);
 const warmup=template.value!.slots.find((slot:{block:string})=>slot.block==='warmup');warmup.seconds=[10000,10000];
 const unavailable=new Rules(data);expect(buildSlots(day,p,day.minutes,unavailable).some(slot=>slot.sourceRuleId==='balance.week.core_three')).toBe(false);
});
