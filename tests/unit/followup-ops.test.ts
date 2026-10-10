import { describe, expect, it } from 'vitest';
import { monitoringError, incrementAnonymousCount } from '../../src/application/monitoring';
import { assessDailyUsage } from '../../src/backend/daily-usage-monitor';
import { coachEvaluationPlan, estimateEvaluationBound } from '../../src/backend/coach-v8-evaluation';
import { readCoachRequestEnvelope, readCoachResponseEnvelope, writeCoachRequestEnvelope } from '../../src/coach/wire-versions';
import { coachRequestSchema } from '../../src/coach/contracts';
import { coachEvaluationFixture } from '../../src/backend/coach-evaluation-fixtures';
import { evaluateCoachV8Response } from '../../src/backend/coach-v8-evaluation';
import { coachScope, coachMessageScope } from '../../src/coach/consent';
import { validateCandidate, type CoachEnvelope } from '../../src/backend/contracts';

const id = '00000000-0000-4000-8000-000000000001';
const request = coachRequestSchema.parse({ version:'fitness-coach-v8', requestId:id, conversationId:id,
  restoreGeneration:0,inputSnapshot:'scope',sendConfirmation:'confirmed',locale:'en',timeZone:'UTC',adultConfirmed:true,messages:[],
  task:'ONBOARD_PLAN',profile:{goalText:'habit',weeklyTarget:2,sessionMinutes:20,scheduleOriginalText:'20 minutes',place:'home',equipment:[],adultConfirmed:true,cautions:[]} });

describe('follow-up operations boundaries', () => {
  it('withholds nutrition by default including initial messages', () => {
    const input = {...request,nutrition:[{localDate:'2026-10-11',meal:'synthetic lunch'}]};
    expect(coachScope(input)).not.toHaveProperty('nutrition');
    expect(coachMessageScope(input,'hello')).not.toHaveProperty('nutrition');
    expect(coachScope(input,false,false,true).nutrition).toEqual(input.nutrition);
  });
  it.each(['8.1','8.0'] as const)('reads %s without changing identity or content', schemaVersion => {
    expect(readCoachRequestEnvelope(writeCoachRequestEnvelope(request,schemaVersion))).toEqual(request);
    expect(readCoachResponseEnvelope(request,{schemaVersion,payload:{requestId:id,restoreGeneration:0,mutationAllowed:false,type:'refused',reason:'Unavailable'}}).type).toBe('refused');
    expect(() => readCoachResponseEnvelope(request,{schemaVersion,payload:{requestId:id,restoreGeneration:1,mutationAllowed:false,type:'refused',reason:'Unavailable'}})).toThrow();
  });
  it.each([undefined,'8.0','8.1'] as const)('keeps the old unwrapped response for schema %s', schemaVersion => {
    const envelope: CoachEnvelope = {contractVersion:1,requestId:id,locale:'en',restoreGeneration:0,operation:'generate',goalText:'habit',sendConfirmation:'x'.repeat(64),coach:request,...(schemaVersion ? {schemaVersion} : {})};
    const output = {requestId:id,restoreGeneration:0,mutationAllowed:false,type:'refused',reason:'Unavailable'};
    expect(validateCandidate(envelope,output)).toEqual(output);
  });
  it('rejects unknown versions and unsupported management payloads', () => {
    expect(() => readCoachRequestEnvelope({schemaVersion:'9.0',payload:request})).toThrow();
    expect(() => readCoachResponseEnvelope(request,{schemaVersion:'8.1',payload:{type:'management_proposal'}})).toThrow();
  });
  it('does not collect by default and rejects extra text or identifiers', () => {
    const safe = {type:'network',page:'plan',version:'v8',browser:'chromium'};
    expect(monitoringError(safe)).toBeUndefined();
    expect(monitoringError(safe,true)).toEqual(safe);
    for (const extra of [{message:'health detail'},{userId:id},{url:'/plan/'+id},{stack:'trace'}]) expect(monitoringError({...safe,...extra},true)).toBeUndefined();
    expect(monitoringError({...safe,page:'/plan/'+id},true)).toBeUndefined();
  });
  it('requires opt-in and rollout for anonymous counts', () => {
    expect(incrementAnonymousCount({},'workout_completed')).toEqual({});
    expect(incrementAnonymousCount({},'workout_completed',true,false)).toEqual({});
    expect(incrementAnonymousCount({},'workout_completed',false,true)).toEqual({});
    expect(incrementAnonymousCount({},'workout_completed',true,true)).toEqual({workout_completed:1});
    expect(incrementAnonymousCount({},id,true,true)).toEqual({});
  });
  it('keeps accounting read-only and fallback disabled unless explicitly enabled', () => {
    const observation = {day:'2026-10-11',calls:3,reservedFen:20};
    expect(assessDailyUsage(observation,{calls:20,costFen:100}).fallbackRequired).toBe(false);
    expect(assessDailyUsage(observation,{calls:20,costFen:100},true).fallbackRequired).toBe(true);
    expect(assessDailyUsage({...observation,costFen:80},{calls:20,costFen:100},true).fallbackRequired).toBe(true);
    expect(observation).not.toHaveProperty('costFen');
  });
  it('bounds all 28 planned cases and never authorizes a paid call', () => {
    expect(coachEvaluationPlan).toHaveLength(28);
    expect(estimateEvaluationBound({inputFenPerMillion:100,outputFenPerMillion:200})).toMatchObject({calls:28,costBoundFen:34,paidExecutionEnabled:false,approvalRequired:true});
  });
  it.each(coachEvaluationPlan)('validates synthetic fixture $scenario $locale $repetition', entry => {
    const fixture = coachEvaluationFixture(entry.scenario, entry.locale);
    expect(coachRequestSchema.safeParse(fixture).success).toBe(true);
    if (entry.scenario === 'under-18') expect(evaluateCoachV8Response(entry.scenario,fixture,undefined).structuralGate).toBe('request-rejected');
    if (entry.scenario === 'notes-withheld') expect(fixture).not.toHaveProperty('history');
  });
});
