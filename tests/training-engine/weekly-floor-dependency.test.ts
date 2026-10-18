import {legacySampledProfile} from './v1-inputs';
import {expect,it} from 'vitest';
import {generatePlan,validatePlan} from '../../src/engine';

import {Rules} from '../../src/engine/data';
import {scorePlan} from '../../src/engine/score';
import {credit} from '../../src/engine/dose';
it('retains the original weekly-cap input and records an actual quadriceps target shortfall',()=>{
 const p=legacySampledProfile(5),before=structuredClone(p),plan=generatePlan(p),r=new Rules(),issues=validatePlan(plan,p);
 expect(issues.filter(i=>i.code==='weekly_volume_floor')).toEqual([]);
 expect(issues.filter(i=>['excluded_exercise','intensity_cap','isometric_hold_bounds','weekly_volume_cap','session_volume_cap'].includes(i.code))).toEqual([]);
 expect(p).toEqual(before);
 const bad=structuredClone(plan);for(const t of bad.templates)for(const i of t.items)if((credit(i,r).quads??0)>0)i.sets=1;
 const quads=bad.templates.flatMap(t=>t.items).reduce((sum,i)=>sum+(credit(i,r).quads??0),0);expect(quads).toBeLessThan(r.get('goal.params.muscle').sets_per_muscle_week.min);const row=scorePlan(bad,p,r).perRule.find(row=>row.id==='dose.sets_week.goal_matrix');expect(row).toBeDefined();expect(row!.satisfaction).toBeLessThan(1);expect(validatePlan(bad,p).some(i=>i.code==='weekly_volume_floor')).toBe(false);
});
