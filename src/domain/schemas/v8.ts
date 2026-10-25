import { z } from 'zod';
import {
  engineProfileSchema,
  prescriptionSchema,
  enginePlanSchema,
  cautionSchema,
  cautionJointSchema,
  painSideSchema,
  patternSchema,
  engineItemSchema,
} from '../../engine/contracts';
import { HOME_PANEL_STYLES, ROUTES, STARTER_PROGRAM_ID } from '../plan-upgrade';
import {
  uuidSchema,
  exerciseIdSchema,
  localDateSchema,
  utcTimestampSchema,
  timeZoneSchema,
  positive,
  nonnegative,
  setMetricsSchema,
} from './base';
const v8Minutes = z.number().int().min(10).max(120);
const v8AdjustmentMinutes = z.number().int().min(10).max(120);
/** Untargeted source courses retain real elapsed minutes; ordinary courses keep their existing bounds. */
export function validateTemplateMinutes(
  template: { estimatedMinutes: number; durationScope?: 'untargeted'; targetMinutes?: number },
  ctx: z.RefinementCtx,
) {
  if (template.durationScope === 'untargeted' && template.targetMinutes === undefined) return;
  if (!v8AdjustmentMinutes.safeParse(template.estimatedMinutes).success)
    ctx.addIssue({ code: 'custom', path: ['estimatedMinutes'], message: 'Invalid estimated duration' });
}
const v8PreferredDays = z
  .array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']))
  .max(7)
  .optional();
/** Optional weekly-budget layer (V9.14); absent on older versions means "by day" as before. */
export const weeklyBudgetSchema = z.strictObject({
  mode: z.enum(['by-day', 'budget']),
  minutesPerWeek: z
    .number()
    .int()
    .positive()
    .max(7 * 24 * 60)
    .optional(),
  setsPerGroupPerWeek: z.number().positive().max(100).optional(),
});
export const v8PlanVersionSchema = z.strictObject({
  enginePlan: enginePlanSchema.optional(),
  id: uuidSchema,
  planId: uuidSchema,
  versionNumber: positive,
  goalText: z.string(),
  weeklyTarget: positive.max(7),
  scheduleOriginalText: z.string(),
  sessionMinutes: v8Minutes,
  preferredDays: v8PreferredDays,
  /** Local calendar date the plan starts (V9.x); absent on older versions means it started when created. */
  startDate: localDateSchema.optional(),
  /** Calendar-picked training days (V9.x, Bo 2026-10-19): sorted, unique, 1–30, span ≤ 30 days; absent on older versions. */
  trainingDates: z.array(localDateSchema).min(1).max(30).optional(),
  /** Planned start time of day, local HH:MM; absent when not chosen. */
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional(),
  scheduleRecovery: z.strictObject({ raw: z.string(), recoveredAt: utcTimestampSchema }).optional(),
  weeklyBudget: weeklyBudgetSchema.optional(),
  /** 新手 4 周 (Bo 2026-10-25); absent on older versions and on plans that never used it. */
  starterProgram: z.strictObject({ id: z.literal(STARTER_PROGRAM_ID), startDate: localDateSchema }).optional(),
  templates: z
    .array(
      z
        .strictObject({
          weekday: z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']).optional(),
          id: z.string().min(1),
          name: z.string().min(1),
          estimatedMinutes: z.number().int().positive().max(120),
          estimatedSeconds: z.number().positive().optional(),
          durationScope: z.literal('untargeted').optional(),
          targetMinutes: z.number().int().min(10).max(90).optional(),
          items: z
            .array(
              z.strictObject({
                exerciseId: exerciseIdSchema,
                equipment: z.string(),
                sets: positive,
                target: setMetricsSchema,
                prescription: prescriptionSchema.optional(),
              }),
            )
            .min(1),
        })
        .superRefine(validateTemplateMinutes),
    )
    .min(1),
  createdAt: utcTimestampSchema,
  origin: z.enum(['onboard', 'coach_change', 'review_suggestion', 'manual', 'migrated']),
  reviewRule: z.enum(['time', 'progression', 'frequency', 'restart', 'discomfort']).optional(),
  changeSummary: z.array(z.string()),
  basedOnVersionId: uuidSchema.optional(),
  source: z.enum(['local', 'ai']).optional(),
});
const v8NextWorkoutOverrideSchema = z.strictObject({
  planVersionId: uuidSchema,
  templateId: z.string(),
  template: v8PlanVersionSchema.shape.templates.element,
  requestId: uuidSchema,
});
const v8PlanSchema = z.strictObject({
  id: uuidSchema,
  name: z.string(),
  currentVersionId: uuidSchema,
  readOnly: z.boolean(),
  deletedAt: utcTimestampSchema.optional(),
  deletedWasCurrent: z.boolean().optional(),
  deletedNextWorkoutOverride: v8NextWorkoutOverrideSchema.optional(),
});
const v8Feel = z.enum(['easy', 'right', 'tired', 'very_tired']);
const v8Reason = z.enum(['time', 'fatigue', 'discomfort', 'equipment_busy', 'not_today', 'other']);
export const setFeedbackEventSchema = z
  .strictObject({
    id: uuidSchema,
    itemIndex: nonnegative,
    setIndex: nonnegative,
    exerciseId: exerciseIdSchema,
    createdAt: utcTimestampSchema,
    effort: z.enum(['too_light', 'right', 'too_hard', 'discomfort']),
    rir: z.number().min(0).max(10).optional(),
    painScore: z.number().int().min(0).max(10).optional(),
    painArea: cautionSchema.optional(),
    painSide: painSideSchema.optional(),
  })
  .superRefine((event, ctx) => {
    if (event.effort === 'discomfort' && (event.painScore === undefined || !event.painArea))
      ctx.addIssue({ code: 'custom', message: 'Discomfort requires an explicit score and area' });
  });
export const v8WorkoutSchema = z
  .strictObject({
    postpartumSymptoms: z
      .array(
        z.strictObject({
          recordedAt: utcTimestampSchema,
          urgent: z.array(
            z.enum([
              'heavy_bleeding',
              'fever',
              'wound_hot_red_or_oozing',
              'calf_pain_or_swelling',
              'chest_pain',
              'breathlessness',
            ]),
          ),
          regression: z.array(z.enum(['leakage', 'heaviness', 'dragging', 'pain', 'bleeding'])),
        }),
      )
      .optional(),
    painActions: z
      .array(
        z.strictObject({
          eventId: uuidSchema,
          appliedAt: utcTimestampSchema,
          kind: z.enum(['substitute', 'exclude', 'review']),
          pattern: patternSchema,
          itemIndex: nonnegative,
          replacement: engineItemSchema.optional(),
          excludedItemIndexes: z.array(nonnegative).optional(),
          redFlagAnswers: z.record(z.string(), z.boolean()).optional(),
        }),
      )
      .optional(),
    painReviewRequired: z.boolean().optional(),
    setFeedbackEvents: z.array(setFeedbackEventSchema).optional(),
    checkin: z
      .strictObject({
        energyMotivation: z.number().int().min(1).max(5).optional(),
        poorSleepNights: z.number().int().nonnegative().optional(),
        sorenessResolved: z.boolean().optional(),
        newOrWorseJointPain: z.boolean().optional(),
      })
      .optional(),
    id: uuidSchema,
    planVersionId: uuidSchema.optional(),
    templateId: z.string().optional(),
    startedAt: utcTimestampSchema,
    endedAt: utcTimestampSchema.optional(),
    localDate: localDateSchema,
    timeZone: timeZoneSchema,
    status: z.enum(['in_progress', 'complete', 'partial', 'not_started', 'abandoned']),
    variant: z.literal('short').optional(),
    sets: z.array(
      z.strictObject({
        exerciseId: exerciseIdSchema,
        itemIndex: nonnegative,
        setIndex: nonnegative,
        reps: positive.optional(),
        durationSeconds: positive.optional(),
        distanceMeters: nonnegative.optional(),
        loadGrams: nonnegative.nullable().optional(),
        completedAt: utcTimestampSchema,
        substitutedFrom: exerciseIdSchema.optional(),
      }),
    ),
    plannedSetCount: nonnegative,
    templateSnapshot: v8PlanVersionSchema.shape.templates.element.optional(),
    feedback: z
      .strictObject({
        feel: v8Feel.optional(),
        reasons: z.array(v8Reason),
        note: z.string().optional(),
        discomfortExerciseIds: z.array(exerciseIdSchema).optional(),
      })
      .optional(),
    plannedExercises: z
      .array(z.strictObject({ exerciseId: exerciseIdSchema, itemIndex: nonnegative, plannedSetCount: nonnegative }))
      .optional(),
    substitutions: z
      .array(
        z.strictObject({
          fromExerciseId: exerciseIdSchema,
          toExerciseId: exerciseIdSchema,
          itemIndex: nonnegative,
          reason: z.enum(['discomfort', 'other']),
          createdAt: utcTimestampSchema,
        }),
      )
      .optional(),
    appendedNotes: z.array(z.strictObject({ text: z.string(), createdAt: utcTimestampSchema })).optional(),
    timeCorrections: z
      .array(
        z.strictObject({ startedAt: utcTimestampSchema, endedAt: utcTimestampSchema, createdAt: utcTimestampSchema }),
      )
      .optional(),
  })
  .superRefine((record, ctx) => {
    const seen = new Set<string>();
    for (const [index, action] of (record.painActions ?? []).entries()) {
      if (
        action.kind === 'review' &&
        (record.status === 'in_progress' ||
          action.replacement !== undefined ||
          action.excludedItemIndexes !== undefined)
      )
        ctx.addIssue({
          code: 'custom',
          path: ['painActions', index],
          message: 'Historical review cannot execute or change an exercise',
        });
      if (
        action.kind === 'exclude' &&
        (!action.excludedItemIndexes?.length || !action.excludedItemIndexes.includes(action.itemIndex))
      )
        ctx.addIssue({
          code: 'custom',
          path: ['painActions', index],
          message: 'Pain exclusion must include the affected slot',
        });
      if (
        action.kind === 'substitute' &&
        record.status === 'in_progress' &&
        !action.replacement &&
        record.painReviewRequired !== true
      )
        ctx.addIssue({
          code: 'custom',
          path: ['painActions', index],
          message: 'Missing replacement requires an explicit safety pause',
        });
      const event = record.setFeedbackEvents?.find(row => row.id === action.eventId);
      if (
        seen.has(action.eventId) ||
        !event ||
        event.effort !== 'discomfort' ||
        event.itemIndex !== action.itemIndex ||
        !record.sets.some(
          set =>
            set.itemIndex === event.itemIndex && set.setIndex === event.setIndex && set.exerciseId === event.exerciseId,
        )
      )
        ctx.addIssue({
          code: 'custom',
          path: ['painActions', index],
          message: 'Pain action must reference one explicit completed-set discomfort event',
        });
      seen.add(action.eventId);
      if (
        action.excludedItemIndexes?.some(
          itemIndex => !record.plannedExercises?.some(item => item.itemIndex === itemIndex),
        )
      )
        ctx.addIssue({
          code: 'custom',
          path: ['painActions', index, 'excludedItemIndexes'],
          message: 'Unknown pain exclusion slot',
        });
    }
  });
export const v8ActivitySchema = z.strictObject({
  id: uuidSchema,
  type: z.enum(['walk', 'run', 'cycle', 'swim', 'yoga', 'stairs', 'other']),
  customName: z.string().optional(),
  minutes: z.number().positive().finite(),
  localDate: localDateSchema,
  timeZone: timeZoneSchema,
  feel: v8Feel.optional(),
  note: z.string().optional(),
  createdAt: utcTimestampSchema,
});
export const v8CoachProfileSchema = z
  .strictObject({
    ...engineProfileSchema
      .pick({
        postpartumRisk: true,
        powerOneRm: true,
        householdSupport: true,
        goal: true,
        level: true,
        constraints: true,
        population: true,
        screening: true,
        preferences: true,
        birthYearMonth: true,
        equipmentLoadsKg: true,
        availableLoadsKg: true,
        painState: true,
      })
      .partial().shape,
    healthStorageConsent: z.strictObject({ acceptedAt: utcTimestampSchema }).optional(),
    /** Route picked in onboarding (Bo 2026-10-25); absent on older profiles. */
    route: z.enum(ROUTES).optional(),
    goalText: z.string(),
    weeklyTarget: positive.max(7),
    sessionMinutes: v8Minutes,
    scheduleOriginalText: z.string(),
    preferredDays: v8PreferredDays,
    place: z.enum(['home', 'gym', 'outdoor', 'mixed']),
    equipment: z.array(z.string()),
    adultConfirmed: z.boolean(),
    placeEquipmentOriginalText: z.string().optional(),
    cautions: z.array(cautionSchema),
    cautionNote: z.string().optional(),
    confirmedAt: utcTimestampSchema,
  })
  .superRefine((profile, ctx) => {
    if ((profile.powerOneRm || profile.postpartumRisk) && !profile.healthStorageConsent)
      ctx.addIssue({
        code: 'custom',
        path: ['powerOneRm'],
        message: 'Health storage consent required for strength reference values',
      });
  });
export const v8StateSchema = z.strictObject({
  cautionLevels: z
    .partialRecord(
      cautionJointSchema,
      z.strictObject({ level: z.union([z.literal(0), z.literal(1), z.literal(2)]), changedAt: utcTimestampSchema }),
    )
    .optional(),
  painFollowupRestrictions: z
    .array(
      z.strictObject({
        pattern: patternSchema,
        appliedAt: utcTimestampSchema,
        sourceWorkoutId: uuidSchema,
        cautionLevelDelta: z.number().int().nonnegative(),
      }),
    )
    .optional(),
  postpartumReferralChecks: z
    .strictObject({
      each_phase_transition: z
        .strictObject({
          answeredAt: utcTimestampSchema,
          phase: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
        })
        .optional(),
      running_readiness_check: z.strictObject({ answeredAt: utcTimestampSchema }).optional(),
      weekly_checkin: z.strictObject({ answeredAt: utcTimestampSchema }).optional(),
    })
    .optional(),
  pregnancySafety: z
    .strictObject({
      providerPause: z.strictObject({ requiredAt: utcTimestampSchema }).optional(),
      supineAvoidSince: utcTimestampSchema.optional(),
    })
    .optional(),
  olderSafety: z
    .strictObject({
      fallAt: utcTimestampSchema,
      reviewRequiredAt: utcTimestampSchema.optional(),
      injuryConfirmed: z.literal(true).optional(),
      balanceStage: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
      professionalSeenAt: utcTimestampSchema.optional(),
    })
    .optional(),
  cardiacPause: z.strictObject({ requiredAt: utcTimestampSchema }).optional(),
  screeningEvidenceEvents: z
    .array(z.strictObject({ answeredAt: utcTimestampSchema, symptoms: z.boolean() }))
    .optional(),
  postpartumSafety: z
    .strictObject({
      lastSymptomAt: utcTimestampSchema.optional(),
      urgentAt: utcTimestampSchema.optional(),
      regression: z
        .strictObject({
          requiredAt: utcTimestampSchema,
          phase: z.union([z.literal(1), z.literal(2), z.literal(3)]),
          symptomFreeDates: z.array(localDateSchema),
        })
        .optional(),
      professionalSeenAt: utcTimestampSchema.optional(),
    })
    .optional(),
  trainingPause: z.strictObject({ requiredAt: utcTimestampSchema }).optional(),
  id: z.literal('v8'),
  currentPlanId: uuidSchema.optional(),
  planDismissedAt: utcTimestampSchema.optional(),
  reviewWeeklyTarget: positive.max(7).optional(),
  migratedAt: utcTimestampSchema,
  legacyPlanIds: z.array(uuidSchema),
  notice: z.strictObject({ planCount: nonnegative, currentPlanName: z.string().optional(), acknowledged: z.boolean() }),
  coachProfile: v8CoachProfileSchema.optional(),
  nextWorkoutOverride: v8NextWorkoutOverrideSchema.optional(),
  /** Home panel style (V9.14); absent means the default big-number panel. */
  homePanelStyle: z.enum(HOME_PANEL_STYLES).optional(),
});
const v8PlanReferenceSchema = z.strictObject({
  id: uuidSchema,
  planId: uuidSchema,
  planName: z.string(),
  versionNumber: positive,
  templateIds: z.array(z.string()),
  legacyTemplates: z.array(v8PlanVersionSchema.shape.templates.element).optional(),
});
export const v8BackupSchema = z.strictObject({
  state: v8StateSchema,
  plans: z.array(v8PlanSchema),
  planVersions: z.array(v8PlanVersionSchema),
  workouts: z.array(v8WorkoutSchema),
  activities: z.array(v8ActivitySchema),
  planReferences: z.array(v8PlanReferenceSchema).optional(),
});
