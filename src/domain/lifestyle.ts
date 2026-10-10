import { z } from 'zod';
export const nutritionRecordSchema = z.strictObject({
  id: z.uuid(), localDate: z.iso.date(), timeZone: z.string().refine(value => { try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; } }),
  meal: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  portion: z.string().trim().min(1).max(500).optional(), calories: z.number().int().min(0).max(10000).optional(),
  createdAt: z.iso.datetime(),
});
export const activityImportReceiptSchema = z.strictObject({
  id: z.string().regex(/^[a-f0-9]{64}:\d+$/), activityId: z.uuid(), source: z.literal('gpx'), importedAt: z.iso.datetime(),
});
export type NutritionRecord = z.infer<typeof nutritionRecordSchema>;
export type ActivityImportReceipt = z.infer<typeof activityImportReceiptSchema>;
