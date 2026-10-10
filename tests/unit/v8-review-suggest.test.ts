import { describe,it,expect } from 'vitest';
import { suggestChange } from '../../src/application/review/suggest';
import { computeWeekFacts } from '../../src/application/review/compute';
import { currentPlan } from '../fixtures/v8-plan-data';
import type { WorkoutRecord } from '../../src/domain/v8/contracts';
const facts=computeWeekFacts({from:'2026-10-05',to:'2026-10-11',timeZone:'UTC',weeklyTarget:3,workouts:[],activities:[],bodyWeights:[]});
const plan={...currentPlan,createdAt:'2026-09-01T00:00:00Z',templates:[{...currentPlan.templates[0],items:[...currentPlan.templates[0].items,currentPlan.templates[1].items[0]]}]};
const input={current:facts,previous:{...facts,from:'2026-09-28',to:'2026-10-04'},plan,workouts:[],dismissedIds:[]};
describe('review suggestions remain optional and evidence based',()=>{
 it('offers one short template for two time constraints without mutating a plan',()=>{
  const before=structuredClone(plan),r=suggestChange({...input,current:{...facts,reasonCounts:{...facts.reasonCounts,time:2}}})!;
  expect(r.rule).toBe('time');expect(r.proposal.templates.at(-1)?.items.map(i=>i.sets)).toEqual([2,2,2]);expect(plan).toEqual(before);
  expect(suggestChange({...input,current:{...facts,reasonCounts:{...facts.reasonCounts,time:2}},dismissedIds:[r.id]})).toBeNull();
 });
 it('does not treat a newly created plan as two missed weeks',()=>expect(suggestChange({...input,plan:{...plan,createdAt:'2026-10-06T00:00:00Z'}})).toBeNull());
 it('offers frequency increase only when both weeks reach target',()=>{
  expect(suggestChange({...input,current:{...facts,complete:3},previous:{...input.previous,complete:3}})?.proposal.weeklyTarget).toBe(4);
  expect(suggestChange({...input,current:{...facts,complete:3}})).toBeNull();
 });
 it('never increases a seven day target',()=>expect(suggestChange({...input,plan:{...plan,weeklyTarget:7},current:{...facts,complete:7},previous:{...input.previous,complete:7}})).toBeNull());
 it('offers a short restart plan without altering the original templates',()=>{
  const result=suggestChange(input)!;expect(result.rule).toBe('restart');expect(result.proposal.weeklyTarget).toBe(2);expect(result.proposal.templates[0].estimatedMinutes).toBe(20);expect(result.proposal.templates[0].items).toHaveLength(3);expect(plan.templates[0].estimatedMinutes).toBe(30);
 });
 it('requires three consecutive complete exercise snapshots and ignores absent evidence',()=>{
  const rows:WorkoutRecord[]=Array.from({length:3},(_,i)=>({id:String(i),planVersionId:plan.id,startedAt:`2026-10-0${5+i}T12:00:00Z`,localDate:`2026-10-0${5+i}`,timeZone:'UTC',status:'partial',plannedSetCount:3,plannedExercises:[{exerciseId:'squat',itemIndex:0,plannedSetCount:1}],sets:[{exerciseId:'squat',itemIndex:0,setIndex:0,reps:10,completedAt:`2026-10-0${5+i}T12:01:00Z`}],feedback:{feel:'right',reasons:[]}}));
  const active={...input,current:{...facts,complete:1},workouts:rows};
  expect(suggestChange(active)?.rule).toBe('progression');
  expect(suggestChange({...active,workouts:rows.map(r=>({...r,plannedExercises:undefined}))})).toBeNull();
  rows[2].feedback={reasons:['discomfort'],discomfortExerciseIds:['squat']};expect(suggestChange(active)).toBeNull();
 });
});
