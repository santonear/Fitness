// 新手 4 周 (Bo 2026-10-25): a fixed week table over the existing engine rules, for by-day plans only.
// The plan version stores only { id, startDate }; the week is computed here and never written back.
import {
  FITNESS_TEST_ITEMS,
  STARTER_PROGRAM_WEEKS,
  type FitnessTestItem,
  type FitnessTestRecord,
  type StarterProgram,
} from '../domain/plan-upgrade';
import type { PlanVersion, SessionTemplate } from '../domain/v8/contracts';
import { addDays, daysBetween } from '../domain/local-date';
import { DATA } from '../engine/data';

interface WorkoutLike {
  localDate: string;
  status: string;
}
const counted = (w: WorkoutLike) => w.status === 'complete' || w.status === 'partial';

export interface StarterProgress {
  /** Program week 1–4; 5 once week 4 has been trained. */
  week: number;
  finished: boolean;
  /** The last full 7-day period had no workout: the same week's content continues, nothing is made up. */
  missedLastWeek: boolean;
  /** Workouts in the last full 7-day period (shown in the week 2 line). */
  lastWeekSessions: number;
  /** Workouts since the program started. */
  sessions: number;
}

/** A program week moves on only after a 7-day period with at least one workout; an empty period repeats it. */
export function starterProgress(
  program: StarterProgram,
  workouts: readonly WorkoutLike[],
  today: string,
): StarterProgress {
  const dates = workouts
    .filter(counted)
    .map(w => w.localDate)
    .filter(date => date >= program.startDate && date <= today);
  const periods = Math.max(0, Math.floor(daysBetween(program.startDate, today) / 7));
  let week = 1,
    last = 0;
  for (let index = 0; index < periods && week <= STARTER_PROGRAM_WEEKS; index++) {
    const from = addDays(program.startDate, index * 7),
      to = addDays(from, 7);
    last = dates.filter(date => date >= from && date < to).length;
    if (last > 0) week++;
  }
  const finished = week > STARTER_PROGRAM_WEEKS;
  return {
    week,
    finished,
    missedLastWeek: !finished && periods > 0 && last === 0,
    lastWeekSessions: last,
    sessions: dates.length,
  };
}

/** Offered on by-day plans only (never with a weekly budget), and only while no program runs. */
export const starterAvailable = (version: Pick<PlanVersion, 'weeklyBudget' | 'starterProgram'> | undefined) =>
  !!version && version.weeklyBudget?.mode !== 'budget' && !version.starterProgram;

type Cap = number | readonly number[];
const highest = (value: Cap) => (typeof value === 'number' ? value : Math.max(...value));
/** progression.new.week_caps: sets per exercise for the engine's own new-user week (7-day periods from the first workout). */
function newUserSetCap(firstWorkoutDate: string | undefined, today: string): number {
  const caps = DATA.rules.find(row => row.id === 'progression.new.week_caps')!.value as {
    week_1: { sets_per_exercise: Cap };
    week_2: { sets_per_exercise: Cap };
    week_3_4: { sets_per_exercise: Cap };
  };
  const week = firstWorkoutDate ? Math.floor(daysBetween(firstWorkoutDate, today) / 7) + 1 : 1;
  return highest(
    week <= 1
      ? caps.week_1.sets_per_exercise
      : week === 2
        ? caps.week_2.sets_per_exercise
        : caps.week_3_4.sets_per_exercise,
  );
}

const strengthItem = (item: SessionTemplate['items'][number]) =>
  item.prescription
    ? item.prescription.block === 'main' || item.prescription.block === 'accessory'
    : item.target.metricType === 'reps' || item.target.metricType === 'reps_load';

/**
 * The week table: weeks 1–2 keep the new-user caps, week 3 adds one set per strength move, week 4 takes one off.
 * Sets never go past the new-user cap for the engine's own week. Effort (RIR) stays as the plan prescribes.
 * shortcut: estimatedMinutes is not recomputed for the changed sets; recompute once the duration fit is reusable here.
 */
export function starterTemplate<T extends SessionTemplate>(
  template: T,
  progress: Pick<StarterProgress, 'week' | 'finished'>,
  workouts: readonly WorkoutLike[],
  today: string,
): T {
  if (progress.finished) return template;
  const first = workouts
    .filter(counted)
    .map(w => w.localDate)
    .sort()[0];
  const cap = newUserSetCap(first, today);
  let changed = false;
  const items = template.items.map(item => {
    if (!strengthItem(item)) return item;
    const base = Math.min(item.sets, cap);
    const sets =
      progress.week === 3 ? Math.min(item.sets + 1, cap) : progress.week === 4 ? Math.max(1, base - 1) : base;
    if (sets === item.sets) return item;
    changed = true;
    return { ...item, sets };
  });
  return changed ? { ...template, items } : template;
}

/**
 * The finish line's test comparison: the last test on or before the start (else the first one during the
 * program) against the latest later test. An improved item is preferred; without two tests there is nothing to say.
 */
export function starterComparison(
  tests: readonly Pick<FitnessTestRecord, 'localDate' | 'createdAt' | 'results'>[],
  startDate: string,
): { item: FitnessTestItem; from: number; to: number } | undefined {
  const sorted = [...tests].sort(
    (a, b) => a.localDate.localeCompare(b.localDate) || a.createdAt.localeCompare(b.createdAt),
  );
  const before = sorted.filter(test => test.localDate <= startDate).at(-1);
  const baseline = before ?? sorted.find(test => test.localDate > startDate);
  const latest = sorted.at(-1);
  if (!baseline || !latest || latest === baseline) return undefined;
  const pairs = FITNESS_TEST_ITEMS.flatMap(item => {
    const from = baseline.results[item],
      to = latest.results[item];
    return from === undefined || to === undefined ? [] : [{ item, from, to }];
  });
  return pairs.find(pair => pair.to > pair.from) ?? pairs[0];
}
