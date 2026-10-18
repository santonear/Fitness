import {expect,it} from 'vitest';
import {goldenProfiles} from '../../tools/eval/training-engine-profiles';
import {validatePlan} from '../../src/engine';
import {scorePlan} from '../../src/engine/score';
import {Rules} from '../../src/engine/data';
import type {EnginePlan} from '../../src/engine/contracts';
import frozenPlan from '../fixtures/training-engine/mobility6x90-682989c.json';
import {independentElapsedAllocation,independentGoalShareIssues} from '../unit/engine/reference/training-engine-goal-share';

const profile=goldenProfiles.find(row=>row.id==='mobility6x90')!.profile;
const rules=new Rules();
// Explicit six-day fixture: two resistance days and four formal mobility days.
// Recipes describe generation; they do not establish additional V2 hard limits.
const resistance=rules.data.exercises.find(e=>e.modality==='strength'&&e.metricType==='reps'&&e.primary_pattern==='squat'&&e.equipment_required.every(k=>k==='none'))!;
const mobility=rules.data.exercises.find(e=>e.modality==='mobility'&&e.mobility_type==='static')!;
const plan:EnginePlan={weeklyTarget:6,sessionMinutes:90,templates:Array.from({length:6},(_,index)=>({id:`manual-${index}`,name:'Manual source fixture',estimatedMinutes:index<2?90:20,...(index<2?{}:{targetMinutes:20}),items:index<2?[{exerciseId:resistance.id,equipment:'none',sets:2,target:{metricType:'reps' as const,reps:10},prescription:{pattern:resistance.primary_pattern,block:'main' as const,rir:[3,4] as [number,number],restSeconds:120,secondsPerRep:4}}]:[{exerciseId:mobility.id,equipment:mobility.equipment_required[0],sets:2,target:{metricType:'duration' as const,durationSeconds:30},prescription:{pattern:mobility.primary_pattern,block:'mobility' as const,rir:[4,4] as [number,number],restSeconds:0}}]})),meta:{engineVersion:'fixture',rulesVersion:rules.data.rulesVersion,seed:'manual-cn1'},gates:[],notices:[],trace:[]};
// A retained-slot counterfactual is explicit: source overrun may legitimately remove the factory slot.
const authored=structuredClone(frozenPlan.templates[0].items.find(item=>item.prescription.block==='conditioning')!);
authored.sets=1;authored.target={metricType:'duration',durationSeconds:900};
authored.prescription.structure='straight';
for(const template of plan.templates.filter(template=>template.items.some(item=>item.prescription?.block==='main'))){
 template.items=template.items.filter(item=>item.prescription?.block!=='conditioning');
 template.items.push(structuredClone(authored) as typeof template.items[number]);
}
const rtIndex=plan.templates.findIndex(template=>template.items.some(item=>item.prescription?.block==='main'));
const errors=(value=plan,p=profile)=>validatePlan(value,p).filter(issue=>issue.code==='conditioning_slot_dose');
const goalScore=(value:EnginePlan,p=profile)=>scorePlan(value,p,rules).perRule.find(row=>row.id===`goal.params.${p.goal}`)!.satisfaction;
const retainedRecipeMatches=(value:EnginePlan)=>value.templates.filter(t=>t.items.some(i=>i.prescription?.block==='main')).every(t=>t.items.filter(i=>i.prescription?.block==='conditioning').every(i=>i.sets===1&&'durationSeconds'in i.target&&i.target.durationSeconds>=900&&i.target.durationSeconds<=1200&&i.prescription?.structure==='straight'&&!i.prescription.groupId));

it('validates a retained authored ninety-minute RT continuous CN1 dose independently of estimated metadata',()=>{
 const slot=rules.get('session.template.min90').slots.find((value:{slot:string})=>value.slot==='CN1');
 expect(slot.minutes).toEqual([15,20]);
 const rt=plan.templates.filter(template=>template.items.some(item=>item.prescription?.block==='main'));
 expect(rt).toHaveLength(2);
 for(const template of rt){
  const conditioning=template.items.filter(item=>item.prescription?.block==='conditioning');
  expect(conditioning).toHaveLength(1);
  expect(conditioning[0].sets).toBe(1);
  expect(conditioning[0].prescription).toMatchObject({structure:'straight'});
  expect(conditioning[0].prescription?.groupId).toBeUndefined();
  expect(conditioning[0].target).toMatchObject({durationSeconds:900});
 }
 expect(errors()).toEqual([]);
 for(const seconds of [900,1200]){
  const next=structuredClone(plan),item=next.templates[rtIndex].items.find(item=>item.prescription?.block==='conditioning')!;
  item.target={metricType:'duration',durationSeconds:seconds};
  expect(errors(next)).toEqual([]);
 }
});

it('rejects short/long retained dose, four sets, or a fabricated group',()=>{
 expect(rules.byId.get('session.template.min90')?.severity).toBe('mechanic');expect(retainedRecipeMatches(plan)).toBe(true);
 for(const mutation of ['short','long','sets','group'] as const){
  const next=structuredClone(plan),template=next.templates[rtIndex];
  const item=template.items.find(item=>item.prescription?.block==='conditioning')!;
  if(mutation==='short'||mutation==='long')item.target={metricType:'duration',durationSeconds:mutation==='short'?899:1201};
  if(mutation==='sets'){item.sets=4;item.target={metricType:'duration',durationSeconds:45};}
  if(mutation==='group')item.prescription={...item.prescription!,structure:'circuit',groupId:'fabricated-cn1'};
  expect(retainedRecipeMatches(next),mutation).toBe(false);
  // Exact template recipe deviations remain observable; they are not health failures.
  expect(errors(next),mutation).toEqual([]);
 }
});

it('permits source overrun removal without treating absent CN1 as a dose error, while aerobic share stays strict',()=>{
 const strength={...profile,goal:'strength' as const};
 const next=structuredClone(plan);next.templates=next.templates.slice(0,2);const before=structuredClone(next);
 for(const template of next.templates)template.items=template.items.filter(item=>rules.byExercise.get(item.exerciseId)?.modality!=='cardio');
 expect(next.templates.some(template=>template.items.some(item=>item.prescription?.block==='main'))).toBe(true);
 expect(independentElapsedAllocation(next).aerobic).toBe(0);
 expect(independentElapsedAllocation(next).resistance).toBeGreaterThan(0);
 expect(independentGoalShareIssues(next,strength).some(issue=>issue.severity==='error')).toBe(true);
 expect(goalScore(next,strength)).toBeLessThan(goalScore(before,strength));
 expect(validatePlan(next,strength).some(issue=>issue.severity==='error'&&issue.code==='goal_time_share')).toBe(false);
 expect(errors(next,strength)).toEqual([]);
});

it('keeps the old frozen four-by-forty-five-second conditioning as an invalid source counterexample',()=>{
 const frozen=structuredClone(frozenPlan) as unknown as EnginePlan;
 const oldRt=frozen.templates.filter(template=>template.items.some(item=>item.prescription?.block==='main'));
 expect(oldRt.length).toBeGreaterThan(0);
 expect(oldRt.some(template=>template.items.some(item=>item.prescription?.block==='conditioning'&&item.sets===4&&'durationSeconds'in item.target&&item.target.durationSeconds===45))).toBe(true);
 expect(retainedRecipeMatches(frozen)).toBe(false);
 const repaired=structuredClone(frozen);for(const t of repaired.templates)for(const item of t.items)if(item.prescription?.block==='conditioning'&&t.items.some(i=>i.prescription?.block==='main')){item.sets=1;item.target={metricType:'duration',durationSeconds:900};item.prescription.structure='straight';delete item.prescription.groupId;}
 expect(goalScore(frozen)).toBeLessThan(goalScore(repaired));expect(errors(frozen)).toEqual([]);
});

it('does not invent CN1 on pure formal twenty-minute mobility or pure aerobic days',()=>{
 const formal=plan.templates.filter(template=>template.targetMinutes===20);
 expect(formal).toHaveLength(4);
 for(const template of formal)expect(template.items.some(item=>item.prescription?.block==='conditioning')).toBe(false);
 expect(errors({...structuredClone(plan),templates:structuredClone(formal)})).toEqual([]);
 const pure=structuredClone(plan);
 pure.templates[rtIndex].items=pure.templates[rtIndex].items.filter(item=>!['main','accessory'].includes(item.prescription?.block??''));
 expect(errors(pure)).toEqual([]);
 expect(errors(plan,{...profile,sessionMinutes:20})).toEqual([]);
});
