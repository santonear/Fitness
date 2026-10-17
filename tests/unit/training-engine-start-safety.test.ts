import {Rules} from '../../src/engine/data';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {createV8Workflow} from '../../src/application/v8-workflow';
import type {Repository} from '../../src/persistence/repository';
import * as flags from '../../src/application/feature-flags';
import {generatePlan} from '../../src/engine';
import {engineProfileSchema} from '../../src/engine/contracts';

afterEach(()=>{vi.restoreAllMocks();vi.useRealTimers();});
describe('saved engine plan start safety',()=>{
 for(const withOverride of [false,true])it(`refuses new symptoms despite an existing ${withOverride?'today override':'saved template'}`,async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-15T10:00:00Z'));vi.spyOn(flags,'isFeatureEnabled').mockReturnValue(true);
  const date='2026-10-15T00:00:00Z',screening={cmrSymptoms:Object.fromEntries(new Rules().get('safety.screen.cmr_symptoms').symptoms.map((key:string)=>[key,false])),completedAt:date,parqAnswers:Array(7).fill(false),parqAllNo:true,knownCondition:false,symptoms:false,restingBp:'known_below_threshold' as const};
  const p=engineProfileSchema.parse({goal:'health',level:'beginner',trainingAgeWeeks:0,daysPerWeek:3,sessionMinutes:30,equipment:['none'],place:'home',constraints:{noJump:true,quiet:true,space:'small'},cautions:[],population:{kind:'general'},screening,preferences:{excludedExerciseIds:[],cannotDo:[]},birthYearMonth:'1990-01',asOfDate:'2026-10-15',timeZone:'Asia/Shanghai'});
  const enginePlan=generatePlan(p),template=enginePlan.templates[0];expect(template).toBeDefined();
  const version={id:'version',planId:'plan',enginePlan,templates:enginePlan.templates},plan={id:'plan',currentVersionId:'version',readOnly:false};
  const coachProfile={goalText:'活动',weeklyTarget:3,sessionMinutes:30,scheduleOriginalText:'每周三次',place:'home',equipment:['none'],adultConfirmed:true,cautions:[],confirmedAt:date,healthStorageConsent:{acceptedAt:date},population:{kind:'general'},screening:{...screening,symptoms:true},birthYearMonth:'1990-01'};
  const state={id:'v8',currentPlanId:'plan',legacyPlanIds:[],coachProfile,...(withOverride?{nextWorkoutOverride:{planVersionId:'version',templateId:template.id,template}}:{})};
  const add=vi.fn(),empty={toArray:async()=>[]},db={tables:[],transaction:async(_mode:unknown,_tables:unknown,fn:()=>unknown)=>fn(),v8State:{get:async()=>state},v8Plans:{get:async()=>plan,toArray:async()=>[plan]},v8PlanVersions:{get:async()=>version,toArray:async()=>[version]},v8Workouts:{...empty,where:()=>({equals:()=>({count:async()=>0})}),add},sessions:{where:()=>({equals:()=>({count:async()=>0})})},profiles:{toCollection:()=>({first:async()=>({timeZone:'Asia/Shanghai',locale:'zh'})})},aiMemoryNotes:empty,v8PlanReferences:empty,v8Activities:empty};
  const workflow=createV8Workflow({db,readMetadata:async()=>({dataRevision:1,restoreGeneration:0}),write:async(fn:()=>unknown)=>fn()} as unknown as Repository);
  expect(await workflow.nextTargetPreview(template.id)).toMatchObject({blocked:true,template:undefined});
  await expect(workflow.start(template.id)).rejects.toThrow('ENGINE_SCREENING_REQUIRED');expect(add).not.toHaveBeenCalled();
 });
});
