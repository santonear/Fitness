import { describe, it, expect } from 'vitest';
import { exercises } from '../../src/catalog/exercises';
import { discomfortReplacement } from '../../src/application/rules/basic-items';
import { recurringDiscomfort, suggestChange } from '../../src/application/review/suggest';
import { computeWeekFacts } from '../../src/application/review/compute';
import { currentPlan } from '../fixtures/v8-plan-data';
import type { CoachProfile, WorkoutRecord } from '../../src/domain/v8/contracts';
const profile: CoachProfile = { goalText:'strength', weeklyTarget:3, sessionMinutes:30, scheduleOriginalText:'30 min', place:'home', equipment:[], adultConfirmed:true, cautions:[], confirmedAt:'2026-09-01T00:00:00Z' };
const id = (name:string) => exercises.find(e=>e.name.en===name)!.id;
const squat=id('Bodyweight squat');
const plan={...currentPlan,templates:[{...currentPlan.templates[0],items:[{exerciseId:squat,equipment:'none',sets:2,target:{metricType:'reps' as const,reps:8}},currentPlan.templates[0].items[1]]}]};
const facts=computeWeekFacts({from:'2026-10-05',to:'2026-10-11',timeZone:'UTC',weeklyTarget:3,workouts:[],activities:[],bodyWeights:[]});
function workout(day:number, pain=true):WorkoutRecord{return {id:String(day),planVersionId:plan.id,startedAt:`2026-10-0${day}T12:00:00Z`,localDate:`2026-10-0${day}`,timeZone:'UTC',status:'partial',plannedSetCount:2,sets:[{exerciseId:squat,itemIndex:0,setIndex:0,reps:8,completedAt:`2026-10-0${day}T12:01:00Z`}],feedback:{reasons:pain?['discomfort']:[],discomfortExerciseIds:pain?[squat]:[]}};}
const input={plan,current:facts,previous:{...facts,from:'2026-09-28',to:'2026-10-04'},workouts:[workout(5),workout(6)],dismissedIds:[],profile};
describe('conservative discomfort proposals',()=>{
 it('requires the last two actual attempts to report discomfort',()=>{
  expect(recurringDiscomfort(input)).toEqual([squat]);
  expect(recurringDiscomfort({...input,workouts:[workout(5),workout(6,false),workout(7)]})).toEqual([]);
  expect(recurringDiscomfort({...input,workouts:[workout(5)]})).toEqual([]);
 });
 it('replaces only the affected movement and preserves completed facts',()=>{
  const before=structuredClone(input),result=suggestChange(input)!;
  expect(result.rule).toBe('discomfort');expect(result.proposal.templates[0].items[0].exerciseId).toBe(id('Clamshells'));
  expect(result.proposal.templates[0].items[1]).toEqual(plan.templates[0].items[1]);expect(input).toEqual(before);
  expect(suggestChange({...input,dismissedIds:[result.id]})).toBeNull();
 });
 it('does not invent replacements for unknown movements, missing profile or other restrictions',()=>{
  expect(discomfortReplacement('unknown',profile)).toBeUndefined();
  expect(suggestChange({...input,profile:undefined})).toBeNull();
  expect(suggestChange({...input,profile:{...profile,cautions:['other']}})).toBeNull();
  expect(suggestChange({...input,profile:{...profile,cautions:['back']}})).toBeNull();
  expect(recurringDiscomfort({...input,profile:undefined})).toEqual([squat]);
 });
 it('requires available equipment and respects body-area exclusions',()=>{
  const row=id('Bent-Over Dumbbell Row');
  expect(discomfortReplacement(row,profile)).toBeUndefined();
  expect(discomfortReplacement(row,{...profile,equipment:['resistance band']})?.exerciseId).toBe(id('Band Pull Apart'));
  expect(discomfortReplacement(row,{...profile,equipment:['resistance band'],cautions:['wrist']})).toBeUndefined();
 });
 it('counts an unperformed discomfort substitution but deduplicates within a workout',()=>{
  const rows=input.workouts.map(w=>({...w,sets:[],substitutions:[{fromExerciseId:squat,toExerciseId:'other',itemIndex:0,reason:'discomfort' as const,createdAt:w.startedAt}]}));
  expect(recurringDiscomfort({...input,workouts:rows})).toEqual([squat]);
  expect(recurringDiscomfort({...input,workouts:[rows[0]]})).toEqual([]);
 });
});
