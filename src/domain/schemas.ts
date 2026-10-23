import { conversationSchema } from './assistant-conversation';
import { z } from 'zod';
import { nutritionRecordSchema, activityImportReceiptSchema } from './lifestyle';
import { guidedStateSchema } from './guided-contracts';
import { FITNESS_TEST_ITEMS, ROUTES } from './plan-upgrade';
import {
  uuidSchema,
  localDateSchema,
  utcTimestampSchema,
  positive,
  localProfileSchema,
  planVersionSchema,
  planSchema,
  workoutSessionSchema,
  setRecordSchema,
  legacyBackupScheduleSchema,
  bodyWeightObservationSchema,
  metadataSchema,
  trainingMemoSchema,
  aiMemoryNoteSchema,
  mediaAssetSchema,
  timerStateSchema,
} from './schemas/base';
import { v8BackupSchema } from './schemas/v8';
export {
  localeSchema,
  uuidSchema,
  exerciseIdSchema,
  localDateSchema,
  utcTimestampSchema,
  timeZoneSchema,
  setMetricsSchema,
  exerciseSchema,
  trainingPreferencesSchema,
  localProfileSchema,
  plannedExerciseSchema,
  planDaySchema,
  goalSnapshotSchema,
  legacyPlanVersionSchema,
  datePlanDaySchema,
  datePlanVersionSchema,
  planVersionSchema,
  planSchema,
  exerciseSnapshotSchema,
  workoutSessionSchema,
  setRecordSchema,
  scheduledWorkoutSchema,
  bodyWeightObservationSchema,
  bodyWeightInputSchema,
  metadataSchema,
  trainingMemoSchema,
  aiMemoryNoteSchema,
  mediaAssetSchema,
  timerStateSchema,
} from './schemas/base';
export {
  validateTemplateMinutes,
  weeklyBudgetSchema,
  v8PlanVersionSchema,
  setFeedbackEventSchema,
  v8WorkoutSchema,
  v8ActivitySchema,
  v8CoachProfileSchema,
  v8StateSchema,
  v8BackupSchema,
} from './schemas/v8';
// ---- Training-plan upgrade rows (UIUX20261008 V9.14, DB 21) ----
const fitnessTestValue = z.number().finite().nonnegative().max(10_000);
export const fitnessTestRecordSchema = z
  .strictObject({
    id: uuidSchema,
    localDate: localDateSchema,
    createdAt: utcTimestampSchema,
    results: z.partialRecord(z.enum(FITNESS_TEST_ITEMS), fitnessTestValue),
  })
  .refine(record => Object.keys(record.results).length > 0, 'A fitness test needs at least one result');
const campSchema = z.strictObject({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(200),
  metric: z.enum([...FITNESS_TEST_ITEMS, 'weightKg', 'waistCm', 'sessions']),
  start: z.number().finite(),
  target: z.number().finite(),
  reachedAt: utcTimestampSchema.optional(),
});
export const journeySchema = z
  .strictObject({
    id: uuidSchema,
    route: z.enum(ROUTES),
    secondaryRoute: z.enum(ROUTES).optional(),
    destination: z.string().max(500),
    camps: z.array(campSchema).max(50),
    version: positive,
    createdAt: utcTimestampSchema,
  })
  .superRefine((journey, ctx) => {
    if (new Set(journey.camps.map(camp => camp.id)).size !== journey.camps.length)
      ctx.addIssue({ code: 'custom', path: ['camps'], message: 'Camp IDs must be distinct' });
  });
export const futureLetterSchema = z.strictObject({
  id: uuidSchema,
  text: z.string().min(1).max(5000),
  createdAt: utcTimestampSchema,
  openAtCampId: z.string().min(1).max(80).optional(),
  openedAt: utcTimestampSchema.optional(),
});
export const backupDataSchema = z.strictObject({
  fitnessTests: z.array(fitnessTestRecordSchema).optional(),
  journeys: z.array(journeySchema).optional(),
  futureLetters: z.array(futureLetterSchema).optional(),
  assistantConversations: z.array(conversationSchema).max(30).optional(),
  exerciseFavorites: z.array(z.strictObject({ id: z.string().min(1) })).optional(),
  metadata: metadataSchema,
  profiles: z.array(localProfileSchema),
  plans: z.array(planSchema),
  planVersions: z.array(planVersionSchema),
  sessions: z.array(workoutSessionSchema),
  sets: z.array(setRecordSchema),
  scheduledWorkouts: z.array(legacyBackupScheduleSchema),
  bodyWeights: z.array(bodyWeightObservationSchema),
  trainingMemo: trainingMemoSchema,
  aiMemoryNotes: z.array(aiMemoryNoteSchema),
  timers: z.array(timerStateSchema),
  mediaAssets: z.array(mediaAssetSchema).default([]),
  guidedStates: z.array(guidedStateSchema).optional(),
  v8: v8BackupSchema.optional(),
  nutritionRecords: z.array(nutritionRecordSchema).optional(),
  activityImportReceipts: z.array(activityImportReceiptSchema).optional(),
});
export const backupEnvelopeSchema = z.strictObject({
  format: z.literal('fitness-local'),
  schemaVersion: positive,
  exportedAt: utcTimestampSchema,
  catalogVersion: positive,
  data: backupDataSchema,
});
