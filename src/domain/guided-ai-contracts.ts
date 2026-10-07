import { z } from 'zod';
import { localeSchema, localDateSchema, timeZoneSchema, uuidSchema } from './schemas';
import { programCandidateSchema } from './guided-contracts';

/** Guided payload carried by the versioned /api/v1 understanding and generation endpoints. */
export const GUIDED_DIALOGUE_VERSION = 'guided-dialogue-v1' as const;
const identity = {
  version: z.literal(GUIDED_DIALOGUE_VERSION), requestId: uuidSchema,
  conversationId: uuidSchema, restoreGeneration: z.number().int().nonnegative(),
  inputSnapshot: z.string().min(1),
};
export const guidedSendingScopeSchema = z.strictObject({
  goal: z.string().min(1), conditions: z.record(z.string(), z.json()),
  body: z.record(z.string(), z.json()).optional(),
  history: z.string().optional(),
});
export const guidedDialogueRequestSchema = z.strictObject({
  ...identity, purpose: z.enum(['understand', 'clarify', 'program', 'refine']),
  locale: localeSchema, scope: guidedSendingScopeSchema,
  startDate: localDateSchema.optional(), endDate: localDateSchema.optional(), timeZone: timeZoneSchema,
  dates: z.array(localDateSchema).min(1).optional(), confirmedSummary: z.string().min(1),
  dateSelection: z.literal('ai').optional(),
  refinement: z.string().min(1).optional(), candidateId: uuidSchema.optional(),
}).superRefine((request, context) => {
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
  z.strictObject({ ...identity, purpose: z.literal('understand'), summary: z.string().min(1), uncertainties: z.array(z.string().min(1)) }),
  z.strictObject({ ...identity, purpose: z.literal('clarify'), question: z.string().min(1), field: z.enum(['goal', 'conditions', 'dates']) }),
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
