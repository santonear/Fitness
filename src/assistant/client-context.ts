import type { CoachRequest } from '../coach/contracts';
import type { FitnessDatabase } from '../persistence/db';
/** Only this active workout's recorded metrics; never notes, body data or other workouts. */
export async function currentWorkoutContext(request: CoachRequest | undefined, db: FitnessDatabase) {
  if (request?.task !== 'ADJUST_TODAY' || !request.workoutId) return undefined;
  const workout = await db.v8Workouts.get(request.workoutId);
  if (!workout || workout.status !== 'in_progress' || workout.planVersionId !== request.target.versionId)
    return undefined;
  const completedSets = workout.sets.map(set => ({
    exerciseId: set.exerciseId,
    itemIndex: set.itemIndex,
    setIndex: set.setIndex,
    ...(set.reps !== undefined ? { reps: set.reps } : {}),
    ...(set.loadGrams != null ? { loadGrams: set.loadGrams } : {}),
    ...(set.durationSeconds !== undefined ? { durationSeconds: set.durationSeconds } : {}),
    ...(set.distanceMeters !== undefined ? { distanceMeters: set.distanceMeters } : {}),
  }));
  return { completedSets, remainingSets: Math.max(0, workout.plannedSetCount - workout.sets.length) };
}
