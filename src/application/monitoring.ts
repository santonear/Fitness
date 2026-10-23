import { z } from 'zod';
import { addDays, daysBetween } from '../domain/local-date';

// Enumerations deliberately reject URLs, identifiers, stack traces and free text.
export const safeErrorEventSchema = z.strictObject({
  type: z.enum(['network', 'validation', 'storage', 'unexpected']),
  page: z.enum(['onboarding', 'plan', 'training', 'review', 'settings', 'other']),
  version: z.enum(['v8']),
  browser: z.enum(['chromium', 'firefox', 'safari', 'other']),
});
export type SafeErrorEvent = z.infer<typeof safeErrorEventSchema>;
export const anonymousEventSchema = z.enum([
  'plan_confirmed',
  'workout_started',
  'workout_completed',
  'review_opened',
  'retention_start',
  'retention_week1',
  'retention_week4',
]);
export type AnonymousEvent = z.infer<typeof anonymousEventSchema>;
export type RetentionEvent = Extract<AnonymousEvent, `retention_${string}`>;

/**
 * Once-per-device retention milestones, counted from the first plan's local date: started, trained in days 1–7,
 * trained in days 22–28. Only a start within the last 7 days opens a cohort, so devices that predate this or opt in
 * later are not counted; the caller sends each event at most once.
 */
export function retentionDue(
  start: string | undefined,
  trainedDates: readonly string[],
  today: string,
  sent: readonly RetentionEvent[],
): RetentionEvent[] {
  if (!start) return [];
  const opened = sent.includes('retention_start');
  if (!opened && daysBetween(start, today) > 6) return [];
  const trained = (from: number, to: number) =>
    trainedDates.some(day => day >= addDays(start, from) && day <= addDays(start, to) && day <= today);
  const due: RetentionEvent[] = opened ? [] : ['retention_start'];
  if (!sent.includes('retention_week1') && trained(0, 6)) due.push('retention_week1');
  if (!sent.includes('retention_week4') && trained(21, 27)) due.push('retention_week4');
  return due;
}

/** No transport or persistent identity. Callers supply separate consent and rollout gates. */
export function monitoringError(raw: unknown, enabled = false): SafeErrorEvent | undefined {
  if (!enabled) return undefined;
  const result = safeErrorEventSchema.safeParse(raw);
  return result.success ? result.data : undefined;
}
export function incrementAnonymousCount(
  counts: Partial<Record<AnonymousEvent, number>>,
  raw: unknown,
  optedIn = false,
  enabled = false,
): Partial<Record<AnonymousEvent, number>> {
  const event = anonymousEventSchema.safeParse(raw);
  if (!enabled || !optedIn || !event.success) return { ...counts };
  const previous = counts[event.data] ?? 0;
  if (!Number.isSafeInteger(previous) || previous < 0 || previous === Number.MAX_SAFE_INTEGER) return { ...counts };
  return { ...counts, [event.data]: previous + 1 };
}
