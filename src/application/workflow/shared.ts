// Helpers shared by the training workflow modules (see ../v8-workflow.ts).
import type { StarterProgram, WeeklyBudget } from '../../domain/plan-upgrade';
import { DomainError } from '../../domain/errors';
import type { CoachProfile, SessionTemplate } from '../../domain/v8/contracts';
import type { CoachResponse } from '../../coach/contracts';
import type { EnginePlan } from '../../engine/contracts';

export type LocalCandidate = Extract<CoachResponse, { type: 'plan_proposal' }> & {
  expectedRevision: number;
  profile: CoachProfile;
  source?: 'local' | 'ai';
  enginePlan?: EnginePlan;
  /** Chosen on the draft; local date YYYY-MM-DD. Absent means today. */
  startDate?: string;
  /** Training days picked on the calendar (sorted local dates); absent means the weekly rhythm. */
  trainingDates?: string[];
  /** Planned start time of day, HH:MM. */
  startTime?: string;
};
/** Calendar days and time carried unchanged into every later version of the same plan. */
// The optional weekly budget (V9.14) and 新手 4 周 follow the plan into every new version, like the picked days.
export const carriedBudget = (version: { weeklyBudget?: WeeklyBudget; starterProgram?: StarterProgram }) => ({
  ...(version.weeklyBudget ? { weeklyBudget: { ...version.weeklyBudget } } : {}),
  ...(version.starterProgram ? { starterProgram: { ...version.starterProgram } } : {}),
});
export const carriedSchedule = (version: { startDate?: string; trainingDates?: string[]; startTime?: string }) => ({
  ...(version.startDate ? { startDate: version.startDate } : {}),
  ...(version.trainingDates?.length ? { trainingDates: [...version.trainingDates] } : {}),
  ...(version.startTime ? { startTime: version.startTime } : {}),
});
export type ManualSelection = {
  adultConfirmed: boolean;
  template: SessionTemplate;
  expectedRevision: number;
  restoreGeneration: number;
};
export const invalid = (message: string): never => {
  throw new DomainError('INVALID', message);
};
/** Days after today a plan may start (V9 start-date picker). */
export const START_DATE_WINDOW_DAYS = 14;
export { todayIn as localDate } from '../../domain/local-date';
