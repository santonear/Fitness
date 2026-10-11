import { z } from 'zod';
import type { AdminDatabase, AdminEnvironment } from '../core/contracts';

export interface Statement { bind(...values: unknown[]): Statement; run(): Promise<{ meta: { changes: number } }>; all<T>(): Promise<{ results: T[] }>; first<T>(): Promise<T | null> }
export type QualityDatabase = AdminDatabase;
export interface QualityEnv extends AdminEnvironment { ADMIN_ERROR_COLLECTION_ENABLED?: string; ADMIN_PUSH_ENABLED?: string; VAPID_PRIVATE_JWK?: string; VAPID_PUBLIC_KEY?: string; VAPID_SUBJECT?: string }
export const errorEvent = z.object({
  type: z.enum(['render', 'network', 'storage', 'unexpected', 'provider', 'timeout']),
  route: z.enum(['/', '/today', '/plan', '/workout', '/history', '/review', '/settings', '/admin', 'other']),
  version: z.string().regex(/^(?:[a-f0-9]{7,40}|\d+\.\d+\.\d+(?:-[a-z0-9.]{1,20})?)$/),
  browser: z.enum(['Chrome', 'Safari', 'Firefox', 'Edge', 'Other']),
  os: z.enum(['Windows', 'macOS', 'iOS', 'Android', 'Linux', 'Other']),
  time: z.number().int().nonnegative(),
}).strict();
export const blockCategory = z.enum(['blame', 'body-shaming', 'medical-claim', 'pressure', 'unsafe-advice', 'other']);
export const evaluationReport = z.object({
  id: z.string().uuid(), synthetic: z.literal(true), time: z.number().int().nonnegative(),
  promptVersion: z.string().regex(/^[a-zA-Z0-9._-]{1,64}$/), model: z.string().regex(/^[a-zA-Z0-9._:/-]{1,80}$/),
  scenarios: z.array(z.object({ scenario: z.enum(['plan', 'adjust', 'modify', 'review', 'safety', 'tone']), passed: z.boolean(), violations: z.number().int().min(0).max(10000) }).strict()).min(1).max(100),
  durationMs: z.number().int().min(0).max(86400000), costMicros: z.number().int().min(0).max(1000000000),
}).strict();
export const categories = ['ledger', 'smoke', 'errors', 'budget80', 'budget100', 'applications', 'test'] as const;
export type Category = typeof categories[number];
export const urgent = new Set<Category>(['ledger', 'smoke', 'budget100']);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const notificationSettings = z.object({
  enabled: z.object({ ledger: z.literal(true), smoke: z.literal(true), errors: z.boolean(), budget80: z.boolean(), budget100: z.literal(true), applications: z.boolean() }).strict(),
  quietStart: time, quietEnd: time,
  timeZone: z.string().max(80).refine(value => { try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; } }),
}).strict();
export type NotificationSettings = z.infer<typeof notificationSettings>;
export const defaultSettings: NotificationSettings = { enabled: { ledger: true, smoke: true, errors: true, budget80: true, budget100: true, applications: true }, quietStart: '22:00', quietEnd: '08:00', timeZone: 'Asia/Shanghai' };
export function notificationAllowed(category: Category, settings: NotificationSettings, now: number): boolean {
  if (urgent.has(category) || category === 'test') return true;
  if (!settings.enabled[category]) return false;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: settings.timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
  const { quietStart: start, quietEnd: end } = settings;
  return !(start < end ? parts >= start && parts < end : start > end && (parts >= start || parts < end));
}
export function isSpike(current: number, previousSevenDays: number[]): boolean { return current >= 10 && current > previousSevenDays.reduce((a, b) => a + b, 0) / 7 * 3; }
