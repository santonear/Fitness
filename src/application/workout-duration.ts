/** Shared elapsed-time validation for saved facts and finish previews. Whole seconds: review facts sent to 芽芽 must be integers. */
export function workoutSeconds(startedAt: string, endedAt?: string): number {
  const seconds = endedAt ? Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 1000) : NaN;
  return Number.isFinite(seconds) && seconds >= 0 && seconds <= 43200 ? seconds : 0;
}
/** Whole minutes, never more than the seconds shown beside them (0:40 is “under a minute”, 130:34 is 130). */
export const trainingMinutes = (seconds: number) => Math.floor(seconds / 60);

// The app left open between sets is not training (Bo 2026-10-27): a gap counts up to this much, plus the
// time the set that closes it was held or performed.
const IDLE_GAP_SECONDS = 10 * 60;
interface TimedWorkout {
  startedAt: string;
  endedAt?: string;
  timeCorrections?: readonly { startedAt: string; endedAt: string }[];
  sets: readonly { completedAt?: string; durationSeconds?: number }[];
}
/** Training seconds without long idle gaps; a time the person corrected by hand is taken as given. */
export function activeWorkoutSeconds(workout: TimedWorkout, endedAt = workout.endedAt): number {
  const corrected = workout.timeCorrections?.at(-1);
  if (corrected) return workoutSeconds(corrected.startedAt, corrected.endedAt);
  const total = workoutSeconds(workout.startedAt, endedAt);
  if (!total || !endedAt) return total;
  const marks = workout.sets
    .flatMap(set => (set.completedAt ? [{ at: Date.parse(set.completedAt), held: set.durationSeconds ?? 0 }] : []))
    .sort((a, b) => a.at - b.at);
  // Without set times (older records) there is nothing to tell idle time from training: keep the whole span.
  if (!marks.length) return total;
  let last = Date.parse(workout.startedAt),
    seconds = 0;
  for (const mark of [...marks, { at: Date.parse(endedAt), held: 0 }]) {
    seconds += Math.max(0, Math.min((mark.at - last) / 1000, IDLE_GAP_SECONDS + mark.held));
    last = Math.max(last, mark.at);
  }
  return Math.min(total, Math.round(seconds));
}
