/**
 * Pure timer logic for the V9 workout player (owner decision 2026-10-19).
 * - Timed exercises: a hold countdown the user starts with one tap; it can be paused and restarted.
 * - Rest between sets: a countdown that starts from the moment the set was saved; +15 s or skip.
 * Nothing here starts the next set. Times are wall-clock based so background throttling or a reload
 * never drifts the count.
 */

export interface HoldTimer {
  /** Target seconds for this set. */
  total: number;
  /** Epoch ms of the current running stretch; undefined while idle or paused. */
  startedAt?: number;
  /** Milliseconds counted before the current running stretch. */
  accumulatedMs: number;
}
export type HoldStatus = 'idle' | 'running' | 'paused' | 'done';

export const holdIdle = (total: number): HoldTimer => ({ total: Math.max(1, Math.round(total)), accumulatedMs: 0 });
export const holdElapsedMs = (timer: HoldTimer, now: number) => timer.accumulatedMs + (timer.startedAt === undefined ? 0 : Math.max(0, now - timer.startedAt));
export const holdRemaining = (timer: HoldTimer, now: number) => Math.max(0, Math.ceil((timer.total * 1000 - holdElapsedMs(timer, now)) / 1000));
export function holdStatus(timer: HoldTimer, now: number): HoldStatus {
  if (holdRemaining(timer, now) === 0) return 'done';
  if (timer.startedAt !== undefined) return 'running';
  return timer.accumulatedMs > 0 ? 'paused' : 'idle';
}
export function holdStart(timer: HoldTimer, now: number): HoldTimer {
  const status = holdStatus(timer, now);
  if (status === 'running') return timer;
  if (status === 'done') return { ...holdIdle(timer.total), startedAt: now };
  return { ...timer, startedAt: now };
}
export function holdPause(timer: HoldTimer, now: number): HoldTimer {
  if (timer.startedAt === undefined) return timer;
  return { total: timer.total, accumulatedMs: Math.min(timer.total * 1000, holdElapsedMs(timer, now)) };
}
/**
 * Seconds to save for this set. Untouched timer: the target the user confirms by tapping 完成这组.
 * Stopped early: what was actually held (at least 1 s), never more than the target.
 */
export function holdSecondsToRecord(timer: HoldTimer, now: number): number {
  const status = holdStatus(timer, now);
  if (status === 'idle' || status === 'done') return timer.total;
  return Math.min(timer.total, Math.max(1, Math.floor(holdElapsedMs(timer, now) / 1000)));
}

export const REST_STEP_SECONDS = 15;
export const DEFAULT_REST_SECONDS = 60;
export const MIN_REST_SECONDS = 15;
export const MAX_REST_SECONDS = 300;
/** After the countdown ends the rest screen keeps waiting for a tap, but not forever. */
export const REST_LINGER_SECONDS = 10 * 60;

/** Recommended rest: the prescription's value when present, otherwise 60 s, kept within 15 s – 5 min. */
export function recommendedRestSeconds(prescriptionRest?: number): number {
  const value = typeof prescriptionRest === 'number' && Number.isFinite(prescriptionRest) && prescriptionRest > 0 ? prescriptionRest : DEFAULT_REST_SECONDS;
  return Math.min(MAX_REST_SECONDS, Math.max(MIN_REST_SECONDS, Math.round(value)));
}
export interface RestPlan { completedAt: number; baseSeconds: number; extraSeconds: number }
export const restTotal = (plan: RestPlan) => plan.baseSeconds + plan.extraSeconds;
export const restRemaining = (plan: RestPlan, now: number) => Math.max(0, Math.ceil((plan.completedAt + restTotal(plan) * 1000 - now) / 1000));
export const restDone = (plan: RestPlan, now: number) => restRemaining(plan, now) === 0;
/** +15 s: extends from now when the countdown already ended, so the reminder fires again 15 s later. */
export function restExtend(plan: RestPlan, now: number): RestPlan {
  const elapsed = Math.max(0, Math.floor((now - plan.completedAt) / 1000));
  const total = Math.max(restTotal(plan), elapsed) + REST_STEP_SECONDS;
  return { ...plan, extraSeconds: Math.min(MAX_REST_SECONDS * 2, total - plan.baseSeconds) };
}
/** Show the rest screen only for a fresh set; an old set (e.g. reopened hours later) goes straight to the player. */
export function restVisible(plan: RestPlan | undefined, now: number, dismissed: boolean): boolean {
  if (!plan || dismissed || !Number.isFinite(plan.completedAt)) return false;
  return now - plan.completedAt < (restTotal(plan) + REST_LINGER_SECONDS) * 1000;
}
