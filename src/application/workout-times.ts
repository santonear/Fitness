import { DomainError } from '../domain/errors';
import { v8WorkoutSchema } from '../domain/schemas';
import type { Repository } from '../persistence/repository';

/** Longest session a correction may describe; anything longer is almost certainly a typo. */
export const MAX_CORRECTED_MS = 12 * 3600000;

/**
 * Appends a user correction of a finished workout's start/end time. The recorded startedAt/endedAt,
 * sets and every other completed fact stay unchanged; display uses the latest correction.
 */
export function createWorkoutTimes(repo: Repository) {
  async function correct({ workoutId, startedAt, endedAt, expectedRevision, now = new Date() }: { workoutId: string; startedAt: string; endedAt: string; expectedRevision: number; now?: Date }) {
    const start = Date.parse(startedAt), end = Date.parse(endedAt);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > MAX_CORRECTED_MS || end > now.getTime())
      throw new DomainError('INVALID', 'INVALID_WORKOUT_TIMES');
    return repo.write(async () => {
      const workout = await repo.db.v8Workouts.get(workoutId);
      if (!workout || workout.status === 'in_progress' || workout.status === 'abandoned')
        throw new DomainError('INVALID', 'Correct times only after training ends');
      const next = v8WorkoutSchema.parse({
        ...workout,
        timeCorrections: [...(workout.timeCorrections ?? []), { startedAt: new Date(start).toISOString(), endedAt: new Date(end).toISOString(), createdAt: now.toISOString() }],
      });
      await repo.db.v8Workouts.put(next);
      return next;
    }, expectedRevision);
  }
  return { correct };
}
