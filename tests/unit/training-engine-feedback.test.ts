import {describe,it,expect} from 'vitest';
import {createTrainingFeedback} from '../../src/application/training-feedback';
import type {Repository} from '../../src/persistence/repository';
import type {WorkoutRecord,SetFeedbackEvent} from '../../src/domain/v8/contracts';
import {exercises} from '../../src/catalog/exercises';
const id='71aa369e-e044-412c-89bd-0fbe8f39cc44',exerciseId=exercises[0].id,date='2026-10-15T01:00:00.000Z';
function setup(consented=true){let saved:WorkoutRecord={id,startedAt:date,endedAt:date,localDate:'2026-10-15',timeZone:'Asia/Shanghai',status:'complete',plannedSetCount:1,sets:[{itemIndex:0,setIndex:0,exerciseId,completedAt:date,reps:8}]};
 const repo={write:async<T>(fn:()=>Promise<T>,revision?:number)=>{if(revision!==undefined&&revision!==2)throw Error('STALE_REVISION');return fn();},db:{v8State:{get:async()=>({coachProfile:consented?{healthStorageConsent:{acceptedAt:date}}:{}})},v8Workouts:{get:async()=>structuredClone(saved),put:async(r:WorkoutRecord)=>{saved=structuredClone(r);}}}} as unknown as Repository;
 return{service:createTrainingFeedback(repo),read:()=>structuredClone(saved)};}
const event:SetFeedbackEvent={id,itemIndex:0,setIndex:0,exerciseId,createdAt:date,effort:'too_light'};
describe('append-only per-set feedback',()=>{
 it('preserves every completed fact and appends one explicit event',async()=>{const s=setup(),before=s.read();await s.service.append(id,event,2);const {setFeedbackEvents,...facts}=s.read();expect(facts).toEqual(before);expect(setFeedbackEvents).toEqual([event]);});
 it('idempotently accepts the same event and refuses conflicting reuse',async()=>{const s=setup();await s.service.append(id,event);await s.service.append(id,event);expect(s.read().setFeedbackEvents).toHaveLength(1);await expect(s.service.append(id,{...event,effort:'too_hard'})).rejects.toThrow('FEEDBACK_ID_REUSED');expect(s.read().setFeedbackEvents).toEqual([event]);});
 it('rejects feedback for a set never completed and stale revisions',async()=>{const s=setup();await expect(s.service.append(id,{...event,setIndex:1})).rejects.toThrow('SET_NOT_COMPLETED');await expect(s.service.append(id,event,1)).rejects.toThrow('STALE_REVISION');expect(s.read().setFeedbackEvents).toBeUndefined();});
 it('requires explicit discomfort score and area without inventing zero pain',async()=>{const s=setup();await expect(s.service.append(id,{...event,effort:'discomfort'})).rejects.toThrow();await s.service.append(id,{...event,effort:'discomfort',painScore:0,painArea:'knee'});expect(s.read().setFeedbackEvents?.[0].painScore).toBe(0);});
 it('cannot persist pain without separate local health consent',async()=>{const s=setup(false);await expect(s.service.append(id,{...event,effort:'discomfort',painScore:5,painArea:'knee'})).rejects.toThrow('HEALTH_STORAGE_CONSENT_REQUIRED');expect(s.read().setFeedbackEvents).toBeUndefined();await s.service.append(id,event);expect(s.read().setFeedbackEvents).toHaveLength(1);});
});
