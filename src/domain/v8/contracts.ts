import type { SetMetrics } from '../models';
/** Wave 0: declarations only; no database registration or business implementation. */
export type OnboardingMinutes = 30 | 40 | 50 | 60 | 70 | 80 | 90 | 100 | 110 | 120;
export type Answer<T> = { status: 'answered'; value: T } | { status: 'skipped' };
export interface ScheduleMapping { originalText: string; minutes: Answer<OnboardingMinutes>; startTime: { status: 'skipped' } }
export type MapSchedule = (originalText: string) => ScheduleMapping;
export type ReservedDexieVersion = 8;
export type Feel = 'easy' | 'right' | 'tired' | 'very_tired';
export type ShortfallReason = 'time' | 'fatigue' | 'discomfort' | 'equipment_busy' | 'not_today' | 'other';
export interface Feedback { feel?: Feel; reasons: ShortfallReason[]; note?: string; discomfortExerciseIds?: string[] }
export interface AppendedNote { text: string; createdAt: string }
/** Snapshot before training; absent on legacy records means unknown, never infer completion. */
export interface PlannedExerciseFact { exerciseId: string; itemIndex: number; plannedSetCount: number }
/** Record at substitution time, even if no replacement set is completed. */
export interface ExerciseSubstitution { fromExerciseId: string; toExerciseId: string; itemIndex: number; reason: 'discomfort' | 'other'; createdAt: string }
export interface PlannedItem { exerciseId: string; equipment: string; sets: number; target: SetMetrics }
export interface SessionTemplate { id: string; name: string; estimatedMinutes: number; items: PlannedItem[] }
export interface PlanVersion {
  id: string; planId: string; versionNumber: number; goalText: string; weeklyTarget: number;
  scheduleOriginalText: string; sessionMinutes: number; templates: SessionTemplate[];
  createdAt: string; origin: 'onboard' | 'coach_change' | 'review_suggestion' | 'manual' | 'migrated';
  changeSummary: string[]; basedOnVersionId?: string;
}
export interface SetFact { exerciseId: string; itemIndex: number; setIndex: number; reps?: number; durationSeconds?: number; distanceMeters?: number; loadGrams?: number | null; completedAt: string; substitutedFrom?: string }
export interface WorkoutRecord {
  id: string; planVersionId: string; templateId?: string; startedAt: string; endedAt?: string;
  localDate: string; timeZone: string; status: 'in_progress' | 'complete' | 'partial' | 'not_started' | 'abandoned';
  variant?: 'short'; sets: SetFact[]; plannedSetCount: number; feedback?: Feedback;
  plannedExercises?: PlannedExerciseFact[]; substitutions?: ExerciseSubstitution[];
  /** Append only after completion; all other completed facts remain immutable. */
  appendedNotes?: AppendedNote[];
}
export interface ActivityRecord { id: string; type: 'walk' | 'run' | 'cycle' | 'swim' | 'yoga' | 'stairs' | 'other'; customName?: string; minutes: number; localDate: string; timeZone: string; feel?: Feel; note?: string; createdAt: string }
export interface ReminderSetting { enabled: boolean; weekdays: number[]; time: string }
export interface CoachProfile {
  goalText: string; weeklyTarget: number; sessionMinutes: number; scheduleOriginalText: string;
  place: 'home' | 'gym' | 'outdoor' | 'mixed'; equipment: string[]; adultConfirmed: boolean;
  cautions: ('knee' | 'back' | 'shoulder' | 'wrist' | 'other')[]; cautionNote?: string; confirmedAt: string;
}
export interface VersionTarget { planId: string; versionId: string; revision: number }
