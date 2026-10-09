import { selectAiExercises } from '../catalog/ai-catalog';
import { z } from 'zod';
import { exercises, CATALOG_VERSION } from '../catalog/exercises';
import { localeSchema, uuidSchema, localDateSchema, timeZoneSchema, plannedExerciseSchema, trainingPreferencesSchema } from '../domain/schemas';
import { ControlError } from './store';
import { summaryStageSchema, summaryResultSchema, validateSummaryStage } from './summary-contract';
import { guidedDialogueRequestSchema } from '../domain/guided-ai-contracts';
import { validateGuidedProviderInput, validateGuidedProviderOutput } from './guided-provider';

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}
export async function digest(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
}
function hex(value: ArrayBuffer) { return Array.from(new Uint8Array(value), byte => byte.toString(16).padStart(2, '0')).join(''); }
function confirmedPayload(value: unknown) {
  const entries = Object.entries(value as Record<string, unknown>).filter(([key]) => !['requestId', 'sendConfirmation', 'goalConfirmation'].includes(key));
  return Object.fromEntries(entries);
}
/** Public content fingerprint, binds confirmation to actual fields; it is not an identity credential. */
export async function confirmationFor(value: unknown) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(confirmedPayload(value)))));
}
export async function goalConfirmationFor(value: { goalText: string; confirmedGoal: string }) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical({ goalText: value.goalText, confirmedGoal: value.confirmedGoal }))));
}
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
export const requestSchema = z.discriminatedUnion('operation', [understand, generate, summary]);
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
const understandResult = z.strictObject({ interpretedGoal: text });
const dayResult = z.strictObject({ days: z.array(z.strictObject({ date: localDateSchema, exercises: z.array(plannedExerciseSchema).min(1).max(32) })).min(1) });
/** Supplier schema is a hint; validateCandidate remains the authoritative business check. */
export function candidateJsonSchema(operation: AiRequest['operation']) {
  const { $schema: _schema, ...schema } = z.toJSONSchema(operation === 'understand' ? understandResult : operation === 'summary' ? summaryResultSchema : dayResult);
  return schema;
}
export function validateCandidate(request: AiRequest, result: unknown) {
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
