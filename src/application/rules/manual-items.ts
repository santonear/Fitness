import { exercises } from '../../catalog/exercises';
import { DomainError } from '../../domain/errors';
import type { DurationTarget } from '../../domain/duration-estimate';

/** Defaults for a free session, not recorded facts or an inferred load prescription. */
export function manualTrainingItems(
  ids: readonly string[],
): { exerciseId: string; sets: number; target: DurationTarget }[] {
  const unique = [...new Set(ids)];
  if (!unique.length) throw new DomainError('INVALID', 'SELECT_EXERCISE');
  return unique.map(exerciseId => {
    const exercise = exercises.find(e => e.id === exerciseId);
    if (!exercise) throw new DomainError('INVALID', 'SELECT_EXERCISE');
    return {
      exerciseId,
      sets: 2,
      target:
        exercise.metricType === 'reps' || exercise.metricType === 'reps_load' ? { reps: 8 } : { durationSeconds: 20 },
    };
  });
}
