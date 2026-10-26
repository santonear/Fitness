import { addDays, weekStart } from '../../domain/local-date';
import type { WorkoutRecord } from '../../domain/v8/contracts';

/** When 芽芽 offers the AI once by itself (Bo 2026-10-26): at most one a week, none for 30 days after 不用了. */
export type AiNudge = 'firstReview' | 'notFit';
export type NudgeState = {
  /** Monday of the week a nudge was shown, and which one. */
  week?: string;
  kind?: AiNudge;
  dismissedUntil?: string;
  /** 换一份 taps this week. */
  swaps?: { week: string; count: number };
  firstReviewShown?: boolean;
  notFitShown?: string;
};
const key = 'fitness-ai-nudge';
export function readNudges(): NudgeState {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '{}') as NudgeState;
  } catch {
    return {};
  }
}
export function writeNudges(state: NudgeState) {
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // Storage blocked: the nudge may show again, which is harmless.
  }
}
export const noteSwap = (state: NudgeState, today: string): NudgeState => {
  const week = weekStart(today);
  return { ...state, swaps: { week, count: state.swaps?.week === week ? state.swaps.count + 1 : 1 } };
};
export const dismissNudges = (state: NudgeState, today: string): NudgeState => ({
  ...state,
  dismissedUntil: addDays(today, 30),
});

const done = (workout: WorkoutRecord) => workout.status === 'complete' || workout.status === 'partial';
/** Both of the last two full weeks fell short of the weekly target, on a plan at least that old. */
export function missedTwoWeeks(workouts: WorkoutRecord[], weeklyTarget: number, planStart: string, today: string) {
  const monday = weekStart(today);
  if (weeklyTarget <= 0 || planStart > addDays(monday, -14)) return false;
  return [-14, -7].every(offset => {
    const from = addDays(monday, offset),
      to = addDays(from, 6);
    return workouts.filter(w => done(w) && w.localDate >= from && w.localDate <= to).length < weeklyTarget;
  });
}

export function pickNudge(
  facts: {
    route: 'review' | 'plan-home' | 'other';
    today: string;
    paused: boolean;
    workouts: WorkoutRecord[];
    weeklyTarget: number;
    planStart?: string;
  },
  state: NudgeState,
): AiNudge | undefined {
  const monday = weekStart(facts.today);
  if (facts.paused || (state.dismissedUntil && state.dismissedUntil > facts.today)) return undefined;
  // One a week: the week's nudge keeps its place on its own page; no second kind that week.
  if (state.week === monday)
    return facts.route === (state.kind === 'firstReview' ? 'review' : 'plan-home') ? state.kind : undefined;
  if (facts.route === 'review' && !state.firstReviewShown && facts.workouts.some(w => done(w) && w.localDate < monday))
    return 'firstReview';
  if (
    facts.route === 'plan-home' &&
    (!state.notFitShown || state.notFitShown <= addDays(facts.today, -28)) &&
    ((state.swaps?.week === monday && state.swaps.count >= 2) ||
      (!!facts.planStart && missedTwoWeeks(facts.workouts, facts.weeklyTarget, facts.planStart, facts.today)))
  )
    return 'notFit';
  return undefined;
}
export function markNudge(state: NudgeState, kind: AiNudge, today: string): NudgeState {
  return {
    ...state,
    week: weekStart(today),
    kind,
    ...(kind === 'firstReview' ? { firstReviewShown: true } : { notFitShown: today }),
  };
}
export const NUDGES_CHANGED = 'fitness-ai-nudge-changed';
/** 今天 › 换一份: counted toward “this plan does not fit”. */
export function recordSwap(today: string) {
  writeNudges(noteSwap(readNudges(), today));
  window.dispatchEvent(new Event(NUDGES_CHANGED));
}
