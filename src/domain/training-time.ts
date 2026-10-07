import { z } from 'zod';

export const startTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const durationMinutesSchema = z.number().int().min(1).max(1440);
export const setTimingSchema = z.strictObject({ durationSeconds: z.number().int().min(1).max(86400), restSeconds: z.number().int().min(0).max(86400) });
export const schedulingFields = { startTime: startTimeSchema.optional(), durationMinutes: durationMinutesSchema.optional() };
export function timeMinutes(time: string): number { const [hour, minute] = startTimeSchema.parse(time).split(':').map(Number); return hour * 60 + minute; }
export function clockTime(minutes: number): string { return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`; }
export function validateScheduling(value: { startTime?: string; durationMinutes?: number }, context: z.RefinementCtx) {
  if ((value.startTime === undefined) !== (value.durationMinutes === undefined)) context.addIssue({ code: 'custom', message: 'Start time and duration must be provided together' });
  if (value.startTime && startTimeSchema.safeParse(value.startTime).success && value.durationMinutes !== undefined && timeMinutes(value.startTime) + value.durationMinutes > 1440) context.addIssue({ code: 'custom', message: 'Training must end within the selected day' });
}
export const trainingSlotSchema = z.strictObject({ date: z.iso.date(), startTime: startTimeSchema, durationMinutes: durationMinutesSchema }).superRefine(validateScheduling);
