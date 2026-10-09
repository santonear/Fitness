import type { WorkoutRecord } from '../../domain/v8/contracts';
import type { IncompleteTiming, ReviewDayType, ReviewTimeBand } from './contracts';

/** The caller selects the review period; every instant uses its own saved timezone. */
export function computeIncompleteTiming(workouts: readonly WorkoutRecord[]): IncompleteTiming {
  const counts = () => ({ partial: 0, notStarted: 0 });
  const bands = () => ({ morning: counts(), daytime: counts(), evening: counts() });
  const result = { weekday: bands(), weekend: bands() };
  for (const workout of workouts) {
    if (workout.status !== 'partial' && workout.status !== 'not_started') continue;
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: workout.timeZone, weekday: 'short', hour: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(workout.startedAt));
    const weekday = parts.find(part => part.type === 'weekday')!.value;
    const hour = Number(parts.find(part => part.type === 'hour')!.value);
    const day: ReviewDayType = weekday === 'Sat' || weekday === 'Sun' ? 'weekend' : 'weekday';
    const band: ReviewTimeBand = hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 17 ? 'daytime' : 'evening';
    result[day][band][workout.status === 'partial' ? 'partial' : 'notStarted']++;
  }
  return result;
}

/** Per-workout evidence only: no streak, recommendation or legacy-field inference. */
export function computeExerciseEvidence(workout: WorkoutRecord): {
  easyCompletedExerciseIds: string[]; discomfortExerciseIds: string[];
} {
  if (workout.status === 'in_progress' || workout.status === 'abandoned') {
    return { easyCompletedExerciseIds: [], discomfortExerciseIds: [] };
  }
  const discomfort = new Set<string>();
  const performed = new Set(workout.sets.map(set => set.exerciseId));
  if (workout.feedback?.reasons.includes('discomfort')) {
    for (const id of workout.feedback.discomfortExerciseIds ?? []) {
      if (performed.has(id)) discomfort.add(id);
    }
  }
  for (const substitution of workout.substitutions ?? []) {
    if (substitution.reason === 'discomfort') discomfort.add(substitution.fromExerciseId);
  }

  const easyCompletedExerciseIds: string[] = [];
  const feel = workout.feedback?.feel;
  if ((workout.status === 'complete' || workout.status === 'partial') && (feel === 'easy' || feel === 'right')) {
    const planned = workout.plannedExercises ?? [];
    for (const id of new Set(planned.map(item => item.exerciseId))) {
      const items = planned.filter(item => item.exerciseId === id);
      const allComplete = items.every(item => {
        if (item.plannedSetCount <= 0) return false;
        const completed = new Set(workout.sets.filter(set => set.exerciseId === id && set.itemIndex === item.itemIndex)
          .map(set => set.setIndex));
        for (let index = 0; index < item.plannedSetCount; index++) {
          if (!completed.has(index)) return false;
        }
        return true;
      });
      if (allComplete) easyCompletedExerciseIds.push(id);
    }
  }
  return { easyCompletedExerciseIds, discomfortExerciseIds: [...discomfort] };
}
