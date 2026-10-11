import { describe,it,expect } from 'vitest';
import { basicProposal, createV8Workflow } from '../../src/application/v8-workflow';
import { createRepository } from '../../src/persistence/repository';
import type { FitnessDatabase } from '../../src/persistence/db';
import { localCoachReply } from '../../src/coach/local-fallback';
import { estimatePlannedMinutes } from '../../src/application/rules/duration-estimate';
import { manualTrainingItems } from '../../src/application/rules/manual-items';
import { exercises,EXERCISE_IDS } from '../../src/catalog/exercises';
import type { CoachProfile } from '../../src/domain/v8/contracts';
import type { CoachRequest } from '../../src/coach/contracts';
const profile:CoachProfile={goalText:'活动',weeklyTarget:3,sessionMinutes:30,scheduleOriginalText:'每周3次，每次30–45分钟',place:'home',equipment:['none'],adultConfirmed:true,cautions:[],confirmedAt:'2026-10-10T00:00:00Z'};
const id='11111111-1111-4111-8111-111111111111';
const request=():Extract<CoachRequest,{task:'ADJUST_TODAY'}>=>({version:'fitness-coach-v8',requestId:id,conversationId:id,restoreGeneration:2,inputSnapshot:'local',sendConfirmation:'local',locale:'zh',timeZone:'Asia/Shanghai',adultConfirmed:true,messages:[],task:'ADJUST_TODAY',target:{planId:id,versionId:id,revision:4},template:basicProposal(profile)!.templates[0],instruction:'时间不够'});
describe('local coach fallback',()=>{
 it('fits the original duration range with consistent estimates and bounded sets',()=>{
  for(const template of basicProposal(profile)!.templates){expect(template.estimatedMinutes).toBeGreaterThanOrEqual(30);expect(template.estimatedMinutes).toBeLessThanOrEqual(45);expect(template.estimatedMinutes).toBe(estimatePlannedMinutes(template.items));expect(template.items.every(i=>i.sets<=5)).toBe(true);}
 });
 it('keeps actual shorter estimates for long requested slots',()=>{
  const result=basicProposal({...profile,sessionMinutes:120,scheduleOriginalText:'每次120分钟'})!;
  expect(result.templates[0].estimatedMinutes).toBeLessThan(120);expect(result.reasons[1]).toContain('没有填满');
 });
 it('offers a today-only shorter candidate without changing the input',()=>{
  const input=request(),before=structuredClone(input);const reply=localCoachReply('今天时间不够',input,profile);
  expect(reply.lines).toHaveLength(4);expect(reply.response?.type).toBe('today_adjustment');
  if(reply.response?.type==='today_adjustment'){expect(reply.response.template.estimatedMinutes).toBeLessThan(input.template.estimatedMinutes);expect(reply.response.template.estimatedMinutes).toBe(estimatePlannedMinutes(reply.response.template.items));}
  expect(input).toEqual(before);
 });
 it('gives the exact pain reminder without inferring an unknown replacement',()=>{
  const reply=localCoachReply('膝盖很痛',request(),profile);expect(reply.response).toBeUndefined();expect(reply.lines.join('')).toContain('如果疼痛明显或持续，先休息，并请专业人士看看');
 });
 it('offers only an existing conservative replacement for one named movement and known area',()=>{
  const input=request();const squat=input.template.items.find(i=>i.exerciseId===EXERCISE_IDS.bodyweightSquat)!;
  const reply=localCoachReply(`${exercises.find(e=>e.id===squat.exerciseId)!.name.zh}膝盖不舒服`,input,profile);
  expect(reply.response?.type).toBe('today_adjustment');
  if(reply.response?.type==='today_adjustment')expect(reply.response.template.items.find(i=>i.exerciseId===squat.exerciseId)).toBeUndefined();
 });
 it('does not infer a candidate without plan context and supports review navigation',()=>{
  expect(localCoachReply('时间不够').response).toBeUndefined();expect(localCoachReply('想看看这周').review).toBe(true);
 });
 it('shortens only untouched movements in an active workout',()=>{
  const input={...request(),workoutId:id},before=structuredClone(input);
  const reply=localCoachReply('今天时间不够',input,profile,'zh',[0]);
  expect(reply.response?.type).toBe('today_adjustment');
  if(reply.response?.type==='today_adjustment'){expect(reply.response.workoutId).toBe(id);expect(reply.response.template.items[0]).toEqual(input.template.items[0]);expect(reply.response.template.estimatedMinutes).toBeLessThan(input.template.estimatedMinutes);}
  expect(input).toEqual(before);
 });
 it('preserves unknown load and distance in manual defaults and validates every id',()=>{
  const ids=['reps_load','duration','duration_distance','reps'].map(metric=>exercises.find(e=>e.metricType===metric)!.id);
  const items=manualTrainingItems([...ids,ids[0]]);expect(items).toHaveLength(4);expect(items.every(item=>item.sets===2)).toBe(true);
  expect(items[0].target).toEqual({reps:8});expect(items[2].target).toEqual({durationSeconds:20});expect(estimatePlannedMinutes(items)).toBeGreaterThanOrEqual(15);
  expect(()=>manualTrainingItems([ids[0],'unknown'])).toThrow();expect(()=>manualTrainingItems([])).toThrow();
 });
 it('starts one multi-action workout, rejects invalid ids before writes, and prevents a second active workout',async()=>{
  let records:any[]=[],meta:any={localProfileId:id,schemaVersion:10,catalogVersion:1,revision:0,dataRevision:0,restoreGeneration:0};
  const db={tables:[],transaction:async(_m:unknown,_t:unknown,fn:()=>Promise<unknown>)=>fn(),metadata:{toCollection:()=>({first:async()=>meta}),put:async(value:unknown)=>{meta=value;}},v8Workouts:{where:()=>({equals:()=>({count:async()=>records.length})}),add:async(value:unknown)=>{records.push(value);}},sessions:{where:()=>({equals:()=>({count:async()=>0})})},v8State:{get:async()=>undefined},profiles:{toCollection:()=>({first:async()=>({timeZone:'Asia/Shanghai'})})}} as unknown as FitnessDatabase;
  const workflow=createV8Workflow(createRepository(db));
  await expect(workflow.start(undefined,undefined,[EXERCISE_IDS.bodyweightSquat,'unknown'])).rejects.toThrow();expect(records).toHaveLength(0);
  const record=await workflow.start(undefined,undefined,[EXERCISE_IDS.bodyweightSquat,EXERCISE_IDS.plank,EXERCISE_IDS.bodyweightSquat]);
  expect(records).toHaveLength(1);expect(record.plannedSetCount).toBe(4);expect(record.plannedExercises).toHaveLength(2);expect(record.sets).toEqual([]);
  await expect(workflow.start(undefined,EXERCISE_IDS.plank)).rejects.toMatchObject({code:'CONFLICT'});expect(records).toHaveLength(1);
 });
 it.each([{confirmed:true,saved:undefined,allowed:true},{confirmed:false,saved:undefined,allowed:false},{confirmed:undefined,saved:undefined,allowed:false},{confirmed:true,saved:false,allowed:false}])('manual candidate adult boundary %j',async({confirmed,saved,allowed})=>{
  const records:any[]=[];let meta:any={localProfileId:id,schemaVersion:10,catalogVersion:1,revision:0,dataRevision:0,restoreGeneration:0};
  const db={tables:[],transaction:async(_m:unknown,_t:unknown,fn:()=>Promise<unknown>)=>fn(),metadata:{toCollection:()=>({first:async()=>meta}),put:async(value:unknown)=>{meta=value;}},v8Workouts:{where:()=>({equals:()=>({count:async()=>records.length})}),add:async(value:unknown)=>{records.push(value);}},sessions:{where:()=>({equals:()=>({count:async()=>0})})},v8State:{get:async()=>saved===undefined?undefined:{coachProfile:{adultConfirmed:saved}}},profiles:{toCollection:()=>({first:async()=>({timeZone:'Asia/Shanghai'})})}} as unknown as FitnessDatabase;
  const workflow=createV8Workflow(createRepository(db)),template={id:'manual-candidate',name:'候选',estimatedMinutes:15,items:[{exerciseId:EXERCISE_IDS.bodyweightSquat,equipment:'none',sets:3,target:{metricType:'reps' as const,reps:11}},{exerciseId:EXERCISE_IDS.bodyweightSquat,equipment:'none',sets:1,target:{metricType:'reps' as const,reps:6}}]};
  const attempt=workflow.start(undefined,undefined,[EXERCISE_IDS.bodyweightSquat],{template,adultConfirmed:confirmed as boolean,expectedRevision:0,restoreGeneration:0});
  if(allowed){const record=await attempt;expect(record.templateSnapshot).toEqual(template);expect(record.planVersionId).toBeUndefined();expect(record.plannedSetCount).toBe(4);expect(record.plannedExercises).toHaveLength(2);}else{await expect(attempt).rejects.toThrow();expect(records).toHaveLength(0);}
 });

});
