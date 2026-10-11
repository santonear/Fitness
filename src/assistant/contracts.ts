import { z } from 'zod';
import { coachRequestSchema, coachResponseSchema, type CoachRequest } from '../coach/contracts';
import { exerciseIdSchema, timeZoneSchema } from '../domain/schemas';

export const ASSISTANT_VERSION = 'fitness-assistant-v2' as const;
export const assistantRequestSchema = z.strictObject({
  version: z.literal(ASSISTANT_VERSION), requestId: z.uuid(), conversationId: z.uuid(),
  locale: z.enum(['zh', 'en']), timeZone: timeZoneSchema, adultConfirmed: z.boolean(),
  messages: z.array(z.strictObject({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(4000) })).min(1).max(20),
  context: coachRequestSchema.optional(),
  consent: z.strictObject({ body: z.boolean(), history: z.boolean() }).optional(),
}).refine(value => value.messages.at(-1)?.role === 'user', 'Latest message must be from user');
export const assistantAttachmentSchema = z.union([coachResponseSchema, z.strictObject({
  type: z.literal('exercise_info'), exerciseId: exerciseIdSchema, summary: z.string().min(1).max(8000), mutationAllowed: z.literal(false),
})]);
export type AssistantRequest = z.infer<typeof assistantRequestSchema>;
export type AssistantAttachment = z.infer<typeof assistantAttachmentSchema>;
export type AssistantUsage = { inputTokens: number; outputTokens: number };
export type AssistantCall = Partial<AssistantUsage> & { stage: 'text' | 'attachment'; result: 'success' | 'failed' };
export type AssistantEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'attachment_pending' }
  | { type: 'attachment'; attachment: AssistantAttachment }
  | { type: 'attachment_failed'; code: string }
  | { type: 'error'; code: string; resetAt?: string }
  | { type: 'done'; success: boolean; usage: AssistantUsage; promptVersion: string; calls?: AssistantCall[]; result?: 'success' | 'repaired' | 'attachment_failed' | 'failed' };
export type AssistantStreamEvent = AssistantEvent;

/** Latest user text determines language; punctuation-only messages retain UI locale. */
export function inferAssistantLocale(text: string, fallback: 'zh' | 'en'): 'zh' | 'en' {
  return /[\u3400-\u9fff]/u.test(text) ? 'zh' : /[a-z]/i.test(text) ? 'en' : fallback;
}

/** V2 updates explicit scheduling preferences; legacy V8 validation remains unchanged. */
export function applyAssistantPreferences(context: CoachRequest, messages: AssistantRequest['messages']): CoachRequest {
  const copy = structuredClone(context);
  if (copy.task !== 'ONBOARD_PLAN') return copy;
  const digits: Record<string, number> = { '一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,once:1,twice:2,one:1,two:2,three:3,four:4,five:5,six:6,seven:7 };
  for (const message of messages.filter(m => m.role === 'user')) {
    const content = message.content;
    const goal = content.match(/目标(?:改为|改成|是|为|：|:)\s*([^，。；\n]+)|\b(?:my\s+)?goal\s+(?:is|is now|changed to)\s+([^.;\n]+)/i);
    if (goal) copy.profile.goalText = (goal[1] ?? goal[2]).trim();
    const frequency = content.match(/(?:每周|一周)\s*([1-7一二两三四五六七])\s*次|\b(once|twice|one|two|three|four|five|six|seven|[1-7])\s*(?:times?\s*)?(?:a |per |each )?week\b/i);
    let updated = false;
    if (frequency) {
      const raw = (frequency[1] ?? frequency[2]).toLowerCase();
      copy.profile.weeklyTarget = digits[raw] ?? Number(raw); updated = true;
    }
    for (const match of content.matchAll(/\b(\d{1,3})\s*(?:分钟|minutes?|mins?)\b|(?<zh>\d{1,3})\s*分钟/gi)) {
      const prefix = content.slice(Math.max(0, (match.index ?? 0) - 12), match.index);
      if (/(?:not|不是|不要|别|非)[^,，。;；]*$/i.test(prefix)) continue;
      const minutes = Number(match[1] ?? match.groups?.zh);
      if (minutes >= 15 && minutes <= 120) { copy.profile.sessionMinutes = minutes; updated = true; }
    }
    if (updated) copy.profile.scheduleOriginalText = content;
  }
  return copy;
}

/** Strip optional sensitive context even when a client accidentally includes it. */
export function sanitizeAssistantRequest(input: unknown): AssistantRequest {
  const request = assistantRequestSchema.parse(input);
  request.locale = inferAssistantLocale(request.messages.at(-1)!.content, request.locale);
  if (request.context) {
    request.context = applyAssistantPreferences(request.context, request.messages);
    if (!request.consent?.body) delete request.context.body;
    if (!request.consent?.history) { delete request.context.history; delete request.context.nutrition; }
    request.context.messages = [];
    request.context.locale = request.locale;
  }
  return request;
}
