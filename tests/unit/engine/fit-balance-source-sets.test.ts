import {expect,it} from 'vitest';
import {generatePlan} from '../../../src/engine';
import {engineProfileSchema,type EnginePlan,type SessionDraft} from '../../../src/engine/contracts';
import {Rules} from '../../../src/engine/data';
import {createContext} from '../../../src/engine/pipeline';
import {fitDuration,estimateSeconds} from '../../../src/engine/fit';
import {checkHard} from '../../../src/engine/hard-checks';
import fixed from '../../fixtures/training-engine/assemble-duration-regressions.json';
const profile=engineProfileSchema.parse(structuredClone(fixed.profiles[0].profile));
function setup(rules=new Rules()){
 const plan=generatePlan(profile),template=structuredClone(plan.templates[0]);
 const draft:SessionDraft={...template,slots:template.items.map((item,index)=>({id:item.prescription?.sourcePosition??`test-${index}`,role:item.prescription!.block,patterns:[item.prescription!.pattern],priority:1,optional:false,sourceRuleId:'duration.fit.algorithm'}))};
 const balance=draft.items.findIndex(i=>i.prescription?.block==='balance'),ctx=createContext(profile,0,rules);ctx.plan=structuredClone(plan);ctx.lockedItemIndexes=draft.items.flatMap((_,n)=>n===balance?[]:[n]);return {plan,draft,balance,ctx};
}
it('reduces balance sets to its source minimum while retaining hold, rest and the action',()=>{
 const {draft,balance,ctx}=setup(),original=structuredClone(draft.items[balance]);draft.items[balance].sets=3;const before=structuredClone(draft),out=fitDuration(draft,10,ctx),item=out.items[balance],range=ctx.rules.byExercise.get(item.exerciseId)!.default_dose[profile.level]!.sets;
 expect(item.sets).toBe(range[0]);expect(item).toEqual({...original,sets:range[0]});expect(out.items.length).toBe(draft.items.length);expect(draft).toEqual(before);expect(checkHard({...ctx.plan!,templates:[out]},profile,ctx.gate,ctx.rules).filter(i=>i.severity==='error')).toEqual([]);
 const again=fitDuration(out,10,ctx);expect(again.items[balance].sets).toBe(range[0]);
});
it('cannot reduce below a higher source lower bound',()=>{
 const r=new Rules(structuredClone(new Rules().data)),{draft,balance,ctx}=setup(r);draft.items[balance].sets=3;r.byExercise.get(draft.items[balance].exerciseId)!.default_dose[profile.level]!.sets=[3,4];const out=fitDuration(draft,10,ctx);expect(out.items[balance].sets).toBe(3);expect(checkHard({...ctx.plan!,templates:[out]},profile,ctx.gate,r).some(i=>i.code==='duration_tolerance'&&i.severity==='error')).toBe(true);
});
it('rejects the set reduction when the candidate still violates an independent hard rule',()=>{
 const {draft,balance,ctx}=setup();draft.items[balance].sets=3;draft.items.find(i=>i.prescription?.block==='main')!.prescription!.rir=[0,0];const out=fitDuration(draft,10,ctx);expect(out.items[balance].sets).toBe(3);expect(checkHard({...ctx.plan!,templates:[out]},profile,ctx.gate,ctx.rules).some(i=>i.severity==='error'&&i.code!=='duration_tolerance')).toBe(true);
});
it('retains balance on every day when fitting a three-day older-adult week',()=>{
 const {plan,draft,balance}=setup(),p={...profile,daysPerWeek:3},r=new Rules(),templates=[0,1,2].map(n=>({...structuredClone(plan.templates[0]),id:`balance-day-${n}`})),week:EnginePlan={...plan,weeklyTarget:3,templates},ctx=createContext(p,0,r);ctx.plan=week;
 for(let n=0;n<3;n++){const next={...structuredClone(draft),id:templates[n].id};next.items[balance].sets=3;ctx.lockedItemIndexes=next.items.flatMap((_,i)=>i===balance?[]:[i]);week.templates[n]=fitDuration(next,10,ctx);}
 expect(week.templates.map(t=>t.items.filter(i=>r.byExercise.get(i.exerciseId)?.primary_pattern==='balance').length)).toEqual([1,1,1]);expect(checkHard(week,p,ctx.gate,r).filter(i=>i.severity==='error')).toEqual([]);
});

it.each([835,840])('does not trim source balance sets when the old fitting result is already hard-legal at %s seconds',seconds=>{
 const {draft,balance,ctx}=setup();draft.items[balance].sets=3;const mains=draft.items.filter(i=>i.prescription?.block==='main');if(!('reps'in mains[0].target)||!('reps'in mains[1].target))throw Error('Expected source main rep targets');mains[0].target.reps=12;mains[1].target.reps=10;draft.items[balance].prescription!.restSeconds+=(seconds-estimateSeconds(draft,ctx.rules))/(draft.items[balance].sets-1);expect(draft.items[balance].prescription!.restSeconds).toBeGreaterThanOrEqual(ctx.rules.get('dose.rest.table').isometric_core.default[0]);
 expect(estimateSeconds(draft,ctx.rules)).toBe(seconds);expect(checkHard({...ctx.plan!,templates:[draft]},profile,ctx.gate,ctx.rules).filter(i=>i.severity==='error')).toEqual([]);const before=structuredClone(draft.items),out=fitDuration(draft,10,ctx);expect(out.items).toEqual(before);expect(out.items[balance].sets).toBe(3);expect(out.estimatedSeconds).toBe(seconds);
});
