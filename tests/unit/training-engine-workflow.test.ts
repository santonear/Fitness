import {afterEach,describe,expect,it,vi} from 'vitest';
import {createV8Workflow} from '../../src/application/v8-workflow';
import type {Repository} from '../../src/persistence/repository';
import type {CoachProfile} from '../../src/domain/v8/contracts';
import * as enginePlan from '../../src/application/engine-plan';
import {planProposalSchema} from '../../src/coach/contracts';
import {exercises} from '../../src/catalog/exercises';

const profile:CoachProfile={goalText:'保持活动',weeklyTarget:3,sessionMinutes:30,scheduleOriginalText:'每周三次',place:'home',equipment:['none'],adultConfirmed:true,cautions:[],confirmedAt:'2026-10-15T00:00:00Z'};
function setup(){return createV8Workflow({db:{profiles:{toCollection:()=>({first:async()=>({timeZone:'Asia/Shanghai',locale:'zh'})})},v8Workouts:{toArray:async()=>[]},v8State:{get:async()=>undefined},aiMemoryNotes:{toArray:async()=>[]}},readMetadata:async()=>({dataRevision:1,restoreGeneration:0})} as unknown as Repository);}
afterEach(()=>vi.restoreAllMocks());
describe('engine first-generation workflow gate',()=>{
 it('keeps the existing basic proposal when the feature is disabled',async()=>{
  const spy=vi.spyOn(enginePlan,'enginePlanProposal');
  const candidate=await setup().propose(profile,'zh');
  expect(candidate.source).toBe('local');expect(candidate.proposal.templates.length).toBeGreaterThan(0);expect(spy).not.toHaveBeenCalled();
 });
 it('never bypasses missing PARQ by falling back to an old basic plan',async()=>{
  const spy=vi.spyOn(enginePlan,'enginePlanProposal');
  await expect(setup().propose(profile,'zh',{trainingEngine:true})).rejects.toThrow('ENGINE_SCREENING_REQUIRED');expect(spy).not.toHaveBeenCalled();
 });
 it('preserves integer minutes and exact seconds through the candidate wire',()=>{
  const basic=setup();expect(basic.appendSetFeedback).toBeTypeOf('function');
  const result=planProposalSchema.safeParse({goalText:'活动',weeklyTarget:1,sessionMinutes:30,scheduleOriginalText:'',reasons:['一','二','三'],templates:[{id:'A',name:'A',estimatedMinutes:30,estimatedSeconds:1761,items:[{exerciseId:exercises[0].id,equipment:'none',sets:2,target:{metricType:'duration',durationSeconds:30}}]}]});
  expect(result.success).toBe(true);
  expect(planProposalSchema.safeParse(result.success?{...result.data,templates:[{...result.data.templates[0],estimatedMinutes:29.35}]}:{}).success).toBe(false);
 });
});
