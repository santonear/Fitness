import {describe,expect,it} from 'vitest';
import {aiMemoryNoteSchema} from '../../src/domain/schemas';
import {confirmedPreferenceChanges} from '../../src/persistence/assistant-preferences';
import {EXERCISE_IDS} from '../../src/catalog/exercise-ids';
import {assistantMovement,selectAssistantCandidates} from '../../src/catalog/ai-catalog';
import type {AssistantRequest} from '../../src/assistant/contracts';
import type {CoachRequest,CoachResponse} from '../../src/coach/contracts';

const now='2026-10-12T00:00:00.000Z';
const legacy={id:crypto.randomUUID(),createdAt:now,updatedAt:now,revision:0,memoRevision:0,generatorVersion:'legacy',locale:'zh',suggestion:'old note',explanation:'old explanation'};
const item=(exerciseId:string)=>({exerciseId,equipment:'none',sets:2,target:{metricType:'reps',reps:10}});

describe('confirmed assistant preferences',()=>{
 it('keeps old memory notes readable and requires both structured fields',()=>{
  expect(aiMemoryNoteSchema.safeParse(legacy).success).toBe(true);
  expect(aiMemoryNoteSchema.safeParse({...legacy,kind:'cannot_do',value:'jumping'}).success).toBe(true);
  expect(aiMemoryNoteSchema.safeParse({...legacy,kind:'cannot_do'}).success).toBe(false);
 });
 it('stores canonical replacement and weekday choices only after an applied card',()=>{
  const original={id:'A',name:'A',estimatedMinutes:30,items:[item(EXERCISE_IDS.bodyweightSquat)]};
  const updated={...original,items:[item(EXERCISE_IDS.gobletSquat)]};
  const request={task:'MODIFY_PLAN',plan:{preferredDays:['mon','wed'],templates:[original]}} as unknown as CoachRequest;
  const response={type:'change_proposal',proposal:{preferredDays:['mon','wed','fri'],templates:[updated]}} as unknown as CoachResponse;
  expect(confirmedPreferenceChanges(request,response,'徒手深蹲我不会做，改成其他动作')).toEqual([
   {kind:'preferred_days',value:['mon','wed','fri']},
   {kind:'dislike_exercise',value:EXERCISE_IDS.bodyweightSquat},
  ]);
  expect(confirmedPreferenceChanges(request,response,'换个动作试试')).toEqual([{kind:'preferred_days',value:['mon','wed','fri']}]);
 });
 it('remembers an applied farmer walk replacement as a durable walking-carry exclusion',()=>{
  const farmer='a7206000-3774-5daf-8bf6-f20b5a1dca70';
  const original={id:'A',name:'A',estimatedMinutes:30,items:[item(farmer)]};
  const updated={...original,items:[item(EXERCISE_IDS.plank)]};
  const request={task:'MODIFY_PLAN',plan:{preferredDays:['mon'],templates:[original]}} as unknown as CoachRequest;
  const response={type:'change_proposal',proposal:{preferredDays:['mon'],templates:[updated]}} as unknown as CoachResponse;
  expect(confirmedPreferenceChanges(request,response,'以后别给我安排农夫行走了，把计划里的换掉')).toEqual([
   {kind:'cannot_do',value:'walking_carry'},
   {kind:'dislike_exercise',value:farmer},
  ]);
  expect(confirmedPreferenceChanges(request,response,'把农夫行走换掉')).toEqual([]);
  expect(confirmedPreferenceChanges(request,{type:'change_proposal',proposal:{preferredDays:['mon'],templates:[original]}} as unknown as CoachResponse,'以后别给我安排农夫行走了')).toEqual([]);
  const unrelated={...original,items:[item(farmer),item(EXERCISE_IDS.plank)]};
  expect(confirmedPreferenceChanges(request,{type:'change_proposal',proposal:{preferredDays:['mon'],templates:[unrelated]}} as unknown as CoachResponse,'以后别给我安排农夫行走了')).toEqual([]);
 });
 it('excludes remembered walking carries from a later candidate list',()=>{
  const request={messages:[{role:'user',content:'给我加一个练腿动作'}],preferences:[{kind:'cannot_do',value:'walking_carry'}]} as AssistantRequest;
  expect(selectAssistantCandidates(request).every(({exercise})=>assistantMovement(exercise)!=='carry')).toBe(true);
 });
});
