import { z } from 'zod';
import { trainingSlotSchema } from './training-time';
import { localeSchema, localDateSchema, timeZoneSchema, uuidSchema } from './schemas';
import { programCandidateSchema } from './guided-contracts';

/** Guided payload carried by the versioned /api/v1 understanding and generation endpoints. */
export const GUIDED_DIALOGUE_VERSION = 'guided-dialogue-v1' as const;
const identity = {
  version: z.literal(GUIDED_DIALOGUE_VERSION), requestId: uuidSchema,
  conversationId: uuidSchema, restoreGeneration: z.number().int().nonnegative(),
  inputSnapshot: z.string().min(1).max(65536),
};
export const guidedSendingScopeSchema = z.strictObject({
  goal: z.string().min(1).max(8000), conditions: z.record(z.string(), z.json()),
  body: z.record(z.string(), z.json()).optional(),
  history: z.string().max(32000).optional(),
});
export const coachTargetPlanSchema = z.strictObject({
  planId: uuidSchema, versionId: uuidSchema, taskId: uuidSchema,
  revision: z.number().int().nonnegative(),
});
export const guidedDialogueRequestSchema = z.strictObject({
  ...identity, purpose: z.enum(['understand', 'clarify', 'program', 'refine']),
  locale: localeSchema, scope: guidedSendingScopeSchema,
  startDate: localDateSchema.optional(), endDate: localDateSchema.optional(), timeZone: timeZoneSchema,
  dates: z.array(localDateSchema).min(1).max(14).optional(), confirmedSummary: z.string().min(1).max(8000),
  dateSelection: z.literal('ai').optional(),
  schedule: z.array(trainingSlotSchema).min(1).max(14).optional(),
  refinement: z.string().min(1).max(8000).optional(), candidateId: uuidSchema.optional(),
  targetPlanRef: coachTargetPlanSchema.optional(),
  coachTask: z.literal('manage').optional(),
  onboardingVersion: z.literal(4).optional(), adultConfirmed: z.boolean().optional(),
}).superRefine((request, context) => {
  if (request.coachTask && request.purpose !== 'understand') context.addIssue({ code: 'custom', message: 'MANAGEMENT_REQUIRES_UNDERSTAND' });
  if (request.targetPlanRef && request.purpose !== 'refine' && request.coachTask !== 'manage') context.addIssue({ code: 'custom', message: 'TARGET_REQUIRES_MODIFICATION' });
  if (new TextEncoder().encode(JSON.stringify(request.scope)).length > 49152) context.addIssue({ code: 'custom', message: 'CONTEXT_TOO_LARGE' });
  if (request.schedule && (!['program', 'refine'].includes(request.purpose) || request.dateSelection || !request.dates || new Set(request.schedule.map(slot => slot.date)).size !== request.schedule.length || request.schedule.length !== request.dates.length || request.schedule.some(slot => !request.dates!.includes(slot.date)) || !request.startDate || !request.endDate || (Date.parse(request.endDate) - Date.parse(request.startDate)) / 86400000 + 1 > 31)) context.addIssue({ code: 'custom', message: 'INVALID_CONFIRMED_SCHEDULE' });
  if (request.dateSelection && request.purpose !== 'program') {
    context.addIssue({ code: 'custom', message: 'AI_DATE_SELECTION_REQUIRES_PROGRAM' });
  }
  if ((request.purpose === 'understand' || request.purpose === 'clarify') && (request.scope.body !== undefined || request.scope.history !== undefined)) {
    context.addIssue({ code: 'custom', message: 'GOAL_DIALOGUE_EXCLUDES_BODY_AND_HISTORY' });
  }
  if ((request.purpose === 'program' || request.purpose === 'refine') && (!request.startDate || !request.endDate || !request.dates)) {
    context.addIssue({ code: 'custom', message: 'PROGRAM_REQUIRES_EXACT_DATES' });
  }
  if ((request.startDate && request.endDate && request.startDate > request.endDate) || request.dates?.some(date => (request.startDate && date < request.startDate) || (request.endDate && date > request.endDate))
      || (request.dates && new Set(request.dates).size !== request.dates.length)) {
    context.addIssue({ code: 'custom', message: 'INVALID_DATE_SET' });
  }
  if (request.purpose === 'refine' && (!request.refinement || !request.candidateId)) {
    context.addIssue({ code: 'custom', message: 'REFINEMENT_REQUIRES_CANDIDATE' });
  }
  if (request.purpose !== 'refine' && (request.refinement || request.candidateId)) {
    context.addIssue({ code: 'custom', message: 'UNEXPECTED_REFINEMENT' });
  }
});
export const guidedDialogueResponseSchema = z.discriminatedUnion('purpose', [
  z.strictObject({ ...identity, purpose: z.literal('understand'), summary: z.string().min(1).max(8000), uncertainties: z.array(z.string().min(1).max(8000)).max(8), draft: z.string().max(8000).optional() }),
  z.strictObject({ ...identity, purpose: z.literal('clarify'), question: z.string().min(1).max(8000), field: z.enum(['goal', 'conditions', 'dates']) }),
  z.strictObject({ ...identity, purpose: z.literal('program'), candidate: programCandidateSchema }),
  z.strictObject({ ...identity, purpose: z.literal('refine'), candidate: programCandidateSchema }),
  z.strictObject({ ...identity, purpose: z.literal('refused'), requestedPurpose: z.enum(['understand', 'clarify', 'program', 'refine']), reason: z.enum(['unrelated', 'clarification_needed', 'safety_limit']), message: z.string().trim().min(1) }),
]);
export type GuidedDialogueRequest = z.infer<typeof guidedDialogueRequestSchema>;
export type GuidedDialogueResponse = z.infer<typeof guidedDialogueResponseSchema>;
export type GuidedSendingScope = z.infer<typeof guidedSendingScopeSchema>;
/** All values supplied by the caller; none are production capacity promises. */
export interface GuidedDialogueLimits {
  maxDays: number; maxRangeDays: number; maxExercisesPerDay: number;
  maxSetsPerExercise: number; maxInputBytes: number; maxOutputBytes: number;
}
