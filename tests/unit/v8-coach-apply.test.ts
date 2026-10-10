import { describe,it,expect } from 'vitest';
import { createV8Workflow } from '../../src/application/v8-workflow';
import { createRepository } from '../../src/persistence/repository';
import type { FitnessDatabase } from '../../src/persistence/db';
import type { CoachRequest,CoachResponse } from '../../src/coach/contracts';
import { EXERCISE_IDS } from '../../src/catalog/exercises';
const id='11111111-1111-4111-8111-111111111111',vid='22222222-2222-4222-8222-222222222222',wid='33333333-3333-4333-8333-333333333333';
const template={id:'A',name:'A',estimatedMinutes:20,items:[{exerciseId:EXERCISE_IDS.bodyweightSquat,equipment:'none',sets:2,target:{metricType:'reps' as const,reps:8}}]};
function setup(active=false){
 let meta={localProfileId:id,schemaVersion:8,catalogVersion:1,revision:1,dataRevision:4,restoreGeneration:2};
 let state:any={id:'v8',currentPlanId:id,migratedAt:'2026-10-10T00:00:00Z',legacyPlanIds:[],notice:{planCount:0,acknowledged:true}};
 let plan={id,currentVersionId:vid,readOnly:false,name:'habit'};
 const version={id:vid,planId:id,versionNumber:1,goalText:'habit',weeklyTarget:2,sessionMinutes:20,scheduleOriginalText:'20 minutes',templates:[template],createdAt:'2026-10-10T00:00:00Z',origin:'onboard',changeSummary:[]};
 const versions=new Map([[vid,version]]);
 let workout:any=active?{id:wid,planVersionId:vid,templateId:'A',templateSnapshot:structuredClone(template),startedAt:'2026-10-10T00:00:00Z',localDate:'2026-10-10',timeZone:'UTC',status:'in_progress',sets:[],plannedSetCount:2,plannedExercises:[{exerciseId:EXERCISE_IDS.bodyweightSquat,itemIndex:0,plannedSetCount:2}]}:undefined;
 const db={tables:[],transaction:async(_m:unknown,_t:unknown,fn:()=>Promise<unknown>)=>fn(),metadata:{toCollection:()=>({first:async()=>meta}),put:async(v:typeof meta)=>{meta=v;}},v8State:{get:async()=>state,put:async(v:any)=>{state=v;}},v8Plans:{get:async(k:string)=>k===plan.id?plan:undefined,put:async(v:any)=>{plan=v;},add:async(v:any)=>{plan=v;},toCollection:()=>({modify:async(v:any)=>{plan={...plan,...v};}})},v8PlanVersions:{get:async(k:string)=>versions.get(k),add:async(v:any)=>{versions.set(v.id,v);}},v8Workouts:{get:async()=>workout,put:async(v:any)=>{workout=v;},where:()=>({equals:()=>({count:async()=>workout?.status==='in_progress'?1:0})})}} as unknown as FitnessDatabase;
 const target={planId:id,versionId:vid,revision:4};
 const request:CoachRequest={version:'fitness-coach-v8',requestId:id,conversationId:id,restoreGeneration:2,inputSnapshot:'revision4',sendConfirmation:'confirmed',locale:'en',timeZone:'UTC',adultConfirmed:true,messages:[],task:'ADJUST_TODAY',target,template,instruction:'shorter',...(active?{workoutId:wid}:{})};
 const response:CoachResponse={requestId:id,restoreGeneration:2,mutationAllowed:false,type:'today_adjustment',target,template:{...template,items:template.items.map(i=>({...i,sets:1}))},summary:'shorter',...(active?{workoutId:wid}:{})};
 return {workflow:createV8Workflow(createRepository(db)),request,response,versions,get:()=>({state,plan,workout,meta}),completeSet:()=>{workout.sets=[{exerciseId:EXERCISE_IDS.bodyweightSquat,itemIndex:0,setIndex:0,reps:8,completedAt:'2026-10-10T00:01:00Z'}];}};
}
describe('explicit coach candidate application',()=>{
 it('adopting a new plan clears an older today-only override',async()=>{const s=setup();await s.workflow.applyCoachCandidate({...s,expectedRevision:4});expect(s.get().state.nextWorkoutOverride).toBeDefined();await s.workflow.adopt({type:'plan_proposal',requestId:crypto.randomUUID(),mutationAllowed:false,restoreGeneration:2,expectedRevision:5,profile:{goalText:'habit',weeklyTarget:2,sessionMinutes:20,scheduleOriginalText:'20 minutes',place:'home',equipment:[],adultConfirmed:true,cautions:[],confirmedAt:'2026-10-10T00:00:00Z'},proposal:{goalText:'habit',weeklyTarget:2,sessionMinutes:20,scheduleOriginalText:'20 minutes',templates:[template],reasons:['a','b','c']}});expect(s.get().state.nextWorkoutOverride).toBeUndefined();expect(s.versions.size).toBe(2);});
 it('only stages a one-workout override, retaining the overall plan',async()=>{const s=setup();const before=structuredClone([...s.versions]);await s.workflow.applyCoachCandidate({...s,expectedRevision:4});expect(s.get().state.nextWorkoutOverride.template.items[0].sets).toBe(1);expect([...s.versions]).toEqual(before);await expect(s.workflow.applyCoachCandidate({...s,expectedRevision:4})).rejects.toMatchObject({code:'CONFLICT'});});
 it.each([3,5])('rejects stale revisions (%s)',async expectedRevision=>{const s=setup();await expect(s.workflow.applyCoachCandidate({...s,expectedRevision})).rejects.toThrow();expect(s.get().state.nextWorkoutOverride).toBeUndefined();});
 it('rejects replaced data and mismatched response identity',async()=>{const s=setup();await expect(s.workflow.applyCoachCandidate({...s,request:{...s.request,restoreGeneration:1},response:{...s.response,restoreGeneration:1},expectedRevision:4})).rejects.toThrow();await expect(s.workflow.applyCoachCandidate({...s,response:{...s.response,requestId:wid},expectedRevision:4})).rejects.toThrow();});
 it('adjusts an untouched active workout without changing plan templates',async()=>{const s=setup(true);await s.workflow.applyCoachCandidate({...s,expectedRevision:4});expect(s.get().workout.plannedSetCount).toBe(1);expect(s.versions.get(vid)!.templates[0].items[0].sets).toBe(2);});
 it('rejects changes to an item with completed facts',async()=>{const s=setup(true);s.completeSet();const before=structuredClone(s.get().workout);await expect(s.workflow.applyCoachCandidate({...s,expectedRevision:4})).rejects.toThrow();expect(s.get().workout).toEqual(before);});
});
