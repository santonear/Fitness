import { z } from 'zod';
import { EXERCISE_IDS } from '../catalog/exercise-ids';
export const localeSchema = z.enum(['zh', 'en']);
export const uuidSchema = z.uuid();
export const exerciseIdSchema = z.enum(EXERCISE_IDS);
export const localDateSchema = z.iso.date();
export const utcTimestampSchema = z.iso.datetime();
export const timeZoneSchema = z.string().refine((value) => {
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; }
  catch { return false; }
}, 'Expected an IANA time zone');
export const metricTypeSchema = z.enum(['reps_load', 'reps', 'duration', 'duration_distance']);
export const categorySchema = z.enum(['strength', 'cardio', 'bodyweight']);
export const equipmentSchema = z.enum(['none', 'dumbbell']);
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
  exerciseId: exerciseIdSchema, order: nonnegative, targetSets: z.array(setMetricsSchema).min(1), notes: z.string().optional(),
});
export const planDaySchema = z.strictObject({
  dayId: uuidSchema, weekIndex: positive.max(12), dayOfWeek: positive.max(7), exercises: z.array(plannedExerciseSchema).min(1),
});
export const goalSnapshotSchema = z.strictObject({ goal: z.string(), trainingPreferences: trainingPreferencesSchema.optional() });
export const generationMetadataSchema = z.strictObject({
  requestId: uuidSchema.optional(), model: z.string().optional(), promptVersion: z.string().optional(), generatedAt: utcTimestampSchema.optional(), memoRevision: nonnegative.optional(),
});
export const planVersionSchema = z.strictObject({
  ...entityFields, planId: uuidSchema, versionNumber: positive, goalSnapshot: goalSnapshotSchema,
  durationWeeks: positive.max(12), daysPerWeek: positive.max(7), days: z.array(planDaySchema).min(1), generationMetadata: generationMetadataSchema.optional(),
});
export const planSchema = z.strictObject({
  ...entityFields, name: z.string().min(1), source: z.enum(['ai', 'manual']), status: z.enum(['draft', 'active', 'archived']),
  currentVersionId: uuidSchema, startDate: localDateSchema, scheduleTimeZone: timeZoneSchema,
});
export const exerciseSnapshotSchema = exerciseSchema.omit({ steps: true, cautions: true, imageAssetId: true, videoAssetId: true }).extend({
  exerciseInstanceId: uuidSchema, exerciseId: exerciseIdSchema, order: nonnegative, targetSets: z.array(setMetricsSchema), notes: z.string().optional(), originalExerciseId: exerciseIdSchema.optional(),
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
  status: z.enum(['pending', 'skipped']), completedSessionId: uuidSchema.optional(),
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
export const backupDataSchema = z.strictObject({
  metadata: metadataSchema, profiles: z.array(localProfileSchema), plans: z.array(planSchema), planVersions: z.array(planVersionSchema),
  sessions: z.array(workoutSessionSchema), sets: z.array(setRecordSchema), scheduledWorkouts: z.array(scheduledWorkoutSchema),
  bodyWeights: z.array(bodyWeightObservationSchema), trainingMemo: trainingMemoSchema, aiMemoryNotes: z.array(aiMemoryNoteSchema), timers: z.array(timerStateSchema),
  mediaAssets: z.array(mediaAssetSchema).default([]),
});
export const backupEnvelopeSchema = z.strictObject({ format: z.literal('fitness-local'), schemaVersion: positive, exportedAt: utcTimestampSchema, catalogVersion: positive, data: backupDataSchema });
