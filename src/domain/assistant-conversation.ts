import { z } from 'zod';

export const conversationSchema = z.strictObject({
  id: z.uuid(),
  title: z.string().max(80),
  consent: z
    .strictObject({
      body: z.boolean(),
      history: z.boolean(),
      bodyFields: z.array(z.string().max(80)).max(20).optional(),
    })
    .optional(),
  updatedAt: z.string().datetime(),
  messages: z.array(z.strictObject({ role: z.enum(['user', 'assistant']), content: z.string().max(16000) })),
});
export type AssistantConversation = z.infer<typeof conversationSchema>;
