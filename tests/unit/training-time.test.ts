import { describe, expect, it } from 'vitest';
import { trainingSlotSchema } from '../../src/domain/training-time';
import { nextPlanningWindow } from '../../src/ai/guided-planning';
import { plannedExerciseSchema } from '../../src/domain/schemas';
import { EXERCISE_IDS } from '../../src/catalog/exercises';
import { guidedInputSnapshot } from '../../src/ai/guided-dialogue';
import { guidedDialogueRequestSchema, type GuidedDialogueRequest } from '../../src/domain/guided-ai-contracts';
import { validateGuidedProviderInput, validateGuidedProviderOutput } from '../../src/backend/legacy-guided-reader';

const id = 'd16325d9-fc00-4c41-88a1-000000000001';
function request(days = 14): GuidedDialogueRequest {
  const window = nextPlanningWindow(Date.parse('2026-10-07T00:00:00Z'), 'Asia/Shanghai', days);
  const input = { version: 'guided-dialogue-v1' as const, conversationId:id, restoreGeneration:0, purpose:'program' as const,locale:'en' as const,scope:{goal:'General fitness',conditions:{}},...window,timeZone:'Asia/Shanghai',confirmedSummary:'General fitness',schedule:window.dates.map(date=>({date,startTime:'12:00',durationMinutes:30})) };
  return {...input,requestId:id,inputSnapshot:guidedInputSnapshot(input)};
}
const exercise = {exerciseId:EXERCISE_IDS.bodyweightSquat,order:0,targetSets:[{metricType:'reps' as const,reps:8}],setTimings:[{durationSeconds:40,restSeconds:60}]};
describe('confirmed training schedule', () => {
  it('accepts 1–14 calendar days across month and DST changes, rejects other spans', () => {
    for (const days of [1,14]) expect(nextPlanningWindow(Date.parse('2026-10-31T23:00:00Z'),'America/New_York',days).dates).toHaveLength(days);
    for(const days of [0,15,1.5]) expect(()=>nextPlanningWindow(Date.now(),'UTC',days)).toThrow();
  });
  it('requires valid wall-clock times ending within the same day', () => {
    for(const time of ['12:00','14:00','09:00','20:00','23:30']) expect(trainingSlotSchema.safeParse({date:'2026-10-08',startTime:time,durationMinutes:30}).success).toBe(true);
    for(const time of ['24:00','12:60','9:00','23:45','']) expect(trainingSlotSchema.safeParse({date:'2026-10-08',startTime:time,durationMinutes:30}).success).toBe(false);
  });
  it('allows legacy unknown estimates but requires matching set counts and timed targets', () => {
    expect(plannedExerciseSchema.safeParse({...exercise,setTimings:undefined}).success).toBe(true);
    expect(plannedExerciseSchema.safeParse({...exercise,setTimings:[]}).success).toBe(false);
    expect(plannedExerciseSchema.safeParse({...exercise,targetSets:[{metricType:'duration',durationSeconds:60}]}).success).toBe(false);
  });
  it('rejects missing, duplicated, unconfirmed and over-range dates', () => {
    const req=request();
    expect(guidedDialogueRequestSchema.safeParse(req).success).toBe(true);
    for(const changed of [{schedule:req.schedule!.slice(1)},{schedule:req.schedule!.map(()=>req.schedule![0])},{dateSelection:'ai'},{endDate:'2026-11-08'}]) expect(guidedDialogueRequestSchema.safeParse({...req,...changed}).success).toBe(false);
    expect(()=>validateGuidedProviderInput(req,14)).not.toThrow();
    expect(()=>validateGuidedProviderInput(req,7)).toThrow();
  });
  it('returns all 14 confirmed times and rejects missing or excessive duration estimates', () => {
    const req=request(); const raw={kind:'program',name:'Fixture',explanation:'Synthetic test',days:req.dates!.map(date=>({date,exercises:[exercise]}))};
    const response=validateGuidedProviderOutput(req,raw);
    expect('candidate' in response && response.candidate.days.map(day=>day.startTime)).toEqual(Array(14).fill('12:00'));
    for(const sets of [undefined,[{durationSeconds:1801,restSeconds:0}]]) expect(()=>validateGuidedProviderOutput(req,{...raw,days:raw.days.map(day=>({...day,exercises:[{...exercise,setTimings:sets}]}))})).toThrow();
  });
  it('accepts nonconsecutive selected dates across a month within the 31-day bound', () => {
    const {requestId,inputSnapshot: previousSnapshot,...base}=request(2);
    const dates=['2026-10-25','2026-11-07'];
    const input={...base,startDate:dates[0],endDate:dates[1],dates,schedule:dates.map(date=>({date,startTime:'12:00',durationMinutes:30}))};
    const value={...input,requestId,inputSnapshot:guidedInputSnapshot(input)};
    expect(guidedDialogueRequestSchema.safeParse(value).success).toBe(true);
    expect(()=>validateGuidedProviderInput(value,14)).not.toThrow();
  });
});
