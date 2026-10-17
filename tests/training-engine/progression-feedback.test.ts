import {describe,expect,it} from 'vitest';
import {nextTargets} from '../../src/engine';
import type {EnginePlan,EngineProfile} from '../../src/engine/contracts';
import type {WorkoutRecord} from '../../src/domain/v8/contracts';
import {baseProfile} from '../../tools/eval/training-engine-profiles';

const exerciseId='d16325d9-fc00-4c41-88a1-000000000001';
function plan():EnginePlan{return {weeklyTarget:1,sessionMinutes:30,templates:[{id:'feedback-template',name:'测试训练',estimatedMinutes:30,items:[{exerciseId,equipment:'dumbbell',sets:2,target:{metricType:'reps_load',reps:15,loadGrams:10000},prescription:{pattern:'squat',block:'main',rir:[3,4],restSeconds:90,structure:'straight'}}]}],meta:{engineVersion:'fixture',rulesVersion:'fixture',seed:'feedback'},trace:[],notices:[],gates:[]};}
function profile():EngineProfile&{availableLoadsKg:Record<string,number[]>}{return {...baseProfile({goal:'health',level:'intermediate',trainingAgeWeeks:52,equipment:['none','dumbbell','kettlebell'],daysPerWeek:1}),availableLoadsKg:{[exerciseId]:[10,10.5,11]}};}
function record(day:string):WorkoutRecord{return {id:`record-${day}`,templateId:'feedback-template',localDate:day,timeZone:'Asia/Shanghai',status:'complete',startedAt:`${day}T08:00:00.000Z`,endedAt:`${day}T08:30:00.000Z`,plannedSetCount:2,sets:[0,1].map(setIndex=>({exerciseId,itemIndex:0,setIndex,reps:15,loadGrams:10000,completedAt:`${day}T08:20:00.000Z`})),setFeedbackEvents:[]};}
describe('append-only feedback projection and bounded loads',()=>{
 it('keeps a strength accessory rep range when its source container is main',()=>{
  const p=profile();p.goal='strength';const input=plan(),item=input.templates[0].items[0];item.target={metricType:'reps_load',reps:12,loadGrams:10000};item.prescription!.goalRole='accessory';item.prescription!.sourcePosition='main_3';
  const history=['2026-10-12','2026-10-14'].map(day=>{const entry=record(day);for(const fact of entry.sets){fact.reps=12;entry.setFeedbackEvents!.push({id:`${day}-${fact.setIndex}`,exerciseId,itemIndex:0,setIndex:fact.setIndex,effort:'right',rir:4,createdAt:`${day}T08:20:00.000Z`});}return entry;});
  const before=structuredClone(input),output=nextTargets(history,input,p),next=output.value.templates[0].items[0];
  expect(next.target.metricType).toBe('reps_load');if(next.target.metricType!=='reps_load')throw Error('Changed metric unexpectedly');
  expect(next.target.loadGrams).toBeGreaterThan(10000);expect(next.target.reps).toBeGreaterThanOrEqual(8);expect(next.target.reps).toBeLessThanOrEqual(12);
  expect(next.prescription).toMatchObject({block:'main',sourcePosition:'main_3',goalRole:'accessory'});expect(input).toEqual(before);
 });
 it('uses the latest feedback event for each exact item and set when checking double progression',()=>{
  const history=['2026-10-12','2026-10-14'].map(day=>{
   const entry=record(day);
   for(const setIndex of [0,1])entry.setFeedbackEvents!.push(
    {id:`${day}-${setIndex}-early`,exerciseId,itemIndex:0,setIndex,effort:'too_light',rir:4,createdAt:`${day}T08:20:00.000Z`},
    {id:`${day}-${setIndex}-latest`,exerciseId,itemIndex:0,setIndex,effort:'right',rir:setIndex===0?2:3,createdAt:`${day}T08:21:00.000Z`});
   return entry;
  });
  const input=plan(),before=JSON.stringify(history),result=nextTargets(history,input,profile());
  expect(result.value.templates[0].items[0]).toEqual(input.templates[0].items[0]);
  expect(result.diff).toEqual([]);expect(JSON.stringify(history)).toBe(before);
 });
 it('does not count duplicate events inside one workout as two completed workouts',()=>{
  const entry=record('2026-10-14');
  for(const setIndex of [0,1])for(const suffix of ['a','b'])entry.setFeedbackEvents!.push({id:`${setIndex}-${suffix}`,exerciseId,itemIndex:0,setIndex,effort:'right',rir:4,createdAt:'2026-10-14T08:20:00.000Z'});
  const input=plan(),result=nextTargets([entry],input,profile());
  expect(result.value.templates[0].items[0]).toEqual(input.templates[0].items[0]);expect(result.diff).toEqual([]);
 });
 it('keeps the previous load when every available step would exceed the allowed increase',()=>{
  const entry=record('2026-10-14');entry.setFeedbackEvents=[{id:'too-light',exerciseId,itemIndex:0,setIndex:1,effort:'too_light',rir:5,createdAt:'2026-10-14T08:20:00.000Z'}];
  const p=profile();p.availableLoadsKg={[exerciseId]:[20]};const input=plan(),result=nextTargets([entry],input,p),target=result.value.templates[0].items[0].target;
  expect(target.metricType).toBe('reps_load');if(target.metricType!=='reps_load')throw Error('Changed metric unexpectedly');
  expect(target.loadGrams).toBeLessThanOrEqual(11000);
  expect(target.loadGrams).toBe(10000);expect(target.reps).toBeGreaterThanOrEqual(15);
 });
 it('does not apply feedback from another item index sharing the same exercise ID',()=>{
  const history=['2026-10-12','2026-10-14'].map(day=>{
   const entry=record(day);
   for(const setIndex of [0,1])entry.setFeedbackEvents!.push(
    {id:`${day}-${setIndex}-item0`,exerciseId,itemIndex:0,setIndex,effort:'right',rir:3,createdAt:`${day}T08:20:00.000Z`},
    {id:`${day}-${setIndex}-item1`,exerciseId,itemIndex:1,setIndex,effort:'too_hard',rir:0,createdAt:`${day}T08:21:00.000Z`});
   return entry;
  });
  const result=nextTargets(history,plan(),profile()),target=result.value.templates[0].items[0].target;
  expect(target.metricType).toBe('reps_load');if(target.metricType!=='reps_load')throw Error('Changed metric unexpectedly');
  expect(target.loadGrams).toBeGreaterThan(10000);
 });
});
