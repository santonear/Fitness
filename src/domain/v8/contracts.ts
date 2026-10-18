import type { SetMetrics } from '../models';
import type { EngineProfile, EnginePrescription, EnginePlan,Pattern } from '../../engine/contracts';
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
export interface PlannedItem { exerciseId: string; equipment: string; sets: number; target: SetMetrics; prescription?: EnginePrescription }
export interface SessionTemplate { weekday?:'mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun'; id: string; name: string; estimatedMinutes: number; items: PlannedItem[]; estimatedSeconds?:number; durationScope?:'untargeted'; targetMinutes?:number }
export interface PlanVersion {
  enginePlan?: EnginePlan;
  id: string; planId: string; versionNumber: number; goalText: string; weeklyTarget: number;
  preferredDays?: ('mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun')[];
  scheduleOriginalText: string; sessionMinutes: number; templates: SessionTemplate[];
  /** Keeps the contaminated chat text when a migration restores the original answer. */
  scheduleRecovery?: { raw: string; recoveredAt: string };
  createdAt: string; origin: 'onboard' | 'coach_change' | 'review_suggestion' | 'manual' | 'migrated';
  reviewRule?: 'time'|'progression'|'frequency'|'restart'|'discomfort';
  changeSummary: string[]; basedOnVersionId?: string;
  /** Explicit creation source; absent on older versions means unknown. */
  source?: 'local' | 'ai';
}
export interface SetFact { exerciseId: string; itemIndex: number; setIndex: number; reps?: number; durationSeconds?: number; distanceMeters?: number; loadGrams?: number | null; completedAt: string; substitutedFrom?: string }
export interface OlderSafetyState {fallAt:string;reviewRequiredAt?:string;injuryConfirmed?:true;balanceStage?:1|2|3;professionalSeenAt?:string}
export interface PostpartumSafetyState {lastSymptomAt?:string;urgentAt?:string;regression?:{requiredAt:string;phase:1|2|3;symptomFreeDates:string[]};professionalSeenAt?:string}
export interface WorkoutRecord {
  postpartumSymptoms?:{recordedAt:string;urgent:string[];regression:string[]}[];
  painActions?:PainAction[];
  painReviewRequired?:boolean;
  checkin?:{energyMotivation?:number;poorSleepNights?:number;sorenessResolved?:boolean;newOrWorseJointPain?:boolean};
  setFeedbackEvents?: SetFeedbackEvent[];
  id: string; planVersionId?: string; templateId?: string; startedAt: string; endedAt?: string;
  localDate: string; timeZone: string; status: 'in_progress' | 'complete' | 'partial' | 'not_started' | 'abandoned';
  variant?: 'short'; sets: SetFact[]; plannedSetCount: number; feedback?: Feedback;
  plannedExercises?: PlannedExerciseFact[]; substitutions?: ExerciseSubstitution[];
  /** Immutable targets of this workout; today-only adjustments never change the plan. */
  templateSnapshot?: SessionTemplate;
  /** Append only after completion; all other completed facts remain immutable. */
  appendedNotes?: AppendedNote[];
}
export interface PainAction {eventId:string;appliedAt:string;kind:'substitute'|'exclude'|'review';pattern:Pattern;itemIndex:number;replacement?:PlannedItem;excludedItemIndexes?:number[];redFlagAnswers?:Record<string,boolean>}
export interface SetFeedbackEvent {
  id:string; itemIndex:number; setIndex:number; exerciseId:string; createdAt:string;
  effort:'too_light'|'right'|'too_hard'|'discomfort'; rir?:number; painScore?:number; painArea?:EngineProfile['cautions'][number];
}
/** Read projection only. Old sets have update times, not exact completion times. */
export interface LegacyWorkoutProjection extends Omit<WorkoutRecord, 'sets'> {
  source: 'legacy';
  sets: (Omit<SetFact, 'completedAt'> & { completedAt?: never; legacyUpdatedAt: string })[];
}
export interface ActivityRecord { id: string; type: 'walk' | 'run' | 'cycle' | 'swim' | 'yoga' | 'stairs' | 'other'; customName?: string; minutes: number; localDate: string; timeZone: string; feel?: Feel; note?: string; createdAt: string }
export interface ReminderSetting { enabled: boolean; weekdays: number[]; time: string }
export interface CoachProfile {
  householdSupport?:boolean;
  goal?:EngineProfile['goal']; level?:EngineProfile['level']; constraints?:EngineProfile['constraints'];
  population?:EngineProfile['population']; screening?:EngineProfile['screening']; preferences?:EngineProfile['preferences'];
  birthYearMonth?:string; equipmentLoadsKg?:EngineProfile['equipmentLoadsKg']; painState?:EngineProfile['painState'];
  availableLoadsKg?:EngineProfile['availableLoadsKg'];
  powerOneRm?:EngineProfile['powerOneRm'];
  healthStorageConsent?:{acceptedAt:string};
  goalText: string; weeklyTarget: number; sessionMinutes: number; scheduleOriginalText: string;
  preferredDays?: ('mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun')[];
  place: 'home' | 'gym' | 'outdoor' | 'mixed'; equipment: string[]; adultConfirmed: boolean;
  placeEquipmentOriginalText?: string;
  cautions: ('knee' | 'back' | 'shoulder' | 'wrist' | 'other')[]; cautionNote?: string; confirmedAt: string;
}
export interface VersionTarget { planId: string; versionId: string; revision: number }
