import { programCandidateSchema, type ProgramCandidate } from '../domain/guided-contracts';
import { guidedDialogueRequestSchema, guidedDialogueResponseSchema,
  type GuidedDialogueRequest, type GuidedDialogueResponse, type GuidedDialogueLimits } from '../domain/guided-ai-contracts';
import type { Exercise } from '../domain/models';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}
export function guidedInputSnapshot(input: Omit<GuidedDialogueRequest, 'inputSnapshot' | 'requestId'>): string {
  return canonical(input);
}
function assertLimits(limits: GuidedDialogueLimits) {
  if (['maxDays', 'maxRangeDays', 'maxExercisesPerDay', 'maxSetsPerExercise', 'maxInputBytes', 'maxOutputBytes'].some(key => {
    const value = limits[key as keyof GuidedDialogueLimits];
    return !Number.isSafeInteger(value) || value <= 0;
  })) throw new Error('INVALID_LIMITS');
}
function assertBytes(value: unknown, max: number) {
  if (new TextEncoder().encode(JSON.stringify(value)).length > max) throw new Error('GUIDED_CAPACITY_EXCEEDED');
}
export interface GuidedSendConsent { requestId: string; inputSnapshot: string; restoreGeneration: number; }
export function confirmGuidedSending(request: GuidedDialogueRequest): GuidedSendConsent {
  const parsed = guidedDialogueRequestSchema.parse(request);
  const { inputSnapshot, requestId, ...input } = parsed;
  if (guidedInputSnapshot(input) !== inputSnapshot) throw new Error('STALE_SENDING_SCOPE');
  return { requestId, inputSnapshot, restoreGeneration: parsed.restoreGeneration };
}
export function assertGuidedConsentCurrent(request: GuidedDialogueRequest, consent: GuidedSendConsent): void {
  const current = confirmGuidedSending(request);
  if (current.requestId !== consent.requestId || current.inputSnapshot !== consent.inputSnapshot
      || current.restoreGeneration !== consent.restoreGeneration) throw new Error('STALE_SENDING_SCOPE');
}
export interface GuidedCandidateContext {
  expectedDates: readonly string[]; exerciseCatalog: readonly Exercise[];
  limits: GuidedDialogueLimits; restoreGeneration: number;
  occupiedDates?: readonly string[];
  allowDateSubset?: boolean;
}
export function guidedCandidateMatchesReview(candidate: ProgramCandidate, review: {
  goal: string; startDate: string; endDate: string; timeZone: string; dates: readonly string[];
}): boolean {
  return review.goal.trim() === candidate.goal && review.startDate === candidate.startDate
    && review.endDate === candidate.endDate && review.timeZone === candidate.timeZone
    && review.dates.length === candidate.days.length
    && [...review.dates].sort().join(',') === candidate.days.map(day => day.date).sort().join(',');
}
export function validateGuidedCandidate(raw: unknown, context: GuidedCandidateContext): ProgramCandidate {
  assertLimits(context.limits);
  const candidate = programCandidateSchema.parse(raw);
  assertBytes(candidate, context.limits.maxOutputBytes);
  if (candidate.restoreGeneration !== context.restoreGeneration) throw new Error('STALE_RESTORE_GENERATION');
  const dates = candidate.days.map(day => day.date);
  if (new Set(context.expectedDates).size !== context.expectedDates.length || new Set(dates).size !== dates.length
      || (!context.allowDateSubset && dates.length !== context.expectedDates.length) || dates.some(date => !context.expectedDates.includes(date))) throw new Error('INVALID_DATE_SET');
  if (candidate.startDate > candidate.endDate || dates.some(date => date < candidate.startDate || date > candidate.endDate)) throw new Error('INVALID_DATE_RANGE');
  const range = (Date.parse(candidate.endDate) - Date.parse(candidate.startDate)) / 86400000 + 1;
  if (dates.length > context.limits.maxDays || range > context.limits.maxRangeDays) throw new Error('GUIDED_CAPACITY_EXCEEDED');
  if (dates.some(date => context.occupiedDates?.includes(date))) throw new Error('DATE_CONFLICT');
  for (const day of candidate.days) {
    if (!day.exercises.length || day.exercises.length > context.limits.maxExercisesPerDay) throw new Error('GUIDED_CAPACITY_EXCEEDED');
    if (new Set(day.exercises.map(exercise => exercise.order)).size !== day.exercises.length) throw new Error('INVALID_EXERCISE_ORDER');
    for (const planned of day.exercises) {
      const exercise = context.exerciseCatalog.find(item => item.id === planned.exerciseId);
      if (!exercise || planned.targetSets.some(set => set.metricType !== exercise.metricType)) throw new Error('INVALID_EXERCISE_METRICS');
      if (planned.targetSets.length > context.limits.maxSetsPerExercise) throw new Error('GUIDED_CAPACITY_EXCEEDED');
    }
  }
  return candidate;
}
export function validateGuidedResponse(raw: unknown, request: GuidedDialogueRequest, context: GuidedCandidateContext): GuidedDialogueResponse {
  const parsedRequest = guidedDialogueRequestSchema.parse(request);
  const response = guidedDialogueResponseSchema.parse(raw);
  assertLimits(context.limits);
  assertBytes(response, context.limits.maxOutputBytes);
  if (parsedRequest.restoreGeneration !== context.restoreGeneration) throw new Error('STALE_RESTORE_GENERATION');
  for (const key of ['version', 'requestId', 'conversationId', 'inputSnapshot', 'restoreGeneration'] as const) {
    if (response[key] !== parsedRequest[key]) throw new Error('GUIDED_RESPONSE_IDENTITY_MISMATCH');
  }
  if ((response.purpose === 'refused' ? response.requestedPurpose : response.purpose) !== parsedRequest.purpose) throw new Error('GUIDED_RESPONSE_IDENTITY_MISMATCH');
  if ('candidate' in response) {
    const candidate = validateGuidedCandidate(response.candidate, { ...context, expectedDates: parsedRequest.dates ?? [], allowDateSubset: parsedRequest.dateSelection === 'ai' });
    if (parsedRequest.schedule && candidate.days.some(day => {
      const slot = parsedRequest.schedule!.find(item => item.date === day.date);
      return !slot || day.startTime !== slot.startTime || day.durationMinutes !== slot.durationMinutes || day.exercises.some(item => !item.setTimings) || day.exercises.reduce((sum, item) => sum + (item.setTimings ?? []).reduce((total, timing) => total + timing.durationSeconds + timing.restSeconds, 0), 0) > slot.durationMinutes * 60;
    })) throw new Error('GUIDED_CANDIDATE_SCHEDULE_MISMATCH');
    if (candidate.startDate !== parsedRequest.startDate || candidate.endDate !== parsedRequest.endDate
        || candidate.timeZone !== parsedRequest.timeZone || candidate.goal !== parsedRequest.scope.goal
        || (candidate.inputSnapshot !== undefined && candidate.inputSnapshot !== parsedRequest.inputSnapshot)) throw new Error('GUIDED_CANDIDATE_SCOPE_MISMATCH');
  }
  return response;
}
/** Synthetic fixtures only. Never contacts a supplier or generates a fallback plan. */
export function createGuidedDialogueMockClient(fixture: (request: GuidedDialogueRequest) => unknown, context: GuidedCandidateContext) {
  return {
    mode: 'mock' as const,
    async send(raw: GuidedDialogueRequest, consent: GuidedSendConsent): Promise<GuidedDialogueResponse> {
      const request = guidedDialogueRequestSchema.parse(raw);
      assertLimits(context.limits);
      assertBytes(request, context.limits.maxInputBytes);
      assertGuidedConsentCurrent(request, consent);
      if (request.restoreGeneration !== context.restoreGeneration) throw new Error('STALE_RESTORE_GENERATION');
      return validateGuidedResponse(fixture(request), request, context);
    },
  };
}
// Transport is implemented; actual availability still requires live qualification and server configuration.
export const guidedProductionTransportAvailable = true;
