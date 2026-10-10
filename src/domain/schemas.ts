import { z } from 'zod';
import { nutritionRecordSchema, activityImportReceiptSchema } from './lifestyle';
import { schedulingFields, validateScheduling, setTimingSchema } from './training-time';
import { knownExerciseIds } from '../catalog/registry';
import { EQUIPMENT } from '../catalog/taxonomy';
import { guidedStateSchema } from './guided-contracts';
export const localeSchema = z.enum(['zh', 'en']);
export const uuidSchema = z.uuid();
export const exerciseIdSchema = z.uuid().refine(id => knownExerciseIds.has(id), 'Unknown exercise ID');
export const localDateSchema = z.iso.date();
export const utcTimestampSchema = z.iso.datetime();
export const timeZoneSchema = z.string().refine((value) => {
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; }
  catch { return false; }
}, 'Expected an IANA time zone');
export const metricTypeSchema = z.enum(['reps_load', 'reps', 'duration', 'duration_distance']);
export const categorySchema = z.enum(['strength', 'cardio', 'bodyweight']);
export const equipmentSchema = z.enum(EQUIPMENT);
export const bilingualTextSchema = z.strictObject({ zh: z.string().min(1), en: z.string().min(1) });
const positive = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const nonnegative = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const setMetricsSchema = z.discriminatedUnion('metricType', [
  z.strictObject({ metricType: z.literal('reps_load'), reps: positive, loadGrams: nonnegative }),
  z.strictObject({ metricType: z.literal('reps'), reps: positive }),
  z.strictObject({ metricType: z.literal('duration'), durationSeconds: positive }),
  z.strictObject({ metricType: z.literal('duration_distance'), durationSeconds: positive, distanceMeters: nonnegative.optional() }),
]);
export const entityFields = { id: uuidSchema, createdAt: utcTimestampSchema, updatedAt: utcTimestampSchema, revision: nonnegative };
export const exerciseSchema = z.strictObject({
  id: uuidSchema, catalogVersion: positive, name: bilingualTextSchema,
  category: categorySchema, equipment: equipmentSchema, metricType: metricTypeSchema,
  allowedMetrics: z.array(z.enum(['reps', 'loadGrams', 'durationSeconds', 'distanceMeters'])),
  steps: z.strictObject({ zh: z.array(z.string()).min(1), en: z.array(z.string()).min(1) }),
  cautions: z.strictObject({ zh: z.array(z.string()), en: z.array(z.string()) }),
  imageAssetId: z.string().optional(), videoAssetId: z.string().optional(),
});
export const trainingPreferencesSchema = z.strictObject({
  goal: z.string().optional(), experience: z.string().optional(), availableEquipment: z.array(z.string()).optional(),
  daysPerWeek: positive.max(7).optional(), sessionMinutes: positive.optional(), heightCm: positive.optional(),
  weightGrams: positive.optional(), constraints: z.string().optional(), updatedAt: utcTimestampSchema,
  exercisePreferences: z.array(categorySchema).optional(),
  trainingLocation: z.enum(['home', 'gym', 'outdoors', 'other']).optional(),
  trainingWeekdays: z.array(positive.max(7)).min(1).max(7).optional(),
}).superRefine((preferences, context) => {
  if (!preferences.trainingWeekdays) return;
  if (new Set(preferences.trainingWeekdays).size !== preferences.trainingWeekdays.length) {
    context.addIssue({ code: 'custom', path: ['trainingWeekdays'], message: 'Training weekdays must be distinct' });
  }
  if (preferences.daysPerWeek !== undefined && preferences.trainingWeekdays.length !== preferences.daysPerWeek) {
    context.addIssue({ code: 'custom', path: ['trainingWeekdays'], message: 'Training weekday count must equal daysPerWeek' });
  }
});
export const localProfileSchema = z.strictObject({
  ...entityFields, locale: localeSchema, timeZone: timeZoneSchema, units: z.literal('metric'), trainingPreferences: trainingPreferencesSchema.optional(),
});
export const plannedExerciseSchema = z.strictObject({
  exerciseId: exerciseIdSchema, order: nonnegative, targetSets: z.array(setMetricsSchema).min(1), setTimings: z.array(setTimingSchema).min(1).optional(), notes: z.string().optional(),
}).superRefine((exercise, context) => {
  if (exercise.setTimings && (exercise.setTimings.length !== exercise.targetSets.length || exercise.targetSets.some((set, index) => 'durationSeconds' in set && set.durationSeconds !== exercise.setTimings![index]?.durationSeconds))) context.addIssue({ code: 'custom', message: 'Set timing must match each target set' });
});
export const planDaySchema = z.strictObject({
  dayId: uuidSchema, weekIndex: positive.max(12), dayOfWeek: positive.max(7), exercises: z.array(plannedExerciseSchema).min(1),
});
export const goalSnapshotSchema = z.strictObject({ goal: z.string(), trainingPreferences: trainingPreferencesSchema.optional() });
export const generationMetadataSchema = z.strictObject({
  requestId: uuidSchema.optional(), model: z.string().optional(), promptVersion: z.string().optional(), generatedAt: utcTimestampSchema.optional(), memoRevision: nonnegative.optional(),
});
export const legacyPlanVersionSchema = z.strictObject({
  ...entityFields, planId: uuidSchema, versionNumber: positive, goalSnapshot: goalSnapshotSchema,
  startDate: localDateSchema, scheduleTimeZone: timeZoneSchema,
  durationWeeks: positive.max(12), daysPerWeek: positive.max(7), days: z.array(planDaySchema).min(1), generationMetadata: generationMetadataSchema.optional(),
});
export const datePlanDaySchema = z.strictObject({ dayId: uuidSchema, date: localDateSchema, exercises: z.array(plannedExerciseSchema).min(1) });
export const datePlanVersionSchema = z.strictObject({
  ...entityFields, model: z.literal('date-day'), planId: uuidSchema, versionNumber: positive, goalSnapshot: goalSnapshotSchema,
  startDate: localDateSchema, scheduleTimeZone: timeZoneSchema, days: z.tuple([datePlanDaySchema]), generationMetadata: generationMetadataSchema.optional(),
}).refine(version => version.days[0].date === version.startDate, 'Day date must match its original date');
export const planVersionSchema = z.union([datePlanVersionSchema, legacyPlanVersionSchema]);
export const planSchema = z.strictObject({
  ...entityFields, name: z.string().min(1), source: z.enum(['ai', 'manual']), status: z.enum(['draft', 'active', 'archived']),
  currentVersionId: uuidSchema, startDate: localDateSchema, scheduleTimeZone: timeZoneSchema, deletedAt: utcTimestampSchema.optional(),
  model: z.literal('date-day').optional(),
});
export const exerciseSnapshotSchema = exerciseSchema.omit({ steps: true, cautions: true, imageAssetId: true, videoAssetId: true }).extend({
  exerciseInstanceId: uuidSchema, exerciseId: exerciseIdSchema, order: nonnegative, targetSets: z.array(setMetricsSchema), setTimings: z.array(setTimingSchema).optional(), notes: z.string().optional(), originalExerciseId: exerciseIdSchema.optional(),
});
export const workoutSessionSchema = z.strictObject({
  ...entityFields, planVersionId: uuidSchema.optional(), plannedDayId: uuidSchema.optional(), status: z.enum(['in_progress', 'completed', 'abandoned']),
  startedAt: utcTimestampSchema, completedAt: utcTimestampSchema.optional(), localDate: localDateSchema, timeZone: timeZoneSchema,
  originalExerciseSnapshots: z.array(exerciseSnapshotSchema), exerciseSnapshots: z.array(exerciseSnapshotSchema), notes: z.string().optional(),
});
export const setRecordSchema = z.strictObject({
  ...entityFields, sessionId: uuidSchema, exerciseInstanceId: uuidSchema, order: nonnegative, metricType: metricTypeSchema,
  reps: positive.optional(), loadGrams: nonnegative.optional(), durationSeconds: positive.optional(), distanceMeters: nonnegative.optional(), completed: z.boolean(), notes: z.string().optional(),
}).superRefine((record, context) => {
  const { metricType, reps, loadGrams, durationSeconds, distanceMeters } = record;
  const fields = { reps, loadGrams, durationSeconds, distanceMeters };
  const allowed = metricType === 'reps_load' ? ['reps', 'loadGrams'] : metricType === 'reps' ? ['reps'] : metricType === 'duration' ? ['durationSeconds'] : ['durationSeconds', 'distanceMeters'];
  if (Object.entries(fields).some(([key, value]) => value !== undefined && !allowed.includes(key))) context.addIssue({ code: 'custom', message: 'Metric does not belong to this type' });
  if (record.completed && !setMetricsSchema.safeParse({ metricType, ...Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) }).success) context.addIssue({ code: 'custom', message: 'Completed sets require valid metrics' });
});
export const scheduledWorkoutSchema = z.strictObject({
  ...entityFields, planVersionId: uuidSchema, plannedDayId: uuidSchema, originalDate: localDateSchema, scheduledDate: localDateSchema,
  ...schedulingFields, status: z.enum(['pending', 'skipped']), completedSessionId: uuidSchema.optional(), hiddenAt: utcTimestampSchema.optional(),
}).superRefine(validateScheduling);
// Restore-only schema: preserve malformed historical duration values without weakening new scheduling writes.
export const legacyBackupScheduleSchema = z.strictObject({
  ...entityFields, planVersionId: uuidSchema, plannedDayId: uuidSchema, originalDate: localDateSchema, scheduledDate: localDateSchema,
  startTime: schedulingFields.startTime, durationMinutes: z.unknown().optional(), status: z.enum(['pending', 'skipped']),
  completedSessionId: uuidSchema.optional(), hiddenAt: utcTimestampSchema.optional(),
});
export const bodyWeightObservationSchema = z.strictObject({ ...entityFields, localDate: localDateSchema, timeZone: timeZoneSchema, weightGrams: positive });
export const metadataSchema = z.strictObject({
  schemaVersion: positive, localProfileId: uuidSchema, catalogVersion: positive, revision: nonnegative, dataRevision: nonnegative,
  importedAt: utcTimestampSchema.optional(), upgradedAt: utcTimestampSchema.optional(),
  restoreGeneration: nonnegative.optional(),
});
export const memoSessionSchema = z.strictObject({ session: workoutSessionSchema, sets: z.array(setRecordSchema), planVersionSnapshot: planVersionSchema.optional() });
export const trainingMemoSchema = z.strictObject({ schemaVersion: positive, revision: nonnegative, updatedAt: utcTimestampSchema, sourceRevision: nonnegative, sessions: z.array(memoSessionSchema) });
export const aiMemoryNoteSchema = z.strictObject({ ...entityFields, memoRevision: nonnegative, generatorVersion: z.string(), locale: localeSchema, suggestion: z.string(), explanation: z.string() });
export const mediaAssetSchema = z.strictObject({
  id: z.string(), type: z.enum(['image', 'video']), provider: z.enum(['r2', 'youtube']),
  url: z.url().optional(), youtubeVideoId: z.string().optional(), creator: z.string(), language: z.string(),
  altText: bilingualTextSchema, caption: bilingualTextSchema, source: z.string(), license: z.string(),
  attribution: z.string(), checkedAt: utcTimestampSchema.optional(),
  embeddingStatus: z.enum(['unreviewed', 'available', 'unavailable']), version: positive,
});
export const timerStateSchema = z.strictObject({
  ...entityFields, sessionId: uuidSchema, exerciseInstanceId: uuidSchema.optional(), kind: z.enum(['exercise', 'rest']), status: z.enum(['idle', 'running', 'paused', 'stopped']),
  accumulatedMs: nonnegative, startedAtMs: nonnegative.optional(), targetMs: positive.optional(),
});
const v8Minutes = z.number().int().min(15).max(120);
export const v8PlanSchema = z.strictObject({ id: uuidSchema, name: z.string(), currentVersionId: uuidSchema, readOnly: z.boolean() });
export const v8PlanVersionSchema = z.strictObject({
  id: uuidSchema, planId: uuidSchema, versionNumber: positive, goalText: z.string(), weeklyTarget: positive.max(7),
  scheduleOriginalText: z.string(), sessionMinutes: v8Minutes,
  templates: z.array(z.strictObject({ id: z.string().min(1), name: z.string().min(1), estimatedMinutes: v8Minutes,
    items: z.array(z.strictObject({ exerciseId: exerciseIdSchema, equipment: z.string(), sets: positive, target: setMetricsSchema })).min(1),
  })).min(1), createdAt: utcTimestampSchema, origin: z.enum(['onboard', 'coach_change', 'review_suggestion', 'manual', 'migrated']),
  changeSummary: z.array(z.string()), basedOnVersionId: uuidSchema.optional(),
});
const v8Feel = z.enum(['easy', 'right', 'tired', 'very_tired']);
const v8Reason = z.enum(['time', 'fatigue', 'discomfort', 'equipment_busy', 'not_today', 'other']);
export const v8WorkoutSchema = z.strictObject({
  id: uuidSchema, planVersionId: uuidSchema.optional(), templateId: z.string().optional(), startedAt: utcTimestampSchema, endedAt: utcTimestampSchema.optional(),
  localDate: localDateSchema, timeZone: timeZoneSchema, status: z.enum(['in_progress', 'complete', 'partial', 'not_started', 'abandoned']), variant: z.literal('short').optional(),
  sets: z.array(z.strictObject({ exerciseId: exerciseIdSchema, itemIndex: nonnegative, setIndex: nonnegative, reps: positive.optional(), durationSeconds: positive.optional(),
    distanceMeters: nonnegative.optional(), loadGrams: nonnegative.nullable().optional(), completedAt: utcTimestampSchema, substitutedFrom: exerciseIdSchema.optional() })),
  plannedSetCount: nonnegative,
  templateSnapshot: v8PlanVersionSchema.shape.templates.element.optional(),
  feedback: z.strictObject({ feel: v8Feel.optional(), reasons: z.array(v8Reason), note: z.string().optional(), discomfortExerciseIds: z.array(exerciseIdSchema).optional() }).optional(),
  plannedExercises: z.array(z.strictObject({ exerciseId: exerciseIdSchema, itemIndex: nonnegative, plannedSetCount: nonnegative })).optional(),
  substitutions: z.array(z.strictObject({ fromExerciseId: exerciseIdSchema, toExerciseId: exerciseIdSchema, itemIndex: nonnegative, reason: z.enum(['discomfort', 'other']), createdAt: utcTimestampSchema })).optional(),
  appendedNotes: z.array(z.strictObject({ text: z.string(), createdAt: utcTimestampSchema })).optional(),
});
export const v8ActivitySchema = z.strictObject({ id: uuidSchema, type: z.enum(['walk', 'run', 'cycle', 'swim', 'yoga', 'stairs', 'other']), customName: z.string().optional(),
  minutes: z.number().positive().finite(), localDate: localDateSchema, timeZone: timeZoneSchema, feel: v8Feel.optional(), note: z.string().optional(), createdAt: utcTimestampSchema });
export const v8CoachProfileSchema = z.strictObject({
  goalText: z.string(), weeklyTarget: positive.max(7), sessionMinutes: v8Minutes, scheduleOriginalText: z.string(),
  place: z.enum(['home', 'gym', 'outdoor', 'mixed']), equipment: z.array(z.string()), adultConfirmed: z.boolean(),
  cautions: z.array(z.enum(['knee', 'back', 'shoulder', 'wrist', 'other'])), cautionNote: z.string().optional(), confirmedAt: utcTimestampSchema,
});
export const v8StateSchema = z.strictObject({
  id: z.literal('v8'), currentPlanId: uuidSchema.optional(), migratedAt: utcTimestampSchema,
  legacyPlanIds: z.array(uuidSchema),
  notice: z.strictObject({ planCount: nonnegative, currentPlanName: z.string().optional(), acknowledged: z.boolean() }),
  coachProfile: v8CoachProfileSchema.optional(),
  nextWorkoutOverride: z.strictObject({ planVersionId: uuidSchema, templateId: z.string(), template: v8PlanVersionSchema.shape.templates.element, requestId: uuidSchema }).optional(),
});
export const v8BackupSchema = z.strictObject({ state: v8StateSchema, plans: z.array(v8PlanSchema), planVersions: z.array(v8PlanVersionSchema),
  workouts: z.array(v8WorkoutSchema), activities: z.array(v8ActivitySchema) });
export const backupDataSchema = z.strictObject({
  metadata: metadataSchema, profiles: z.array(localProfileSchema), plans: z.array(planSchema), planVersions: z.array(planVersionSchema),
  sessions: z.array(workoutSessionSchema), sets: z.array(setRecordSchema), scheduledWorkouts: z.array(legacyBackupScheduleSchema),
  bodyWeights: z.array(bodyWeightObservationSchema), trainingMemo: trainingMemoSchema, aiMemoryNotes: z.array(aiMemoryNoteSchema), timers: z.array(timerStateSchema),
  mediaAssets: z.array(mediaAssetSchema).default([]),
  guidedStates: z.array(guidedStateSchema).optional(),
  v8: v8BackupSchema.optional(),
  nutritionRecords: z.array(nutritionRecordSchema).optional(),
  activityImportReceipts: z.array(activityImportReceiptSchema).optional(),
});
export const backupEnvelopeSchema = z.strictObject({ format: z.literal('fitness-local'), schemaVersion: positive, exportedAt: utcTimestampSchema, catalogVersion: positive, data: backupDataSchema });
