import { exercises } from '../../catalog/exercises';
import type { PlannedExercise, SetMetrics } from '../models';
import { plannedExerciseSchema } from '../schemas';
import { DomainError } from '../errors';
import type { PlannedItem } from './contracts';

function sameTarget(left: SetMetrics, right: SetMetrics): boolean {
  if (left.metricType !== right.metricType) return false;
  switch (left.metricType) {
    case 'reps': return right.metricType === 'reps' && left.reps === right.reps;
    case 'reps_load': return right.metricType === 'reps_load' && left.reps === right.reps && left.loadGrams === right.loadGrams;
    case 'duration': return right.metricType === 'duration' && left.durationSeconds === right.durationSeconds;
    case 'duration_distance': return right.metricType === 'duration_distance' && left.durationSeconds === right.durationSeconds && left.distanceMeters === right.distanceMeters;
  }
}

/** Project targets only. The caller retains the original legacy version, notes and timings unchanged. */
export function legacyItemsToV8(items: readonly PlannedExercise[]): PlannedItem[] {
  const result: PlannedItem[] = [];
  for (const input of items) {
    const item = plannedExerciseSchema.parse(input);
    const exercise = exercises.find(row => row.id === item.exerciseId);
    if (!exercise || item.targetSets.some(target => target.metricType !== exercise.metricType)) {
      throw new DomainError('INVALID', 'Legacy exercise metrics do not match the catalog');
    }
    // Do not coalesce across distinct exercise entries, even when their IDs match.
    let previous: PlannedItem | undefined;
    for (const target of item.targetSets) {
      if (previous && sameTarget(previous.target, target)) previous.sets++;
      else {
        previous = { exerciseId: item.exerciseId, equipment: exercise.equipment, sets: 1, target: { ...target } };
        result.push(previous);
      }
    }
  }
  return result;
}
