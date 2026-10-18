import {expect,it} from 'vitest';
import {continuousCardioItems} from '../../../src/engine/dose';
import {Rules} from '../../../src/engine/data';
import {estimateSeconds} from '../../../src/engine/fit';
import {elapsedAllocation} from '../../../src/engine/fit/elapsed-time';
import {scorePlan} from '../../../src/engine/score';
import {fixtureProfile,planFixture} from './fixtures';
const r=new Rules(),p=fixtureProfile;
function fixture(){const plan=planFixture(),e=r.data.exercises.find(e=>e.slug==='walking')!,item=plan.templates[0].items[0];plan.templates[0].items=[{...item,exerciseId:e.id,sets:3,target:{metricType:'duration_distance',durationSeconds:100,distanceMeters:120},prescription:{...item.prescription!,block:'conditioning',structure:'straight',targetRpe:[5,6]}}];return plan;}
it('represents continuous work as one bout without changing elapsed time, distance, quality or input',()=>{
 const before=fixture(),snapshot=structuredClone(before),after=structuredClone(before);after.templates[0].items=continuousCardioItems(before.templates[0].items,p,r);
 expect(after.templates[0].items[0]).toMatchObject({sets:1,target:{durationSeconds:300,distanceMeters:360}});
 expect(estimateSeconds(after.templates[0],r)).toBe(estimateSeconds(before.templates[0],r));expect(elapsedAllocation(after.templates[0],r)).toEqual(elapsedAllocation(before.templates[0],r));expect(scorePlan(after,p,r)).toEqual(scorePlan(before,p,r));expect(before).toEqual(snapshot);
});
it('keeps interval goals and explicit circuit structures unchanged',()=>{const plan=fixture();expect(continuousCardioItems(plan.templates[0].items,{...p,goal:'fat_loss'},r)).toEqual(plan.templates[0].items);plan.templates[0].items[0].prescription!.structure='circuit';expect(continuousCardioItems(plan.templates[0].items,p,r)).toEqual(plan.templates[0].items);});
it('does not hide invalid fractional set counts or invent a distance field',()=>{const plan=fixture(),item=plan.templates[0].items[0];item.sets=1.5;expect(continuousCardioItems([item],p,r)[0].sets).toBe(1.5);item.sets=3;item.target={metricType:'duration',durationSeconds:100};expect(continuousCardioItems([item],p,r)[0].target).toEqual({metricType:'duration',durationSeconds:300});});
