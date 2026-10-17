import {scorePlan} from '../../src/engine/score';
import {it,expect} from 'vitest';
import {goldenProfiles} from '../../tools/eval/training-engine-profiles';
import {generatePlan,validatePlan} from '../../src/engine';
import {Rules} from '../../src/engine/data';
import {buildWeek} from '../../src/engine/structure';
import {buildSlots} from '../../src/engine/skeleton';
import {runGates} from '../../src/engine/gates';
import {weeklyVolume,volumeLimits} from '../../src/engine/dose';
import {estimateSeconds} from '../../src/engine/fit';
import {independentElapsedAllocation} from '../unit/engine/reference/training-engine-goal-share';
it('retains real source positions and legal weekly work without requiring the removed cross-day bench-copy strategy',()=>{
 const p=goldenProfiles.find(x=>x.id==='mobility6x90')!.profile,r=new Rules(),before=structuredClone(p),plan=generatePlan(p),week=buildWeek(p,runGates(p,r),r),rt=plan.templates.filter(t=>t.items.some(i=>i.prescription?.block==='main'));
 expect(rt).toHaveLength(Math.min(p.daysPerWeek,r.get('goal.params.mobility').rt_sessions_week.max));
 let positions=0;for(const t of plan.templates){const day=week.days.find(day=>day.id===t.id)!;expect(day).toBeDefined();const slots=buildSlots(day,p,day.minutes,r);for(const item of t.items.filter(i=>['main','accessory'].includes(i.prescription?.block??''))){const pos=item.prescription?.sourcePosition;if(!pos)continue;positions++;const slot=slots.find(slot=>slot.id===pos);expect(slot,pos).toBeDefined();expect(slot!.patterns).toContain(r.byExercise.get(item.exerciseId)!.primary_pattern);expect(t.items.filter(i=>i.prescription?.sourcePosition===pos)).toHaveLength(1);}expect(t.targetMinutes).toBe(p.sessionMinutes);expect(estimateSeconds(t,r)).toBe(independentElapsedAllocation({templates:[t]}).total);}
 expect(positions).toBeGreaterThan(0);const volume=weeklyVolume(plan,r),cap=volumeLimits(p,r).max;expect(Object.values(volume).some(n=>n>cap)).toBe(true);expect(scorePlan(plan,p,r).perRule.find(row=>row.id==='dose.sets_week.goal_matrix')!.satisfaction).toBeLessThan(1);expect(validatePlan(plan,p).filter(i=>i.severity==='error')).toEqual([]);expect(p).toEqual(before);
});
