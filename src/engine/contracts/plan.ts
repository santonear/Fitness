import { z } from 'zod';
import { nonnegative, patternSchema, weekdaySchema } from './profile';
export const bilingualSchema = z.strictObject({
  zh: z.string(),
  en: z.string(),
});
export const ruleTraceSchema = z.strictObject({
  ruleId: z.string(),
  reason: z.string(),
  step: z.string().optional(),
  note: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});
export type RuleTrace = z.infer<typeof ruleTraceSchema>;
export const engineNoticeSchema = z.strictObject({
  code: z.string(),
  ruleId: z.string(),
  copyPath: z.string().optional(),
  severity: z.enum(['info', 'warning', 'stop']),
  message: bilingualSchema,
});
export type EngineNotice = z.infer<typeof engineNoticeSchema>;
export const gateResultSchema = z.strictObject({
  ruleId: z.string(),
  status: z.enum(['pass', 'restricted', 'blocked']),
  reason: z.string(),
  noticeCode: z.string().optional(),
});
export type GateResult = z.infer<typeof gateResultSchema>;
export const prescriptionSchema = z.strictObject({
  trainingStyle: z.literal('hiit').optional(),
  targetRpe: z
    .tuple([z.number().min(0).max(10), z.number().min(0).max(10)])
    .refine(([min, max]) => min <= max)
    .optional(),
  pattern: patternSchema,
  block: z.enum(['warmup', 'main', 'accessory', 'conditioning', 'cooldown', 'balance', 'mobility']),
  rir: z.tuple([nonnegative, nonnegative]),
  restSeconds: nonnegative,
  roundRestSeconds: nonnegative.int().optional(),
  loadBand: z.enum(['light', 'medium']).optional(),
  loadDescription: bilingualSchema.optional(),
  safetyCue: bilingualSchema.optional(),
  structure: z.enum(['straight', 'superset', 'circuit']).optional(),
  groupId: z.string().optional(),
  sourcePosition: z.string().min(1).optional(),
  goalRole: z.enum(['main', 'accessory']).optional(),
  perSide: z.boolean().optional(),
  setupSeconds: nonnegative.optional(),
  secondsPerRep: nonnegative.optional(),
  tempo: z
    .strictObject({
      eccentricSeconds: nonnegative,
      concentricSeconds: nonnegative,
      pauseSeconds: nonnegative,
    })
    .optional(),
  warmupSeconds: nonnegative.optional(),
  excludedPreviousIds: z.array(z.string()).optional(),
});
export type EnginePrescription = z.infer<typeof prescriptionSchema>;
const targetSchema = z.discriminatedUnion('metricType', [
  z.strictObject({
    metricType: z.literal('reps_load'),
    reps: z.number().int().positive(),
    loadGrams: nonnegative,
  }),
  z.strictObject({
    metricType: z.literal('reps'),
    reps: z.number().int().positive(),
  }),
  z.strictObject({
    metricType: z.literal('duration'),
    durationSeconds: z.number().positive(),
  }),
  z.strictObject({
    metricType: z.literal('duration_distance'),
    durationSeconds: z.number().positive(),
    distanceMeters: nonnegative.optional(),
  }),
]);
export const engineItemSchema = z.strictObject({
  exerciseId: z.string(),
  equipment: z.string(),
  sets: z.number().int().positive(),
  target: targetSchema,
  prescription: prescriptionSchema.optional(),
});
export const engineTemplateSchema = z.strictObject({
  weekday: weekdaySchema.optional(),
  id: z.string(),
  name: z.string(),
  estimatedMinutes: z.number().int().positive(),
  estimatedSeconds: z.number().positive().optional(),
  durationScope: z.literal('untargeted').optional(),
  targetMinutes: z.number().int().min(10).max(90).optional(),
  items: z.array(engineItemSchema),
});
export const validationIssueSchema = z.strictObject({
  code: z.string(),
  ruleId: z.string(),
  severity: z.enum(['error', 'warning']),
  templateId: z.string().optional(),
  itemIndex: nonnegative.optional(),
  reason: z.string(),
});
export type ValidationIssue = z.infer<typeof validationIssueSchema>;
export const engineQualitySchema = z.strictObject({
  environmentConstraints: z
    .array(
      z.strictObject({
        ruleId: z.string(),
        patterns: z.array(patternSchema).min(1),
        issueCodes: z.array(z.string()).min(1),
      }),
    )
    .optional(),
  status: z.enum(['ready', 'limited', 'unavailable', 'environmentLimited']),
  issues: z.array(validationIssueSchema),
  score: z.number().min(0).max(1).optional(),
  perRule: z
    .array(
      z.strictObject({
        id: z.string(),
        weight: z.number().positive(),
        satisfaction: z.number().min(0).max(1),
      }),
    )
    .optional(),
  basis: z
    .enum(['health_gate', 'source_constraint', 'no_safe_candidates', 'generation_failure', 'environment_constraint'])
    .optional(),
});
export type EngineQuality = z.infer<typeof engineQualitySchema>;
export const enginePlanSchema = z.strictObject({
  quality: engineQualitySchema.optional(),
  weeklyTarget: z.number().int().min(1).max(6),
  preferredDays: z.array(weekdaySchema).optional(),
  sessionMinutes: z.number().min(10).max(90),
  templates: z.array(engineTemplateSchema),
  meta: z.strictObject({
    engineVersion: z.string(),
    rulesVersion: z.string(),
    seed: z.string(),
  }),
  trace: z.array(ruleTraceSchema),
  notices: z.array(engineNoticeSchema),
  gates: z.array(gateResultSchema),
});
export type EnginePlan = z.infer<typeof enginePlanSchema>;
