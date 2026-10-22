import type {
  ActivityRecord,
  CoachProfile,
  PlanVersion,
  SessionTemplate,
  WorkoutRecord,
  ShortfallReason,
  LegacyWorkoutProjection,
} from '../../domain/v8/contracts';
export interface ReviewInput {
  from: string;
  to: string;
  timeZone: string;
  weeklyTarget: number;
  workouts: readonly WorkoutRecord[];
  activities: readonly ActivityRecord[];
  legacyWorkouts?: readonly LegacyWorkoutProjection[];
  bodyWeights: readonly { localDate: string; weightGrams: number }[];
}
export type ReviewDayType = 'weekday' | 'weekend';
export type ReviewTimeBand = 'morning' | 'daytime' | 'evening' | 'overnight';
/** User timezone: 00–04 overnight, 05–11 morning, 12–16 daytime, 17–23 evening. */
export type IncompleteTiming = Readonly<
  Record<
    ReviewDayType,
    Readonly<
      Record<Exclude<ReviewTimeBand, 'overnight'>, Readonly<{ partial: number; notStarted: number }>> & {
        overnight?: Readonly<{ partial: number; notStarted: number }>;
      }
    >
  >
>;
export interface ReviewFacts {
  from: string;
  to: string;
  complete: number;
  partial: number;
  notStarted: number;
  movementCount: number;
  missingCount: number;
  activityMinutes: number;
  trainingSeconds: number;
  activityCounts: Readonly<Record<ActivityRecord['type'], number>>;
  reasonCounts: Readonly<Record<ShortfallReason, number>>;
  hasBodyWeight: boolean;
  incompleteTiming: IncompleteTiming;
  improvements: readonly {
    exerciseId: string;
    metric: 'loadGrams' | 'reps' | 'durationSeconds';
    previous: number;
    current: number;
  }[];
}
export interface WeekFacts extends ReviewFacts {
  previousMovementCount: number;
}
export interface MonthFacts extends ReviewFacts {
  weeks: readonly { from: string; complete: number; partial: number }[];
}
export interface PlanProposal {
  goalText: string;
  weeklyTarget: number;
  scheduleOriginalText: string;
  sessionMinutes: number;
  templates: SessionTemplate[];
  reasons: [string, string, string];
}
export interface ReviewSuggestion {
  id: string;
  rule: 'time' | 'discomfort' | 'progression' | 'frequency' | 'restart';
  summary: string;
  basedOnVersionId: string;
  proposal: PlanProposal;
}
export interface SuggestionInput {
  timeZone?: string;
  current: WeekFacts;
  previous: WeekFacts;
  workouts: readonly WorkoutRecord[];
  plan: PlanVersion;
  dismissedIds: readonly string[];
  profile?: CoachProfile;
  todayLocalDate?: string;
  completedWeeks?: readonly [WeekFacts, WeekFacts];
}
export type ComputeWeekFacts = (input: ReviewInput) => WeekFacts;
export type ComputeMonthFacts = (input: ReviewInput) => MonthFacts;
export type SuggestChange = (input: SuggestionInput) => ReviewSuggestion | null;
export type BuildBasePlan = (
  profile: CoachProfile,
) =>
  | { kind: 'base'; proposal: PlanProposal }
  | { kind: 'unavailable'; reason: 'adult_confirmation_required' | 'insufficient_information' };
