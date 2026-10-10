import { z } from 'zod';

// Enumerations deliberately reject URLs, identifiers, stack traces and free text.
export const safeErrorEventSchema = z.strictObject({
  type: z.enum(['network', 'validation', 'storage', 'unexpected']),
  page: z.enum(['onboarding', 'plan', 'training', 'review', 'settings', 'other']),
  version: z.enum(['v8']),
  browser: z.enum(['chromium', 'firefox', 'safari', 'other']),
});
export type SafeErrorEvent = z.infer<typeof safeErrorEventSchema>;
export type AnonymousEvent = 'plan_confirmed' | 'workout_started' | 'workout_completed' | 'review_opened';
const anonymousEventSchema = z.enum(['plan_confirmed', 'workout_started', 'workout_completed', 'review_opened']);

/** No transport or persistent identity. Callers supply separate consent and rollout gates. */
export function monitoringError(raw: unknown, enabled = false): SafeErrorEvent | undefined {
  if (!enabled) return undefined;
  const result = safeErrorEventSchema.safeParse(raw);
  return result.success ? result.data : undefined;
}
export function incrementAnonymousCount(counts: Partial<Record<AnonymousEvent, number>>, raw: unknown,
  optedIn = false, enabled = false): Partial<Record<AnonymousEvent, number>> {
  const event = anonymousEventSchema.safeParse(raw);
  if (!enabled || !optedIn || !event.success) return { ...counts };
  const previous = counts[event.data] ?? 0;
  if (!Number.isSafeInteger(previous) || previous < 0 || previous === Number.MAX_SAFE_INTEGER) return { ...counts };
  return { ...counts, [event.data]: previous + 1 };
}
