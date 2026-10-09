import { z } from 'zod';
import { exerciseIdSchema, setMetricsSchema, timeZoneSchema } from '../domain/schemas';

/** Wave 0 wire contract only. No model calls, authorization or writes. */
const text = z.string().min(1).max(8000);
const id = z.uuid();
const count = z.number().int().nonnegative();
const minutes = z.number().int().min(15).max(120);
const target = z.strictObject({ planId: id, versionId: id, revision: count });
const item = z.strictObject({ exerciseId: exerciseIdSchema, equipment: text, sets: z.number().int().min(1), target: setMetricsSchema });
export const sessionTemplateSchema = z.strictObject({ id: text, name: text, estimatedMinutes: minutes, items: z.array(item).min(1) });
export const planProposalSchema = z.strictObject({
  goalText: text, weeklyTarget: z.number().int().min(1).max(7), scheduleOriginalText: z.string().max(8000),
  sessionMinutes: minutes, templates: z.array(sessionTemplateSchema).min(1), reasons: z.tuple([text, text, text]),
});
const profile = z.strictObject({
  goalText: text, weeklyTarget: z.number().int().min(1).max(7), sessionMinutes: minutes,
  scheduleOriginalText: text, place: z.enum(['home', 'gym', 'outdoor', 'mixed']), equipment: z.array(text),
  adultConfirmed: z.literal(true), cautions: z.array(z.enum(['knee', 'back', 'shoulder', 'wrist', 'other'])), cautionNote: text.optional(),
});
const common = {
  version: z.literal('fitness-coach-v8'), requestId: id, conversationId: id, restoreGeneration: count,
  inputSnapshot: z.string().min(1).max(65536), sendConfirmation: z.string().min(1),
  locale: z.enum(['zh', 'en']), timeZone: timeZoneSchema, adultConfirmed: z.literal(true),
  messages: z.array(z.strictObject({ role: z.enum(['user', 'assistant']), content: z.string().max(1600) })).max(8),
  body: z.record(z.string(), z.json()).optional(), history: z.string().max(32000).optional(),
};
const timingCounts = z.strictObject({ partial: count, notStarted: count });
const timeBands = z.strictObject({ morning: timingCounts, daytime: timingCounts, evening: timingCounts });
export const reviewFactsSchema = z.strictObject({
  from: z.iso.date(), to: z.iso.date(), complete: count, partial: count, notStarted: count,
  movementCount: count, missingCount: count, activityMinutes: count, trainingSeconds: count,
  activityCounts: z.record(z.enum(['walk', 'run', 'cycle', 'swim', 'yoga', 'stairs', 'other']), count),
  reasonCounts: z.record(z.enum(['time', 'fatigue', 'discomfort', 'equipment_busy', 'not_today', 'other']), count),
  hasBodyWeight: z.boolean(),
  incompleteTiming: z.strictObject({ weekday: timeBands, weekend: timeBands }),
  improvements: z.array(z.strictObject({ exerciseId: exerciseIdSchema, metric: z.enum(['loadGrams', 'reps', 'durationSeconds']), previous: count, current: count })),
});
export const coachRequestSchema = z.discriminatedUnion('task', [
  z.strictObject({ ...common, task: z.literal('ONBOARD_PLAN'), profile }),
  z.strictObject({ ...common, task: z.literal('ADJUST_TODAY'), target, workoutId: id.optional(), template: sessionTemplateSchema, instruction: text }),
  z.strictObject({ ...common, task: z.literal('MODIFY_PLAN'), target, plan: planProposalSchema, instruction: text }),
  z.strictObject({ ...common, task: z.literal('PERIOD_REVIEW'), target, kind: z.enum(['week', 'month']), facts: reviewFactsSchema }),
]);
const responseIdentity = { requestId: id, restoreGeneration: count, mutationAllowed: z.literal(false) };
export const coachResponseSchema = z.discriminatedUnion('type', [
  z.strictObject({ ...responseIdentity, type: z.literal('plan_proposal'), proposal: planProposalSchema }),
  z.strictObject({ ...responseIdentity, type: z.literal('today_adjustment'), target, workoutId: id.optional(), template: sessionTemplateSchema, summary: text }),
  z.strictObject({ ...responseIdentity, type: z.literal('change_proposal'), target, proposal: planProposalSchema, changes: z.array(text).min(1) }),
  z.strictObject({ ...responseIdentity, type: z.literal('review_summary'), target, opening: text, encouragement: text, gap: text, dataBoundary: z.array(text), suggestion: z.strictObject({ id: text, summary: text, proposal: planProposalSchema }).optional() }),
  z.strictObject({ ...responseIdentity, type: z.literal('clarify'), question: text }),
  z.strictObject({ ...responseIdentity, type: z.literal('refused'), reason: text }),
]);
export type CoachRequest = z.infer<typeof coachRequestSchema>;
export type CoachResponse = z.infer<typeof coachResponseSchema>;
/** D implements normalization plus request/response identity and task matching. */
export type AdaptCoachResponse = (request: CoachRequest, raw: unknown) => CoachResponse;
