import {describe,it,expect} from 'vitest';
import type {Plan,PlanChange} from '../../../src/engine/contracts';
import {Rules} from '../../../src/engine/data';
import {marginal,scorePlan} from '../../../src/engine/score';
import {fixtureProfile,planFixture} from './fixtures';
const rules=new Rules();type Item=Plan['templates'][number]['items'][number];
function main():Item {const item=structuredClone(planFixture().templates[0].items[0]),exercise=rules.data.exercises.find(e=>e.primary_pattern==='squat'&&e.modality==='strength'&&e.metricType==='reps')!;item.exerciseId=exercise.id;item.sets=2;item.target={metricType:'reps',reps:10};item.prescription={...item.prescription!,pattern:exercise.primary_pattern,block:'main',rir:[2,2],targetRpe:[5,5]};return item;}
function planWith(...items:Item[][]):Plan {const plan=planFixture(),template=plan.templates[0];plan.templates=items.map((entries,index)=>({...structuredClone(template),id:`boundary-${index}`,items:entries}));plan.weeklyTarget=fixtureProfile.daysPerWeek;return plan;}
function cardio():Item {const item=structuredClone(planFixture().templates[0].items[0]);item.prescription!.targetRpe=[5,5];return item;}
function rule(plan:Plan,id:string){return scorePlan(plan,fixtureProfile,rules).perRule.find(row=>row.id===id);}
function after(plan:Plan,change:PlanChange):Plan {const result=structuredClone(plan),template=result.templates.find(t=>t.id===change.templateId)!;if(change.kind==='add')template.items.push(change.item!);if(change.kind==='replace')template.items[change.itemIndex!]=change.item!;return result;}
describe('D actual scheduled RT-day applicability and marginal boundaries',()=>{
 it('does not apply weekly pattern coverage to one RT day plus a cardio day despite three available days',()=>{expect(rules.get('week.coverage.patterns').applies_when.rt_days_min).toBe(2);expect(rule(planWith([main()],[cardio()]),'week.coverage.patterns')).toBeUndefined();});
 it('applies weekly pattern coverage at two actual RT days and reports their real missing patterns',()=>{const coverage=rule(planWith([main()],[main()],[cardio()]),'week.coverage.patterns');expect(coverage).toBeDefined();expect(coverage!.satisfaction).toBeGreaterThan(0);expect(coverage!.satisfaction).toBeLessThan(1);});
 it('extra main items on the same day do not manufacture a second RT day',()=>expect(rule(planWith([main(),main()],[cardio()]),'week.coverage.patterns')).toBeUndefined());
 for(const [name,plan,change]of [
  ['empty draft to first noncircuit main',planWith([]),{kind:'add',templateId:'boundary-0',item:main()}],
  ['empty draft with existing moderate cardio to first main',planWith([],[cardio()]),{kind:'add',templateId:'boundary-0',item:main()}],
  ['first RT to second RT while moderate-cardio safety is applicable',planWith([main()],[],[cardio()]),{kind:'add',templateId:'boundary-1',item:main()}],
  ['two RT to one RT',planWith([main()],[main()],[cardio()]),{kind:'replace',templateId:'boundary-1',itemIndex:0,item:cardio()}],
 ] as [string,Plan,PlanChange][])it(name,()=>{const baseline=Object.freeze(plan),next=after(baseline,change),before=JSON.stringify(baseline);expect(marginal(baseline,change,fixtureProfile,rules)).toBeCloseTo(scorePlan(next,fixtureProfile,rules).quality-scorePlan(baseline,fixtureProfile,rules).quality,12);expect(marginal(baseline,change,fixtureProfile,rules)).toBeCloseTo(scorePlan(next,fixtureProfile,rules).quality-scorePlan(baseline,fixtureProfile,rules).quality,12);expect(JSON.stringify(baseline)).toBe(before);});
 it('second RT enters the coverage denominator and replacing it with cardio removes it',()=>{const first=planWith([main()],[],[cardio()]),second=after(first,{kind:'add',templateId:'boundary-1',item:main()});expect(rule(first,'week.coverage.patterns')).toBeUndefined();expect(rule(second,'week.coverage.patterns')).toBeDefined();expect(rule(after(second,{kind:'replace',templateId:'boundary-1',itemIndex:0,item:cardio()}),'week.coverage.patterns')).toBeUndefined();});
});
