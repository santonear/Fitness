import { z } from 'zod';
import type { AiRequest } from '../backend/contracts';
import { validateRequest, validateCandidate, canonical } from '../backend/contracts';
import { DomainError } from '../domain/errors';
import type { LocalProfile, PlannedExercise } from '../domain/models';
import { datePlanVersionSchema, planSchema, scheduledWorkoutSchema, plannedExerciseSchema, localDateSchema } from '../domain/schemas';
import type { Repository } from '../persistence/repository';
import { slotTasks } from './day-plans';
import { evaluateSlot } from '../domain/day-slot-policy';
import { readAiSnapshot } from './ai-context';
import { buildHistoryContext, type HistoryPayload, type HistoryScope } from './history-context';
import { exercises } from '../catalog/exercises';
export type GenerationAiRequest = Extract<AiRequest,{operation:'generate'}>;
declare const tokenBrand: unique symbol;
export type AiSaveToken = Readonly<{[tokenBrand]:true}>;
export interface AiCandidateEdit { date:string; name:string; exercises:PlannedExercise[] }
const editSchema=z.array(z.strictObject({date:localDateSchema,name:z.string().trim().min(1).max(200),exercises:z.array(plannedExerciseSchema).min(1).max(32)})).length(1);
interface Prepared {request:GenerationAiRequest;profile:LocalProfile;generatedAt:string;used:boolean;historyScope?:HistoryScope;historyPayload?:HistoryPayload}
function profileConditions(profile:LocalProfile) {
  const {updatedAt:_updatedAt,daysPerWeek:_daysPerWeek,trainingWeekdays:_trainingWeekdays,...conditions}=profile.trainingPreferences??{};
  return canonical(conditions);
}
function invalid(message:string):never {throw new DomainError('INVALID',message);}
export function createAiCandidateService(repo:Repository) {
  const tokens=new WeakMap<AiSaveToken,Prepared>(),db=repo.db;
  async function checkHistory(state:Prepared) {
    if (!state.historyScope || !state.historyPayload) return;
    const {snapshot}=await readAiSnapshot(repo);
    const built=buildHistoryContext({...snapshot,capturedAt:state.historyPayload.capturedAt,dataRevision:state.historyPayload.dataRevision},state.historyScope);
    if (!built.ok || built.json!==state.request.history?.text) throw new DomainError('CONFLICT','Selected history changed; generate a new candidate');
  }
  return {
    async prepare(value:GenerationAiRequest,candidate:unknown):Promise<AiSaveToken> {
      const request=await validateRequest(value,1,65536);
      if(request.operation!=='generate') return invalid('Generation request required');
      validateCandidate(request,candidate);
      return db.transaction('r',db.tables,async()=>{
        const {profile,snapshot}=await readAiSnapshot(repo);
        if(snapshot.restoreGeneration!==request.restoreGeneration) throw new DomainError('CONFLICT','Library restored; generate a new candidate');
        if(profile.timeZone!==request.timeZone) throw new DomainError('CONFLICT','Calendar time zone changed');
        const state:Prepared={request:structuredClone(request),profile,generatedAt:snapshot.capturedAt,used:false};
        if(request.history){
          let payload:HistoryPayload;
          try {payload=JSON.parse(request.history.text);} catch {return invalid('Invalid history context');}
          if(!payload||typeof payload!=='object'||!payload.range||!localDateSchema.safeParse(payload.range.from).success||!localDateSchema.safeParse(payload.range.to).success||payload.range.from>payload.range.to||!Number.isFinite(Date.parse(payload.capturedAt))||payload.format!=='fitness-history-context'||payload.version!==1||payload.dataRevision!==request.history.sourceRevision||payload.restoreGeneration!==request.restoreGeneration||payload.range.from!==request.history.range.from||payload.range.to!==request.history.range.to||!Array.isArray(payload.sources)) return invalid('History envelope mismatch');
          state.historyPayload=payload;state.historyScope={from:payload.range.from,to:payload.range.to,sources:payload.sources,maxUtf8Bytes:32000};
          await checkHistory(state);
        }
        const token=Object.freeze({}) as AiSaveToken;tokens.set(token,state);return token;
      });
    },
    async save(token:AiSaveToken,value:AiCandidateEdit[]) {
      const state=tokens.get(token);if(!state||state.used) throw new DomainError('CONFLICT','Candidate identity expired or already saved');
      const parsed=editSchema.safeParse(value);if(!parsed.success) return invalid('Enter exactly one date, name and valid exercise targets');
      const edit=parsed.data[0];if(edit.date!==state.request.dates[0]) return invalid('Save must match the requested date');
      if(new Set(edit.exercises.map(item=>item.order)).size!==edit.exercises.length) return invalid('Duplicate exercise order');
      for(const item of edit.exercises){const catalog=exercises.find(entry=>entry.id===item.exerciseId);if(!catalog||item.targetSets.length>100||item.targetSets.some(target=>target.metricType!==catalog.metricType)) return invalid('Targets must match exercise metrics');}
      const result=await repo.write(async()=>{
        if(state.used) throw new DomainError('CONFLICT','Candidate already saved');
        const metadata=await repo.readMetadata();if((metadata.restoreGeneration??0)!==state.request.restoreGeneration) throw new DomainError('CONFLICT','Library restored; generate a new candidate');
        const profile=await db.profiles.get(metadata.localProfileId);
        if(!profile||profile.timeZone!==state.request.timeZone||profileConditions(profile)!==profileConditions(state.profile)) throw new DomainError('CONFLICT','Profile conditions changed; generate a new candidate');
        await checkHistory(state);
        if(evaluateSlot(await slotTasks(repo,state.request.timeZone,[edit.date]),edit.date).occupants.length) throw new DomainError('CONFLICT','This date already has an occupying plan');
        const now=new Date().toISOString(),planId=crypto.randomUUID();
        const version=datePlanVersionSchema.parse({id:crypto.randomUUID(),planId,createdAt:now,updatedAt:now,revision:0,model:'date-day',versionNumber:1,startDate:edit.date,scheduleTimeZone:state.request.timeZone,
          goalSnapshot:{goal:state.request.confirmedGoal,trainingPreferences:{...state.request.conditions,updatedAt:state.generatedAt}},generationMetadata:{requestId:state.request.requestId,promptVersion:'fitness-ai-contract-v1',generatedAt:state.generatedAt},days:[{dayId:crypto.randomUUID(),date:edit.date,exercises:edit.exercises}]});
        const plan=planSchema.parse({id:planId,createdAt:now,updatedAt:now,revision:0,model:'date-day',name:edit.name,source:'ai',status:'active',currentVersionId:version.id,startDate:edit.date,scheduleTimeZone:state.request.timeZone});
        const task=scheduledWorkoutSchema.parse({id:crypto.randomUUID(),createdAt:now,updatedAt:now,revision:0,planVersionId:version.id,plannedDayId:version.days[0].dayId,originalDate:edit.date,scheduledDate:edit.date,status:'pending'});
        // Replay protection is persistent as well as token-local; successful requests cannot be prepared twice to bypass it.
        if(await db.planVersions.filter(row=>row.generationMetadata?.requestId===state.request.requestId).count()) throw new DomainError('CONFLICT','This generation request was already saved');
        await db.planVersions.add(version);await db.plans.add(plan);await db.scheduledWorkouts.add(task);return {plan,version,task};
      });
      state.used=true;return result;
    },
  };
}
