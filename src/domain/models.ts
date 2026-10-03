import type { z } from 'zod';
import type * as schemas from './schemas';

export type Locale = z.infer<typeof schemas.localeSchema>;
export type LocalDate = z.infer<typeof schemas.localDateSchema>;
export type SetMetrics = z.infer<typeof schemas.setMetricsSchema>;
export type MetricType = SetMetrics['metricType'];
export type Exercise = z.infer<typeof schemas.exerciseSchema>;
export type LocalProfile = z.infer<typeof schemas.localProfileSchema>;
export type TrainingPreferences = z.infer<typeof schemas.trainingPreferencesSchema>;
export type Plan = z.infer<typeof schemas.planSchema>;
export type PlanVersion = z.infer<typeof schemas.planVersionSchema>;
export type PlanDay = z.infer<typeof schemas.planDaySchema>;
export type PlannedExercise = z.infer<typeof schemas.plannedExerciseSchema>;
export type ExerciseSnapshot = z.infer<typeof schemas.exerciseSnapshotSchema>;
export type WorkoutSession = z.infer<typeof schemas.workoutSessionSchema>;
export type SetRecord = z.infer<typeof schemas.setRecordSchema>;
export type ScheduledWorkout = z.infer<typeof schemas.scheduledWorkoutSchema>;
export type BodyWeightObservation = z.infer<typeof schemas.bodyWeightObservationSchema>;
export type Metadata = z.infer<typeof schemas.metadataSchema>;
export type TrainingMemo = z.infer<typeof schemas.trainingMemoSchema>;
export type AiMemoryNote = z.infer<typeof schemas.aiMemoryNoteSchema>;
export type MediaAsset = z.infer<typeof schemas.mediaAssetSchema>;
export type TimerState = z.infer<typeof schemas.timerStateSchema>;
export type BackupEnvelope = z.infer<typeof schemas.backupEnvelopeSchema>;

export interface CatalogFilters { category?: Exercise['category']; equipment?: Exercise['equipment']; metricType?: MetricType }
type NumericInput = string | number;
export type MetricInput =
  | { metricType: 'reps_load'; reps: NumericInput; loadKg: NumericInput }
  | { metricType: 'reps'; reps: NumericInput }
  | { metricType: 'duration'; durationSeconds: NumericInput }
  | { metricType: 'duration_distance'; durationSeconds: NumericInput; distanceKm?: NumericInput };
export type ProfileInput = Pick<LocalProfile, 'locale' | 'timeZone' | 'units' | 'trainingPreferences'>;
export type BodyWeightInput = Pick<BodyWeightObservation, 'localDate' | 'timeZone' | 'weightGrams'> & { id?: string };
export interface PlanInput {
  status?: 'draft' | 'active';
  id?: string; name: string; source: Plan['source']; startDate: LocalDate; scheduleTimeZone: string;
  goalSnapshot: PlanVersion['goalSnapshot']; durationWeeks: number; daysPerWeek: number;
  days: PlanDay[]; generationMetadata?: PlanVersion['generationMetadata'];
}
export interface StartWorkoutInput {
  sessionId: string; localDate: LocalDate; timeZone: string;
  planVersionId?: string; plannedDayId?: string; scheduledWorkoutId?: string; exerciseIds?: string[];
}
export type SetInput = Pick<SetRecord, 'id' | 'exerciseInstanceId' | 'order' | 'metricType' | 'completed' | 'reps' | 'loadGrams' | 'durationSeconds' | 'distanceMeters' | 'notes'>;
export type Adjustment =
  | { type: 'add_exercise'; exerciseId: string; exerciseInstanceId: string }
  | { type: 'replace_exercise'; exerciseInstanceId: string; exerciseId: string; confirmClearMetrics: boolean }
  | { type: 'remove_exercise'; exerciseInstanceId: string; confirmDeleteRecords: boolean }
  | { type: 'add_set'; exerciseInstanceId: string; setId: string }
  | { type: 'remove_set'; setId: string; confirmDeleteRecords: boolean };
export type TimerEvent = { type: 'start' | 'pause' | 'resume' | 'stop' | 'reset' };
export interface TimerDisplay { elapsedMs: number; remainingMs?: number; finished: boolean; clockReversed: boolean }
export interface ProgressQuery { from: LocalDate; to: LocalDate; planVersionId?: string; timeZone: string }
export interface ProgressFacts extends ProgressQuery {
  nowMs: number;
  planTimeZones: Record<string, string>;
  sessions: WorkoutSession[];
  sets: SetRecord[];
  scheduledWorkouts: ScheduledWorkout[];
  bodyWeights: BodyWeightObservation[];
}
export interface ProgressMetrics {
  reps: number;
  loadGrams: number;
  volumeGrams: number;
  durationSeconds: number;
  distanceMeters: number | null;
  missingDistanceSets: number;
}
export interface ProgressReport {
  dueCount: number; completedCount: number; completionRate: number | null; history: WorkoutSession[];
  totals: ProgressMetrics;
  categoryTrends: (ProgressMetrics & { category: Exercise['category']; localDate: LocalDate })[];
  exerciseTrends: (ProgressMetrics & { exerciseId: string; name: Exercise['name']; metricType: MetricType; localDate: LocalDate })[];
  historySets: SetRecord[];
  historySchedules: ScheduledWorkout[];
  bodyWeights: BodyWeightObservation[];
}
export interface ValidatedBackup { envelope: BackupEnvelope; expectedRevision: number }
export interface ReplaceConfirmation { backupExported: boolean; replacementConfirmed: boolean; expectedRevision: number }
export interface ImportReport { importedSessions: number; importedPlans: number; rebuiltMemo: boolean }
