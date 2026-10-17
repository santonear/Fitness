import {expect,it} from 'vitest';
import {generatePlan,validatePlan} from '../../src/engine';
import {Rules} from '../../src/engine/data';
import {goldenProfiles} from '../../tools/eval/training-engine-profiles';
import {externalIssues} from '../../tools/eval/training-engine-invariants';
import {scorePlan} from '../../src/engine/score';
it('retains authored main positions and source patterns while fitting the original mobility input',()=>{
 const p=goldenProfiles.find(x=>x.id==='mobility6x90')!.profile,r=new Rules(),plan=generatePlan(p),rt=plan.templates.filter(t=>t.items.some(i=>i.prescription?.block==='main'));
 expect(rt).toHaveLength(Math.min(p.daysPerWeek,r.get('goal.params.mobility').rt_sessions_week.max));
 const first=rt[0].items.find(i=>/(?:^|-)main_3$/.test(i.prescription?.sourcePosition??''));expect(first).toBeDefined();const source=r.get('week.day.fb_a').slots.find((slot:{pos:string})=>slot.pos==='main_3');expect(source.pattern).toContain(r.byExercise.get(first!.exerciseId)!.primary_pattern);expect(first!.prescription?.block).toBe('main');expect(first!.sets).toBeGreaterThanOrEqual(r.get('duration.fit.bounds').sets_per_exercise_min.other);
 if(first!.sets<r.get('dose.sets_exercise').min)expect(scorePlan(plan,p,r).perRule.find(row=>row.id==='dose.sets_exercise')!.satisfaction).toBeLessThan(1);
 expect(validatePlan(plan,p).filter(i=>i.severity==='error')).toEqual([]);expect(externalIssues(plan,p)).toEqual([]);
 const excess=structuredClone(plan),item=excess.templates.flatMap(t=>t.items).find(i=>i.exerciseId===first!.exerciseId)!;item.sets=r.get('dose.sets_exercise').max[p.level]+1;expect(validatePlan(excess,p).some(i=>i.code==='exercise_set_cap'&&i.severity==='error')).toBe(true);
});
