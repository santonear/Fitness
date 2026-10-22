import { z } from 'zod';
import { engineHealthScope } from '../coach/engine-health';
import { coachRequestSchema, coachResponseSchema, type CoachRequest } from '../coach/contracts';
import { exerciseIdSchema, timeZoneSchema } from '../domain/schemas';
import { EQUIPMENT, equipmentLabel } from '../catalog/taxonomy';
import { preferredTrainingDays } from '../application/rules/local-profile';
import { sessionDuration } from '../application/rules/session-duration';

export const ASSISTANT_VERSION = 'fitness-assistant-v2' as const;
export const assistantRequestSchema = z
  .strictObject({
    version: z.literal(ASSISTANT_VERSION),
    requestId: z.uuid(),
    conversationId: z.uuid(),
    locale: z.enum(['zh', 'en']),
    timeZone: timeZoneSchema,
    adultConfirmed: z.boolean(),
    messages: z
      .array(z.strictObject({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(4000) }))
      .min(1)
      .max(20),
    context: coachRequestSchema.optional(),
    /** 营养建议: a diet/intake/nutrition conversation. It carries no training context or records; see src/nutrition/module-boundary.ts. */
    topic: z.literal('nutrition').optional(),
    engineCandidateIds: z.array(exerciseIdSchema).max(60).optional(),
    preferences: z
      .array(
        z.strictObject({
          kind: z.enum(['dislike_exercise', 'cannot_do', 'caution_area', 'preferred_days', 'equipment']),
          value: z.union([z.string().max(200), z.array(z.string().max(80)).max(7)]),
        }),
      )
      .max(30)
      .optional(),
    consent: z
      .strictObject({
        body: z.boolean(),
        history: z.boolean(),
        health: z.boolean().optional(),
        nutrition: z.boolean().optional(),
      })
      .optional(),
    currentWorkout: z
      .strictObject({
        completedSets: z
          .array(
            z.strictObject({
              itemIndex: z.number().int().min(0).max(999),
              setIndex: z.number().int().min(0).max(999),
              exerciseId: exerciseIdSchema,
              reps: z.number().int().positive().max(10000).optional(),
              loadGrams: z.number().int().nonnegative().max(1000000).optional(),
              durationSeconds: z.number().int().positive().max(86400).optional(),
              distanceMeters: z.number().int().nonnegative().max(1000000).optional(),
            }),
          )
          .max(500),
        remainingSets: z.number().int().nonnegative().max(1000),
      })
      .optional(),
  })
  .refine(value => value.messages.at(-1)?.role === 'user', 'Latest message must be from user')
  .refine(
    value => value.topic !== 'nutrition' || (!value.context && !value.currentWorkout && !value.engineCandidateIds),
    'A nutrition conversation carries no training context',
  )
  .superRefine((value, ctx) => {
    if (!value.currentWorkout) return;
    if (value.context?.task !== 'ADJUST_TODAY' || !value.context.workoutId) {
      ctx.addIssue({
        code: 'custom',
        path: ['currentWorkout'],
        message: 'Current workout requires matching active adjustment context',
      });
      return;
    }
    const seen = new Set<string>();
    for (const set of value.currentWorkout.completedSets) {
      const item = value.context.template.items[set.itemIndex],
        key = `${set.itemIndex}:${set.setIndex}`;
      if (!item || set.setIndex >= item.sets || seen.has(key))
        ctx.addIssue({
          code: 'custom',
          path: ['currentWorkout', 'completedSets'],
          message: 'Completed sets must match distinct current template sets',
        });
      seen.add(key);
    }
  });
export const assistantAttachmentSchema = z.union([
  coachResponseSchema,
  z.strictObject({
    type: z.literal('exercise_info'),
    exerciseId: exerciseIdSchema,
    summary: z.string().min(1).max(8000),
    mutationAllowed: z.literal(false),
  }),
]);
// Model output describes an intention. Request identity and durable plan fields
// are assembled by the server from its validated context, never echoed by AI.
const optionalNumber = (minimum: number, maximum: number) =>
  z.coerce
    .number()
    .finite()
    .transform(value => Math.max(minimum, Math.min(maximum, Math.round(value))))
    .optional()
    .catch(undefined);
export const assistantPlanParamsSchema = z
  .object({
    daysPerWeek: optionalNumber(1, 7),
    preferredDays: z.array(z.string()).optional().catch(undefined),
    minutesPerSession: optionalNumber(10, 90),
    location: z.enum(['home', 'gym', 'outdoor']).optional().catch(undefined),
    equipment: z.array(z.string()).optional().catch(undefined),
    avoid: z.array(z.string()).optional().catch(undefined),
    cautionAreas: z.array(z.string()).optional().catch(undefined),
    goal: z.enum(['fat_loss', 'strength', 'mobility', 'general']).optional().catch(undefined),
  })
  .passthrough();
const changeSchema = z
  .object({
    session: z.string().optional().catch(undefined),
    op: z.enum(['replace', 'add', 'remove', 'set_volume', 'shorten']),
    from: z.string().optional().catch(undefined),
    to: z.string().optional().catch(undefined),
    sets: optionalNumber(1, 10),
    reps: z.string().optional().catch(undefined),
    seconds: optionalNumber(1, 7200),
    minutes: optionalNumber(10, 90),
  })
  .passthrough();
export const assistantIntentSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }).passthrough(),
  z
    .object({
      kind: z.literal('plan_new'),
      params: assistantPlanParamsSchema.default({}),
      picks: z
        .array(z.object({ slot: z.string(), code: z.string() }).passthrough())
        .optional()
        .catch(undefined),
    })
    .passthrough(),
  z
    .object({
      kind: z.literal('plan_modify'),
      changes: z.array(changeSchema).default([]),
      params: assistantPlanParamsSchema.optional().catch(undefined),
    })
    .passthrough(),
  z
    .object({
      kind: z.literal('today_adjust'),
      minutes: optionalNumber(10, 90),
      changes: z.array(changeSchema).optional().catch(undefined),
      focus: z.enum(['upper', 'lower', 'full', 'core', 'mobility']).optional().catch(undefined),
    })
    .passthrough(),
  z
    .object({
      kind: z.literal('review'),
      highlights: z.array(z.string()).default([]),
      nextFocus: z.string().optional().catch(undefined),
    })
    .passthrough(),
  z
    .object({
      kind: z.literal('clarify'),
      question: z.string(),
      options: z.array(z.string()).optional().catch(undefined),
    })
    .passthrough(),
]);
export type AssistantIntent = z.infer<typeof assistantIntentSchema>;
export type AssistantRequest = z.infer<typeof assistantRequestSchema>;
export type AssistantAttachment = z.infer<typeof assistantAttachmentSchema>;
export type AssistantUsage = { inputTokens: number; outputTokens: number; usageEstimated?: boolean };
export type AssistantCall = Partial<AssistantUsage> & {
  stage: 'text' | 'attachment';
  result: 'success' | 'repaired' | 'failed';
  failureCode?: string;
  failureDetail?: string;
};
export type AssistantEvent =
  | { type: 'engine_intent'; version: 'fitness-engine-intent-v1'; intent: AssistantIntent }
  | { type: 'text_delta'; delta: string }
  | { type: 'attachment_pending' }
  | { type: 'attachment'; attachment: AssistantAttachment }
  | { type: 'attachment_failed'; code: string }
  | { type: 'error'; code: string; resetAt?: string }
  | {
      type: 'done';
      success: boolean;
      usage: AssistantUsage;
      promptVersion: string;
      calls?: AssistantCall[];
      result?: 'success' | 'repaired' | 'fallback' | 'no_change' | 'attachment_failed' | 'failed';
    };
export type AssistantStreamEvent = AssistantEvent;

/** Latest user text determines language; punctuation-only messages retain UI locale. */
export function inferAssistantLocale(text: string, fallback: 'zh' | 'en'): 'zh' | 'en' {
  return /[\u3400-\u9fff]/u.test(text) ? 'zh' : /[a-z]/i.test(text) ? 'en' : fallback;
}

/** V2 updates explicit scheduling preferences; legacy V8 validation remains unchanged. */
export function applyAssistantPreferences(context: CoachRequest, messages: AssistantRequest['messages']): CoachRequest {
  const copy = structuredClone(context);
  if (copy.task !== 'ONBOARD_PLAN') return copy;
  const digits: Record<string, number> = {
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    once: 1,
    twice: 2,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
  };
  // The supplied plan/profile is the baseline. Older chat turns must never
  // become a new request when a fresh conversation only says hello.
  for (const message of messages.slice(-1).filter(m => m.role === 'user')) {
    const content = message.content;
    const positiveMention = (pattern: RegExp) =>
      [...content.matchAll(new RegExp(pattern.source, 'gi'))].some(
        match =>
          !/(?:not|no|without|不是|不在|没有|不用|不要)\s*$/i.test(
            content.slice(Math.max(0, (match.index ?? 0) - 8), match.index),
          ),
      );
    const places = (
      [
        ['home', /在家|家里|居家|\bhome\b/],
        ['gym', /健身房|\bgym\b/],
        ['outdoor', /户外|\boutdoors?\b/],
      ] as const
    )
      .filter(([, pattern]) => positiveMention(pattern))
      .map(([place]) => place);
    if (places.length) {
      const place = places.length > 1 ? 'mixed' : places[0];
      // Availability in a previous location cannot be assumed at the newly named location.
      if (copy.profile.place !== place) copy.profile.equipment = [];
      copy.profile.place = place;
    }
    if (/没有器械|无器械|徒手|\b(?:no|without) equipment\b|\bbodyweight only\b/i.test(content))
      copy.profile.equipment = ['none'];
    else {
      const mentioned = EQUIPMENT.filter(
        key =>
          key !== 'none' &&
          [equipmentLabel(key, 'zh'), equipmentLabel(key, 'en')].some(label =>
            positiveMention(new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))),
          ),
      );
      if (mentioned.length) copy.profile.equipment = [...mentioned];
    }
    const goal = content.match(
      /目标(?:改为|改成|是|为|：|:)\s*([^，。；\n]+)|\b(?:my\s+)?goal\s+(?:is|is now|changed to)\s+([^.;\n]+)/i,
    );
    if (goal) copy.profile.goalText = (goal[1] ?? goal[2]).trim();
    const frequency = content.match(
      /(?:每周|一周)\s*([1-7一二两三四五六七])\s*次|\b(once|twice|one|two|three|four|five|six|seven|[1-7])\s*(?:times?\s*)?(?:a |per |each )?week(?:ly)?\b/i,
    );
    const days = preferredTrainingDays(content) as typeof copy.profile.preferredDays;
    if (days?.length) {
      copy.profile.preferredDays = days;
      copy.profile.weeklyTarget = days.length;
    }
    if (frequency) {
      const raw = (frequency[1] ?? frequency[2]).toLowerCase();
      copy.profile.weeklyTarget = digits[raw] ?? Number(raw);
    }
    const minutes = sessionDuration(content);
    if (minutes !== undefined) copy.profile.sessionMinutes = minutes;
    // A chat instruction is not the user's original onboarding answer.
    // Keep the original words intact; structured fields carry the adjustment.
  }
  return copy;
}

/** Strip optional sensitive context even when a client accidentally includes it. */
export function sanitizeAssistantRequest(input: unknown): AssistantRequest {
  const request = assistantRequestSchema.parse(input);
  request.locale = inferAssistantLocale(request.messages.at(-1)!.content, request.locale);
  if (request.context) {
    request.context = engineHealthScope(
      applyAssistantPreferences(request.context, request.messages),
      request.consent?.health === true,
    );
    if (!request.consent?.body) delete request.context.body;
    if (!request.consent?.history) delete request.context.history;
    if (request.consent?.nutrition === false || (!request.consent?.history && request.consent?.nutrition !== true))
      delete request.context.nutrition;
    request.context.messages = [];
    request.context.locale = request.locale;
  }
  return request;
}
