import { z } from 'zod';
import { coachRequestSchema, coachResponseSchema } from '../coach/contracts';
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
export type AssistantCall = AssistantUsage & { stage: 'text' | 'attachment'; result: 'success' | 'failed' };
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

/** Strip optional sensitive context even when a client accidentally includes it. */
export function sanitizeAssistantRequest(input: unknown): AssistantRequest {
  const request = assistantRequestSchema.parse(input);
  request.locale = inferAssistantLocale(request.messages.at(-1)!.content, request.locale);
  if (request.context) {
    if (!request.consent?.body) delete request.context.body;
    if (!request.consent?.history) { delete request.context.history; delete request.context.nutrition; }
    request.context.messages = [];
    request.context.locale = request.locale;
  }
  return request;
}
