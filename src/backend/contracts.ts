import { canonical, confirmationFor, goalConfirmationFor } from '../domain/request-fingerprint';
export { canonical, confirmationFor, goalConfirmationFor } from '../domain/request-fingerprint';
import { selectAiExercises } from '../catalog/ai-catalog';
import { z } from 'zod';
import { exercises, CATALOG_VERSION } from '../catalog/exercises';
import { localeSchema, uuidSchema, localDateSchema, timeZoneSchema, plannedExerciseSchema, trainingPreferencesSchema } from '../domain/schemas';
import { ControlError } from './store';
import { summaryStageSchema, summaryResultSchema, validateSummaryStage } from './summary-contract';
import { guidedDialogueRequestSchema } from '../domain/guided-ai-contracts';
import { validateGuidedProviderInput, validateGuidedProviderOutput } from './guided-provider';
import { coachRequestSchema } from '../coach/contracts';
import { adaptCoachResponse } from '../coach/response-adapter';

export async function digest(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
}
function hex(value: ArrayBuffer) { return Array.from(new Uint8Array(value), byte => byte.toString(16).padStart(2, '0')).join(''); }
const text = z.string().min(1).max(8000);
const base = { contractVersion: z.literal(1), requestId: uuidSchema, goalText: text, locale: localeSchema,
  restoreGeneration: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), sendConfirmation: z.string().length(64) };
const understand = z.strictObject({ ...base, operation: z.literal('understand'), dialogue: guidedDialogueRequestSchema.optional() });
// Self-contained mock HCTX envelope; no DB read or full backup accepted. B integration remains separate.
const history = z.strictObject({ text: z.string().max(32000), range: z.strictObject({ from: localDateSchema, to: localDateSchema }),
  sourceRevision: z.number().int().nonnegative(), restoreGeneration: z.number().int().nonnegative() });
const { updatedAt: _updatedAt, daysPerWeek: _daysPerWeek, trainingWeekdays: _trainingWeekdays, ...conditionFields } = trainingPreferencesSchema.shape;
const generate = z.strictObject({ ...base, operation: z.literal('generate'), confirmedGoal: text, goalConfirmation: z.string().length(64),
  dates: z.array(localDateSchema).min(1), timeZone: timeZoneSchema, catalogVersion: z.literal(CATALOG_VERSION),
  conditions: z.strictObject(conditionFields), history: history.optional(), dialogue: guidedDialogueRequestSchema.optional() });
const { goalText: _summaryGoal, ...summaryBase } = base;
const summary = z.strictObject({ ...summaryBase, operation: z.literal('summary'), stage: summaryStageSchema });
const coachEnvelope = z.strictObject({ ...base, operation: z.enum(['generate','summary']), coach: coachRequestSchema });
export const requestSchema = z.discriminatedUnion('operation', [understand, generate, summary]);
export type CoachEnvelope = z.infer<typeof coachEnvelope>;
export type TransportRequest = AiRequest | CoachEnvelope;
export type AiRequest = z.infer<typeof requestSchema>;
export type StageSummaryRequest = Extract<AiRequest, { operation: 'summary' }>;
export async function validateRequest(value: unknown, k: number, maxBytes: number): Promise<AiRequest> {
  const parsed = requestSchema.safeParse(value);
  if (!parsed.success) throw new ControlError('INVALID_INPUT', 400);
  const request = parsed.data;
  if (new TextEncoder().encode(canonical(request)).byteLength > maxBytes) throw new ControlError('RANGE_TOO_LARGE', 413);
  if (request.sendConfirmation !== await confirmationFor(request)) throw new ControlError('CONFIRMATION_REQUIRED', 400);
  if ('dialogue' in request && request.dialogue) {
    const dialogue = request.dialogue;
    validateGuidedProviderInput(dialogue, k);
    const planning = dialogue.purpose === 'program' || dialogue.purpose === 'refine';
    if (request.requestId !== dialogue.requestId || request.restoreGeneration !== dialogue.restoreGeneration || request.locale !== dialogue.locale || request.goalText !== dialogue.scope.goal ||
      (request.operation === 'generate') !== planning) throw new ControlError('INVALID_INPUT', 400);
    if (request.operation === 'generate' && (canonical(request.dates) !== canonical(dialogue.dates) || request.timeZone !== dialogue.timeZone || request.confirmedGoal !== dialogue.confirmedSummary || Object.keys(request.conditions).length || request.history))
      throw new ControlError('INVALID_INPUT', 400);
  }
  if (request.operation === 'generate') {
    if (request.dates.length > k) throw new ControlError('DATE_BOUND_EXCEEDED', 400);
    if (new Set(request.dates).size !== request.dates.length) throw new ControlError('DUPLICATE_DATE', 400);
    if (request.goalConfirmation !== await goalConfirmationFor(request)) throw new ControlError('GOAL_CONFIRMATION_REQUIRED', 400);
    if (request.history && request.history.restoreGeneration !== request.restoreGeneration) throw new ControlError('STALE_RESTORE_GENERATION', 400);
    if (request.history && request.history.range.from > request.history.range.to) throw new ControlError('INVALID_INPUT', 400);
  }
  if (request.operation === 'summary') validateSummaryStage(request.stage, request.restoreGeneration);
  return request;
}
export async function validateTransportRequest(value: unknown,k:number,maxBytes:number):Promise<TransportRequest>{
 if(!value||typeof value!=='object'||!('coach' in value))return validateRequest(value,k,maxBytes);
 const parsed=coachEnvelope.safeParse(value);if(!parsed.success)throw new ControlError('INVALID_INPUT',400);
 const request=parsed.data,coach=request.coach;
 if(coach.body && typeof coach.body.age==='number' && coach.body.age<18)throw new ControlError('INVALID_INPUT',400);
 if(new TextEncoder().encode(canonical(request)).byteLength>maxBytes)throw new ControlError('RANGE_TOO_LARGE',413);
 if(request.requestId!==coach.requestId||request.restoreGeneration!==coach.restoreGeneration||request.locale!==coach.locale||request.operation!==(coach.task==='PERIOD_REVIEW'?'summary':'generate'))throw new ControlError('INVALID_INPUT',400);
 if(request.sendConfirmation!==await confirmationFor(request)||coach.sendConfirmation!==await confirmationFor(coach))throw new ControlError('CONFIRMATION_REQUIRED',400);
 return request;
}
const understandResult = z.strictObject({ interpretedGoal: text });
const dayResult = z.strictObject({ days: z.array(z.strictObject({ date: localDateSchema, exercises: z.array(plannedExerciseSchema).min(1).max(32) })).min(1) });
/** Supplier schema is a hint; validateCandidate remains the authoritative business check. */
export function candidateJsonSchema(operation: AiRequest['operation']) {
  const { $schema: _schema, ...schema } = z.toJSONSchema(operation === 'understand' ? understandResult : operation === 'summary' ? summaryResultSchema : dayResult);
  return schema;
}
export function validateCandidate(request: TransportRequest, result: unknown) {
  if ('coach' in request) {
    try { return adaptCoachResponse(request.coach,result); } catch { throw new ControlError('INVALID_CANDIDATE',502); }
  }
  if ('dialogue' in request && request.dialogue) return validateGuidedProviderOutput(request.dialogue, result);
  const parsed = (request.operation === 'understand' ? understandResult : request.operation === 'summary' ? summaryResultSchema : dayResult).safeParse(result);
  if (!parsed.success) throw new ControlError('INVALID_CANDIDATE', 502);
  if (request.operation === 'generate') {
    const candidate = dayResult.parse(result);
    const dates = candidate.days.map(day => day.date);
    if (dates.length !== request.dates.length || new Set(dates).size !== dates.length || dates.some(date => !request.dates.includes(date))) throw new ControlError('INVALID_CANDIDATE', 502);
    const allowed = new Set(selectAiExercises(request.confirmedGoal, request.conditions).map(item => item.id));
    for (const day of candidate.days) {
      if (new Set(day.exercises.map(exercise => exercise.order)).size !== day.exercises.length) throw new ControlError('INVALID_CANDIDATE', 502);
      for (const exercise of day.exercises) {
        if (!allowed.has(exercise.exerciseId)) throw new ControlError('INVALID_CANDIDATE', 502);
        const catalog = exercises.find(item => item.id === exercise.exerciseId)!;
        if (exercise.targetSets.length > 100 || exercise.targetSets.some(set => set.metricType !== catalog.metricType)) throw new ControlError('INVALID_CANDIDATE', 502);
      }
    }
  }
  return parsed.data;
}
