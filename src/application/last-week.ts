import { addDays, weekStart } from '../domain/local-date';
import type { ReviewFacts } from './review/contracts';
import { weeklyRemaining } from './review/charts';

/**
 * 上周一张图 (今天): last week's sessions against the weekly target, plus one recorded improvement.
 * Read-only; partial sessions count as done, the same as the review page.
 */
export interface LastWeekSummary {
  /** Monday of this week: the card is closed per week. */
  week: string;
  done: number;
  target: number;
  improvement?: { exerciseId: string; metric: 'loadGrams' | 'reps' | 'durationSeconds'; gain: number };
}

export function lastWeekSummary(input: {
  today: string;
  /** Facts of the week before this one. */
  facts: Pick<ReviewFacts, 'from' | 'to' | 'complete' | 'partial' | 'improvements'> | undefined;
  weeklyTarget: number;
  /** Earliest start date of the current plan (any version). */
  planFirstStart: string | undefined;
  /** Start date of the current version. */
  currentStart: string | undefined;
  /** At least one finished workout or activity was ever recorded. */
  hasRecord: boolean;
  active: boolean;
}): LastWeekSummary | undefined {
  const { today, facts } = input,
    week = weekStart(today);
  if (input.active || !input.hasRecord || !facts || facts.to !== addDays(week, -1)) return undefined;
  if (!input.planFirstStart || input.planFirstStart > facts.to) return undefined;
  if (input.currentStart && input.currentStart > today) return undefined;
  const best =
    facts.improvements.find(row => row.metric === 'loadGrams' && row.current > row.previous) ??
    facts.improvements.find(row => row.current > row.previous);
  return {
    week,
    done: weeklyRemaining(input.weeklyTarget, facts.complete, facts.partial).done,
    target: Math.max(0, Math.round(input.weeklyTarget)),
    ...(best
      ? { improvement: { exerciseId: best.exerciseId, metric: best.metric, gain: best.current - best.previous } }
      : {}),
  };
}
