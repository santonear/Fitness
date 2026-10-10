import { describe,it,expect } from 'vitest';
import { createRepository } from '../../src/persistence/repository';
import { createReviewService } from '../../src/application/v8-review';
import type { FitnessDatabase } from '../../src/persistence/db';
import type { PlanVersion } from '../../src/domain/v8/contracts';
import type { ReviewSuggestion } from '../../src/application/review/contracts';
import { currentPlan as fixture } from '../fixtures/v8-plan-data';
import { exercises } from '../../src/catalog/exercises';
const currentPlan:PlanVersion={...fixture,id:'10000000-0000-4000-8000-000000000001',planId:'10000000-0000-4000-8000-000000000002',templates:fixture.templates.map(t=>({...t,items:t.items.map(i=>({...i,exerciseId:exercises.find(e=>e.metricType===i.target.metricType)!.id}))}))};
function setup(){
 let metadata={localProfileId:'p',schemaVersion:8,catalogVersion:1,revision:1,dataRevision:4,restoreGeneration:2};
 let plan={id:currentPlan.planId,currentVersionId:currentPlan.id,readOnly:false};
 let state:{currentPlanId:string;notice:{acknowledged:boolean};nextWorkoutOverride?:{planVersionId:string;templateId:string}}={currentPlanId:plan.id,notice:{acknowledged:true},nextWorkoutOverride:{planVersionId:currentPlan.id,templateId:currentPlan.templates[0].id}};
 const versions=new Map<string,PlanVersion>([[currentPlan.id,structuredClone(currentPlan)]]);
 const db={tables:[],transaction:async(_m:unknown,_t:unknown,fn:()=>Promise<unknown>)=>fn(),metadata:{toCollection:()=>({first:async()=>metadata}),put:async(next:typeof metadata)=>{metadata=next;}},v8State:{get:async()=>state,put:async(next:typeof state)=>{state=next;}},v8Plans:{get:async()=>plan,put:async(next:typeof plan)=>{plan=next;}},v8PlanVersions:{get:async(id:string)=>versions.get(id),add:async(v:PlanVersion)=>{versions.set(v.id,v);}}} as unknown as FitnessDatabase;
 const suggestion:ReviewSuggestion={id:'s',rule:'frequency',summary:'frequency',basedOnVersionId:currentPlan.id,proposal:{goalText:currentPlan.goalText,weeklyTarget:4,sessionMinutes:currentPlan.sessionMinutes,scheduleOriginalText:currentPlan.scheduleOriginalText,templates:structuredClone(currentPlan.templates),reasons:['','','']}};
 return {service:createReviewService(createRepository(db)),suggestion,versions,getPlan:()=>plan,getState:()=>state,makeReadOnly:()=>{plan.readOnly=true;}};
}
describe('review adoption guards',()=>{
 it('adds a version and retains the old version unchanged',async()=>{
  const s=setup(),before=structuredClone(s.versions.get(currentPlan.id));const next=await s.service.adopt(s.suggestion,4,2,'one extra session');
  expect(next.versionNumber).toBe(currentPlan.versionNumber+1);expect(next.basedOnVersionId).toBe(currentPlan.id);expect(next.weeklyTarget).toBe(4);
  expect(s.getPlan().currentVersionId).toBe(next.id);expect(s.versions.get(currentPlan.id)).toEqual(before);expect(s.versions.size).toBe(2);
  await expect(s.service.adopt(s.suggestion,5,2,'duplicate')).rejects.toMatchObject({code:'CONFLICT'});expect(s.versions.size).toBe(2);
 });
 it('removes only the temporary next-workout override after successful adoption',async()=>{
  const s=setup(),before=structuredClone(s.getState());
  await s.service.adopt(s.suggestion,4,2,'one extra session');
  const {nextWorkoutOverride:_override,...retained}=before;
  expect(s.getState()).toEqual(retained);expect(s.versions.get(currentPlan.id)).toEqual(currentPlan);
 });
 it.each([[3,2],[4,1]])('rejects stale revision or restored generation (%s,%s)',async(revision,generation)=>{
  const s=setup(),before=structuredClone(s.getState());await expect(s.service.adopt(s.suggestion,revision,generation,'change')).rejects.toMatchObject({code:'CONFLICT'});expect(s.versions.size).toBe(1);expect(s.getPlan().currentVersionId).toBe(currentPlan.id);expect(s.getState()).toEqual(before);
 });
 it('rejects a suggestion based on another current version',async()=>{
  const s=setup();await expect(s.service.adopt({...s.suggestion,basedOnVersionId:'old'},4,2,'change')).rejects.toMatchObject({code:'CONFLICT'});expect(s.versions.size).toBe(1);
 });
 it('rejects retained read-only plans',async()=>{
  const s=setup();s.makeReadOnly();await expect(s.service.adopt(s.suggestion,4,2,'change')).rejects.toMatchObject({code:'CONFLICT'});expect(s.versions.size).toBe(1);
 });
});
