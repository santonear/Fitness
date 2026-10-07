import { z } from 'zod';
import { schedulingFields, validateScheduling } from './training-time';
import { plannedExerciseSchema } from './schemas';

const id = z.uuid();
const timestamp = z.iso.datetime();
const date = z.iso.date();
const revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const zone = z.string().refine(value => { try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; } });
export const guidedAnswerSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('answered'), value: z.union([z.string(), z.number().finite(), z.array(z.string())]) }),
  z.strictObject({ status: z.literal('skipped') }),
]);
export const biologicalSexAnswerSchema = z.strictObject({ status: z.literal('answered'), value: z.enum(['女性', '男性', '其他或不确定', '不愿透露']) });
export const onboardingSchema = z.strictObject({ id, step: revision, answers: z.record(z.string(), guidedAnswerSchema), updatedAt: timestamp, completed: z.boolean() }).superRefine((value, context) => {
  // Missing in older backups is unknown; only new explicit answers are validated.
  if (value.answers.biologicalSex !== undefined && !biologicalSexAnswerSchema.safeParse(value.answers.biologicalSex).success) context.addIssue({ code: 'custom', path: ['answers', 'biologicalSex'], message: 'INVALID_BIOLOGICAL_SEX_ANSWER' });
});
export const programCandidateSchema = z.strictObject({
  id, name: z.string().trim().min(1), goal: z.string().trim().min(1), startDate: date, endDate: date, timeZone: zone,
  days: z.array(z.strictObject({ date, ...schedulingFields, exercises: z.array(z.lazy(() => plannedExerciseSchema)).min(1) }).superRefine(validateScheduling)).min(1),
  explanation: z.string(), createdAt: timestamp, restoreGeneration: revision, inputSnapshot: z.string().optional(),
  onboardingSnapshot: z.string().optional(), profileSnapshot: z.string().optional(),
}).superRefine((value, context) => {
  if (value.endDate < value.startDate) context.addIssue({ code: 'custom', message: 'End precedes start' });
  if (new Set(value.days.map(day => day.date)).size !== value.days.length) context.addIssue({ code: 'custom', message: 'Duplicate training dates' });
  if (value.days.some(day => day.date < value.startDate || day.date > value.endDate)) context.addIssue({ code: 'custom', message: 'Training date outside phase' });
});
export const guidedProgramSchema = z.strictObject({
  id, name: z.string().min(1), goal: z.string(), startDate: date, endDate: date, timeZone: zone,
  status: z.enum(['active', 'paused', 'terminated']), revision, planIds: z.array(id), taskIds: z.array(id),
  candidateId: id.optional(), explanation: z.string(), createdAt: timestamp, updatedAt: timestamp,
});
export const guidedMessageSchema = z.strictObject({
  id, conversationId: id, role: z.enum(['user', 'assistant']), content: z.string(), createdAt: timestamp,
  candidateId: id.optional(), programId: id.optional(), requestId: id.optional(),
});
export const guidedEventSchema = z.strictObject({
  id, createdAt: timestamp, programId: id.optional(), sessionId: id.optional(),
  action: z.enum(['created', 'paused', 'resumed', 'terminated', 'replaced', 'workout_paused', 'workout_resumed', 'workout_ended', 'rescheduled']),
  before: z.string().optional(), after: z.string(), reason: z.string().optional(),
  timerIds: z.array(id).optional(),
});
export const guidedObservationSchema = z.strictObject({
  id, kind: z.enum(['waist', 'bodyFat']), value: z.number().positive().finite(), unit: z.enum(['cm', '%']),
  localDate: date, timeZone: zone, method: z.string().min(1), createdAt: timestamp,
}).superRefine((value, context) => {
  if ((value.kind === 'waist') !== (value.unit === 'cm') || (value.kind === 'bodyFat' && value.value > 100)) context.addIssue({ code: 'custom', message: 'Invalid measurement unit or value' });
});
export const guidedInvitationSchema = z.strictObject({ id, eventId: id, decision: z.enum(['pending', 'later', 'declined', 'accepted']) });
export const guidedStateSchema = z.strictObject({
  id: z.literal('guided'), revision, onboarding: onboardingSchema.optional(),
  programs: z.array(guidedProgramSchema), candidates: z.array(programCandidateSchema), messages: z.array(guidedMessageSchema),
  events: z.array(guidedEventSchema), observations: z.array(guidedObservationSchema), invitations: z.array(guidedInvitationSchema),
});
export type GuidedState = z.infer<typeof guidedStateSchema>;
export type ProgramCandidate = z.infer<typeof programCandidateSchema>;
export type GuidedProgram = z.infer<typeof guidedProgramSchema>;
export type GuidedAnswer = z.infer<typeof guidedAnswerSchema>;
export const emptyGuidedState = (): GuidedState => ({ id: 'guided', revision: 0, programs: [], candidates: [], messages: [], events: [], observations: [], invitations: [] });
