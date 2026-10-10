import { DomainError } from '../../domain/errors';

/** Normalized targets shared by base plans and legacy migration; not recorded workout facts. */
export type DurationTarget = { reps: number } | { durationSeconds: number } | { distanceMeters: number };

export function estimateTrainingMinutes(exercises: readonly { sets: readonly DurationTarget[] }[]): number {
  if (!exercises.length || exercises.some(exercise => !exercise.sets.length)) {
    throw new DomainError('INVALID', 'Duration estimation requires exercises and sets');
  }
  let seconds = 300 + (exercises.length - 1) * 60;
  for (const exercise of exercises) {
    seconds += (exercise.sets.length - 1) * 90;
    for (const target of exercise.sets) {
      const value = 'reps' in target ? target.reps : 'durationSeconds' in target ? target.durationSeconds : target.distanceMeters;
      if (!Number.isFinite(value) || value <= 0) throw new DomainError('INVALID', 'Duration estimation requires positive targets');
      seconds += 'reps' in target ? Math.max(20, value * 3) : 'durationSeconds' in target ? value : value / 1.5;
    }
  }
  return Math.max(15, Math.min(120, Math.ceil(seconds / 300) * 5));
}
