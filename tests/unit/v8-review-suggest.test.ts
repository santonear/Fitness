import { describe,it,expect } from 'vitest';
import { estimatePlannedMinutes } from '../../src/domain/duration-estimate';
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
  expect(r.proposal.templates.at(-1)?.estimatedMinutes).toBe(estimatePlannedMinutes(r.proposal.templates.at(-1)!.items));expect(r.proposal.templates.at(-1)?.name).toBe(`${r.proposal.templates.at(-1)?.estimatedMinutes} min`);expect(r.proposal.sessionMinutes).toBe(15);expect(r.proposal.templates).toHaveLength(plan.templates.length);expect(r.proposal.templates[0].id).toBe(plan.templates[0].id);expect(r.rule).toBe('time');expect(r.proposal.templates.at(-1)?.items.map(i=>i.sets)).toEqual([2,2,2]);expect(plan).toEqual(before);
  expect(suggestChange({...input,current:{...facts,reasonCounts:{...facts.reasonCounts,time:2}},dismissedIds:[r.id]})).toBeNull();
 });
 it('does not treat a newly created plan as two missed weeks',()=>expect(suggestChange({...input,plan:{...plan,createdAt:'2026-10-06T00:00:00Z'}})).toBeNull());
 it('offers frequency increase only when both weeks reach target',()=>{
  expect(suggestChange({...input,current:{...facts,complete:3},previous:{...input.previous,complete:3}})?.proposal.weeklyTarget).toBe(4);
  expect(suggestChange({...input,current:{...facts,complete:3}})).toBeNull();
 });
 it('never increases a seven day target',()=>expect(suggestChange({...input,plan:{...plan,weeklyTarget:7},current:{...facts,complete:7},previous:{...input.previous,complete:7}})).toBeNull());
 it('offers a short restart plan without altering the original templates',()=>{
  const result=suggestChange({...input,todayLocalDate:'2026-10-12',completedWeeks:[input.previous,facts]})!;expect(result.rule).toBe('restart');expect(result.proposal.weeklyTarget).toBe(2);expect(result.proposal.templates[0].estimatedMinutes).toBe(estimatePlannedMinutes(result.proposal.templates[0].items));expect(result.proposal.templates[0].items).toHaveLength(3);expect(plan.templates[0].estimatedMinutes).toBe(30);
 });
 it('does not lower frequency from an unfinished week or absent period evidence',()=>{
  expect(suggestChange(input)).toBeNull();
  expect(suggestChange({...input,todayLocalDate:'2026-10-10',completedWeeks:[input.previous,facts]})).toBeNull();
  expect(suggestChange({...input,todayLocalDate:'2026-10-12',completedWeeks:[{...input.previous,complete:1},facts]})).toBeNull();
  expect(suggestChange({...input,todayLocalDate:'2026-10-12',completedWeeks:[{...input.previous,partial:2,movementCount:3},facts]})?.rule).toBe('restart');
 });
 it('requires three consecutive complete exercise snapshots and ignores absent evidence',()=>{
  const rows:WorkoutRecord[]=Array.from({length:3},(_,i)=>({id:String(i),planVersionId:plan.id,startedAt:`2026-10-0${5+i}T12:00:00Z`,localDate:`2026-10-0${5+i}`,timeZone:'UTC',status:'partial',plannedSetCount:3,plannedExercises:[{exerciseId:'squat',itemIndex:0,plannedSetCount:1}],sets:[{exerciseId:'squat',itemIndex:0,setIndex:0,reps:10,completedAt:`2026-10-0${5+i}T12:01:00Z`}],feedback:{feel:'right',reasons:[]}}));
  const active={...input,current:{...facts,complete:1},workouts:rows};
  const result=suggestChange(active)!;expect(result.rule).toBe('progression');expect(result.proposal.templates[0].estimatedMinutes).toBe(estimatePlannedMinutes(result.proposal.templates[0].items));
  expect(suggestChange({...active,workouts:rows.map(r=>({...r,plannedExercises:undefined}))})).toBeNull();
  expect(suggestChange({...active,workouts:[...rows,{...rows[2],id:'unknown-snapshot',startedAt:'2026-10-08T12:00:00Z',localDate:'2026-10-08',plannedExercises:undefined}]})).toBeNull();
  rows[2].feedback={reasons:['discomfort'],discomfortExerciseIds:['squat']};expect(suggestChange(active)).toBeNull();
 });
 it('re-estimates a repetition increase and leaves the original plan and unchanged templates intact',()=>{
  const exerciseId='squat';
  const selected={...plan,templates:[{...plan.templates[0],items:[{exerciseId,equipment:'none',sets:1,target:{metricType:'reps' as const,reps:300}}],estimatedMinutes:20},currentPlan.templates[1]]};
  const rows:WorkoutRecord[]=Array.from({length:3},(_,index)=>{const date=`2026-10-0${5+index}`;return {id:date,planVersionId:selected.id,startedAt:`${date}T12:00:00Z`,localDate:date,timeZone:'UTC',status:'complete',plannedSetCount:1,plannedExercises:[{exerciseId,itemIndex:0,plannedSetCount:1}],sets:[{exerciseId,itemIndex:0,setIndex:0,reps:300,completedAt:`${date}T12:01:00Z`}],feedback:{feel:'easy',reasons:[]}};});
  const before=structuredClone(selected),result=suggestChange({...input,plan:selected,workouts:rows})!;
  expect(result.rule).toBe('progression');expect(result.proposal.templates[0].items[0].target).toEqual({metricType:'reps',reps:301});
  expect(result.proposal.templates[0].estimatedMinutes).toBe(25);expect(result.proposal.templates[0].estimatedMinutes).toBe(estimatePlannedMinutes(result.proposal.templates[0].items));
  expect(result.proposal.templates[1]).toEqual(selected.templates[1]);expect(result.proposal.sessionMinutes).toBe(25);expect(selected).toEqual(before);
 });
});
