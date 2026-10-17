import {expect,it} from 'vitest';
import {generatePlan,validatePlan} from '../../src/engine';
import {Rules} from '../../src/engine/data';
import {goldenProfiles} from '../../tools/eval/training-engine-profiles';
import {improve} from '../../src/engine/improve';
import {createContext} from '../../src/engine/pipeline';
import {scorePlan,marginal} from '../../src/engine/score';
it('uses bounded real-score improvement without requiring a removed multi-add proof trace or mutating source identity',()=>{
 const p=goldenProfiles.find(x=>x.id==='mobility6x90')!.profile,r=new Rules(),plan=generatePlan(p),before=structuredClone(plan),ctx=createContext(p,0,r),next=improve(plan,ctx,{score:scorePlan,marginal},3);
 expect(plan).toEqual(before);expect(scorePlan(next,p,r).quality).toBeGreaterThanOrEqual(scorePlan(plan,p,r).quality);expect(validatePlan(next,p).filter(i=>i.severity==='error')).toEqual([]);expect(ctx.trace.filter(t=>t.step==='improve').length).toBeLessThanOrEqual(3);expect(improve(plan,createContext(p,0,r),{score:scorePlan,marginal},0)).toEqual(before);
 for(const t of next.templates){const positions=t.items.map(i=>i.prescription?.sourcePosition).filter(Boolean);expect(new Set(positions).size).toBe(positions.length);const ids=t.items.map(i=>i.exerciseId);expect(new Set(ids).size).toBe(ids.length);const ladders=t.items.map(i=>r.byExercise.get(i.exerciseId)?.ladder.id).filter(Boolean);expect(new Set(ladders).size).toBe(ladders.length);}
 const duplicate=structuredClone(next);duplicate.templates[0].items.push(structuredClone(duplicate.templates[0].items.find(i=>i.prescription?.block==='main')!));expect(validatePlan(duplicate,p).some(i=>i.code==='duplicate_exercise')).toBe(true);
});
