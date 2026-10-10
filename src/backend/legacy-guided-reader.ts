/** Read-only compatibility for already-created legacy candidates; no generation or transport. */
import { z } from 'zod';
import { guidedAiExercises } from '../catalog/ai-catalog';
import { plannedExerciseSchema, localDateSchema } from '../domain/schemas';
import { coachTargetPlanSchema, type GuidedDialogueRequest } from '../domain/guided-ai-contracts';
import { confirmGuidedSending, validateGuidedResponse } from '../ai/guided-dialogue';
import { ControlError } from './store';

import { guidedServiceLimits } from '../domain/guided-limits';
export { guidedServiceLimits } from '../domain/guided-limits';
const text = z.string().trim().min(1).max(8000);
const refusal = z.strictObject({ kind: z.literal('refused'), reason: z.enum(['unrelated', 'clarification_needed', 'safety_limit']), message: text });
const understanding = z.strictObject({ kind: z.literal('understand'), summary: text, uncertainties: z.array(text).max(8), draft: z.string().max(8000).optional() });
const clarification = z.strictObject({ kind: z.literal('clarify'), question: text, field: z.enum(['goal', 'conditions', 'dates']) });
const proposal = z.strictObject({ kind: z.literal('proposal'), summary: text,
  sessions: z.array(z.strictObject({ name: z.string().min(1).max(200), focus: z.string().min(1).max(1000),
    durationMinutes: z.number().int().min(1).max(240), })).min(1).max(14), needsExactDates: z.literal(true) });
const program = z.strictObject({ kind: z.literal('program'), name: text, explanation: text,
  days: z.array(z.strictObject({ date: localDateSchema, exercises: z.array(plannedExerciseSchema).min(1).max(8) })).min(1).max(14) });
const changeProposal = program.extend({kind: z.literal('change_proposal'), targetPlanRef: coachTargetPlanSchema});
export const coachProviderResponseSchema = z.discriminatedUnion('kind', [refusal, understanding, clarification, proposal, program, changeProposal]);

export function validateGuidedProviderInput(request: GuidedDialogueRequest, k: number) {
  const age = request.scope.body?.age;
  const explicitAge = typeof age === 'number' ? age : age && typeof age === 'object' && !Array.isArray(age) ? age.value : undefined;
  if (request.onboardingVersion === 4 && request.adultConfirmed !== true || request.adultConfirmed === false || typeof explicitAge === 'number' && explicitAge < 18) throw new ControlError('ADULT_ONLY', 403);
  try { confirmGuidedSending(request); } catch { throw new ControlError('CONFIRMATION_REQUIRED', 400); }
  if ((request.dates?.length ?? 0) > Math.min(k, guidedServiceLimits.maxDays)) throw new ControlError('DATE_BOUND_EXCEEDED', 400);
  if (request.startDate && request.endDate && (Date.parse(request.endDate) - Date.parse(request.startDate)) / 86400000 + 1 > guidedServiceLimits.maxRangeDays)
    throw new ControlError('RANGE_TOO_LARGE', 413);
}

export function validateGuidedProviderOutput(request: GuidedDialogueRequest, raw: unknown) {
  const parsed = coachProviderResponseSchema.safeParse(raw);
  if (!parsed.success) throw new ControlError('INVALID_CANDIDATE', 502);
  const original = parsed.data;
  if (original.kind === 'change_proposal' && (!request.targetPlanRef || Object.entries(original.targetPlanRef).some(([key, value]) => request.targetPlanRef![key as keyof typeof request.targetPlanRef] !== value))) throw new ControlError('INVALID_CANDIDATE', 502);
  const result = original.kind === 'change_proposal' ? {...original, kind: 'program' as const} : original;
  if (result.kind === 'program' && request.schedule) for (const day of result.days) {
    const slot = request.schedule.find(item => item.date === day.date);
    const seconds = day.exercises.reduce((sum, exercise) => sum + (exercise.setTimings ?? []).reduce((total, set) => total + set.durationSeconds + set.restSeconds, 0), 0);
    if (!slot || day.exercises.some(exercise => !exercise.setTimings) || seconds > slot.durationMinutes * 60) throw new ControlError('INVALID_CANDIDATE', 502);
  }
  const identity = { version: request.version, requestId: request.requestId, conversationId: request.conversationId,
    inputSnapshot: request.inputSnapshot, restoreGeneration: request.restoreGeneration };
  let response: unknown;
  if (result.kind === 'refused') response = { ...identity, purpose: 'refused', requestedPurpose: request.purpose, reason: result.reason, message: result.message };
  else if (result.kind === 'proposal' && request.purpose === 'understand') response = {
    ...identity, purpose: 'understand', summary: result.summary, uncertainties: [],
    draft: result.sessions.map(session => session.name + ' · ' + session.durationMinutes + (request.locale === 'zh' ? ' 分钟：' : ' minutes: ') + session.focus).join('\n'),
  };
  else if (result.kind === 'program' && ['program', 'refine'].includes(request.purpose)) response = { ...identity, purpose: request.purpose, candidate: {
    id: crypto.randomUUID(), name: result.name, explanation: result.explanation, goal: request.scope.goal,
    startDate: request.startDate, endDate: request.endDate, timeZone: request.timeZone, days: result.days.map(day => ({ ...day, ...(request.schedule?.find(slot => slot.date === day.date) ?? {}) })),
    restoreGeneration: request.restoreGeneration, inputSnapshot: request.inputSnapshot, createdAt: new Date().toISOString(),
  } };
  else { const { kind, ...rest } = result; response = { ...identity, purpose: kind, ...rest }; }
  try { return validateGuidedResponse(response, request, { expectedDates: request.dates ?? [], exerciseCatalog: guidedAiExercises(request),
    restoreGeneration: request.restoreGeneration, limits: guidedServiceLimits }); }
  catch { throw new ControlError('INVALID_CANDIDATE', 502); }
}
