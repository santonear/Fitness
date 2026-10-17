import {prescribe} from '../../../src/engine/dose';
import {runGates} from '../../../src/engine/gates';
import {refreshWarmupRamps,sourceWarmupRamps} from '../../../src/engine/source-warmup';
import type {SessionTemplate} from '../../../src/domain/v8/contracts';
import {expect,it} from 'vitest';
import {actualWarmupSeconds,blockSeconds} from '../../../src/engine/fit/elapsed-time';
import {Rules} from '../../../src/engine/data';
import {generatePlan} from '../../../src/engine';
import {baseProfile,goldenProfiles} from '../../../tools/eval/training-engine-profiles';
import legacy from './fixtures/v1-ui-duration.json';
import type {EngineProfile} from '../../../src/engine/contracts';
import {independentWarmupAudit} from './reference/training-engine-session-time';
const cases=[{name:'original profile1 authored source squat',profile:{...legacy.profile,screening:{...legacy.profile.screening,cmrSymptoms:baseProfile().screening.cmrSymptoms}} as EngineProfile,variant:2,seconds:22},{name:'older',profile:goldenProfiles.find(row=>row.id==='older70-cautious-balance')!.profile,variant:0,seconds:19}];
it.each(cases)('independently authenticates real V2 bodyweight ramp identity and $seconds seconds: $name',({profile,variant,seconds})=>{
 const template=seconds===22?sourceSquatRamp(profile):generatePlan(profile,{variant}).templates.find(t=>t.items.some(i=>i.prescription?.warmupSeconds===seconds))!;expect(template).toBeDefined();
 const index=template.items.findIndex(i=>i.prescription?.warmupSeconds===seconds),item=template.items[index];expect(item.prescription?.sourcePosition).toBe(template.id+'-M1-main_1');expect(independentWarmupAudit(template,profile).issues).toEqual([]);
 for(const mutation of ['foreign-day','wrong-source-slot','non-main','wrong-pattern-position','wrong-seconds'] as const){const copy=structuredClone(template),p=copy.items[index].prescription!;
  if(mutation==='foreign-day')p.sourcePosition='day-00000000-M1-main_1';
  if(mutation==='wrong-source-slot')p.sourcePosition=template.id+'-SS1-main_1';
  if(mutation==='non-main')p.block='accessory';
  if(mutation==='wrong-pattern-position')p.sourcePosition=template.id+'-SS1-main_2';
  if(mutation==='wrong-seconds')p.warmupSeconds=seconds+1;
  expect(independentWarmupAudit(copy,profile).issues,mutation).toContainEqual(expect.objectContaining({code:'external_ramp_source',itemIndex:index,severity:'error'}));
 }
 const unscheduled=structuredClone(template);delete unscheduled.items[index].prescription!.warmupSeconds;expect(independentWarmupAudit(unscheduled,profile).issues).toEqual([]);expect(independentWarmupAudit(template,profile).seconds-independentWarmupAudit(unscheduled,profile).seconds).toBe(seconds);
});

it('counts only the actual authenticated 19-second ramp once alongside unchanged explicit warmup work',()=>{
 const profile=cases[1].profile,r=new Rules(),plan=generatePlan(profile),template=plan.templates.find(t=>t.items.some(i=>i.prescription?.warmupSeconds===19))!;expect(template).toBeDefined();
 const index=template.items.findIndex(i=>i.prescription?.warmupSeconds===19);for(const [n,item]of template.items.entries())if(n!==index&&item.prescription)delete item.prescription.warmupSeconds;
 const block=blockSeconds(template,'warmup',r),before=structuredClone(template);expect(actualWarmupSeconds(template,profile,r)).toBe(block+19);expect(actualWarmupSeconds(template,profile,r)).toBe(block+19);expect(template).toEqual(before);
 for(const mutation of ['unregistered','foreign-day','wrong-position','wrong-seconds'] as const){const copy=structuredClone(template),p=copy.items[index].prescription!;if(mutation==='unregistered')delete p.warmupSeconds;if(mutation==='foreign-day')p.sourcePosition='day-00000000-M1-main_1';if(mutation==='wrong-position')p.sourcePosition=template.id+'-M1-main_2';if(mutation==='wrong-seconds')p.warmupSeconds=20;expect(actualWarmupSeconds(copy,profile,r),mutation).toBe(block);}
});

/** Pin an authored min30 M1/main_1 squat instead of relying on variant candidate order.
 * The registered source protocol computes half of eight reps at three seconds plus ten per-set overhead seconds. */
function sourceSquatRamp(profile:EngineProfile):SessionTemplate {
 const r=new Rules(),exercise=r.data.exercises.find(e=>e.slug==='bodyweight-squat')!,item=prescribe(exercise,profile,r,runGates(profile,r).restrictions,'main',2);
 expect(exercise.equipment_required).toEqual(['none']);expect(item.target).toEqual({metricType:'reps',reps:8});
 const id='day-00000001';item.prescription!.sourcePosition=id+'-M1-main_1';
 const template:SessionTemplate={id,name:'Authored source squat warmup',estimatedMinutes:profile.sessionMinutes,targetMinutes:profile.sessionMinutes,items:[item]};
 expect(sourceWarmupRamps(template,profile,r)).toContainEqual(expect.objectContaining({itemIndex:0,exerciseId:exercise.id,kind:'bodyweight_main',seconds:22,scheme:[{reps:4}]}));
 return refreshWarmupRamps(template,profile,r);
}
