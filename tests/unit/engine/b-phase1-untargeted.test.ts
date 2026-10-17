import {it,expect,vi} from 'vitest';
import {generatePlan,createContext} from '../../../src/engine/pipeline';
import {improve} from '../../../src/engine/improve';
import {estimateSeconds} from '../../../src/engine/fit';
import {checkHard} from '../../../src/engine/hard-checks';
import {condition} from '../../../src/engine/data';
import {fixtureProfile,planFixture} from './fixtures';
import type {EngineProfile,Scorer} from '../../../src/engine/contracts';
function phase1(minutes:number,delivery:'cesarean'|'vaginal'='cesarean'):EngineProfile{return {...structuredClone(fixtureProfile),sessionMinutes:minutes,population:{kind:'postpartum',weeksSinceBirth:2,delivery,cleared:false}};}
it.each(['cesarean','vaginal'] as const)('keeps real phase1 %s content and dose independent of a 10 or 90 minute preference',delivery=>{
 const profiles=[phase1(10,delivery),phase1(90,delivery)],plans=profiles.map(profile=>generatePlan(profile)),content=plans.map((plan,index)=>{
  const ctx=createContext(profiles[index]),rule=ctx.rules.get('postpartum.phase1');expect(ctx.gate.restrictions.phase).toBe(1);expect(rule.minutes_target).toBe('none');expect(plan.templates.length).toBeGreaterThan(0);
  return plan.templates.map(t=>{expect(t.durationScope).toBe('untargeted');expect(t).not.toHaveProperty('targetMinutes');expect(t.estimatedSeconds).toBe(estimateSeconds(t,ctx.rules));expect(t.estimatedSeconds).toBeGreaterThan(0);
   for(const item of t.items){const e=ctx.rules.byExercise.get(item.exerciseId)!;expect(condition(rule.allow_only_if,e,ctx.gate.restrictions.user)).toBe(true);if(delivery==='cesarean')expect(e.slug).toBe('walking');}
   return t.items.map(i=>({exerciseId:i.exerciseId,sets:i.sets,target:i.target,rir:i.prescription?.rir,rest:i.prescription?.restSeconds}));
  });
 });expect(content[0]).toEqual(content[1]);
});
it('does not ask the scorer to optimize genuine source-untargeted phase1 content',()=>{
 const ctx=createContext(phase1(90)),plan=generatePlan(ctx.profile),score=vi.fn(()=>({quality:0,perRule:[],advice:[]})),marginal=vi.fn(()=>1),before=structuredClone(plan);
 expect(improve(plan,ctx,{score,marginal})).toEqual(before);expect(score).not.toHaveBeenCalled();expect(marginal).not.toHaveBeenCalled();expect(plan).toEqual(before);
});
it('rejects a forged untargeted flag for an ordinary profile and does not bypass optimization by that flag',()=>{
 const ctx=createContext(fixtureProfile),plan=planFixture();plan.templates[0].durationScope='untargeted';plan.templates[0].items[0].target={metricType:'duration',durationSeconds:1};
 expect(checkHard(plan,fixtureProfile,ctx.gate,ctx.rules).some(i=>i.code==='duration_tolerance')).toBe(true);
 const score=vi.fn(()=>({quality:0,perRule:[],advice:[]})),scorer:Scorer={score,marginal:()=>0};improve(plan,ctx,scorer,1);expect(score).toHaveBeenCalled();
});
