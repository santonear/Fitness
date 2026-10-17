import {independentlyPossibleIds} from '../../tools/eval/training-engine-quality';
import {scorePlan} from '../../src/engine/score';

import{expect,it}from'vitest';
import{generatePlan,validatePlan}from'../../src/engine';
import{Rules}from'../../src/engine/data';
import {actualWarmupSeconds,estimatedSeconds} from '../../src/engine/fit/elapsed-time';
import {safetyBlockMinimums,ensureSafetyBlocks} from '../../src/engine/progression/legacy-blocks';
import{safety}from'../../src/engine/gates/strength-scoring';
import{goldenProfiles}from'../../tools/eval/training-engine-profiles';
import{independentWarmupAudit,independentSessionTimeIssues}from'../unit/engine/reference/training-engine-session-time';
it('measures final real warmup and safety-target shortfall without hiding older restrictions',()=>{
 const p=goldenProfiles.find(x=>x.id==='older70-cautious-balance')!.profile,r=new Rules(),plan=generatePlan(p);expect(plan.templates.length).toBeGreaterThan(0);
 for(const t of plan.templates){const audit=independentWarmupAudit(t,p);expect(actualWarmupSeconds(t,p,r)).toBe(audit.seconds);expect(audit.issues).toEqual([]);if(safetyBlockMinimums(t,p,r).applies&&audit.seconds<r.get('safety.session.warmup_cooldown').warmup_min_minutes*60)expect(scorePlan({...plan,templates:[t]},p,r).perRule.find(row=>row.id==='safety.session.warmup_cooldown')!.satisfaction).toBeLessThan(1);}
 const hard=validatePlan(plan,p).filter(i=>i.severity==='error');expect(hard.filter(i=>i.code!=='balance_days')).toEqual([]);if(hard.some(i=>i.code==='balance_days')){expect(plan.quality?.status).toBe('environmentLimited');const possible=new Set(independentlyPossibleIds(p));expect(r.data.exercises.filter(e=>possible.has(e.id)&&e.primary_pattern==='balance'&&e.use.some(use=>['warmup','accessory'].includes(use)))).toEqual([]);}expect(plan.notices.length).toBeLessThanOrEqual(3);for(const n of plan.notices)expect(r.data.copy[n.code]).toBeDefined(); for(const day of plan.templates){expect(day.estimatedSeconds).toBe(estimatedSeconds(day,r));expect(day.estimatedMinutes).toBe(Math.ceil(day.estimatedSeconds!/60));}
 // Pin the ordinary session type explicitly; fixing ramp deficits may change which generated day contains moderate work.
 const ordinary=structuredClone(plan.templates[0]),light=r.get('aerobic.intensity.rpe_scale').light_max;
 for(const item of ordinary.items)if(item.prescription?.block==='conditioning')item.prescription.targetRpe=[light,light];
 ensureSafetyBlocks(ordinary,p,r,safety(p,r));expect(safetyBlockMinimums(ordinary,p,r).applies).toBe(false);expect(actualWarmupSeconds(ordinary,p,r)).toBe(independentWarmupAudit(ordinary,p).seconds);expect(independentWarmupAudit(ordinary,p).issues).toEqual([]);
});
