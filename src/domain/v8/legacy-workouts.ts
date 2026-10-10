import type { SetRecord, WorkoutSession } from '../models';
import type { LegacyWorkoutProjection } from './contracts';

/** Never persists derived facts or changes the original plan-version reference. */
export function projectLegacyWorkouts(sessions: readonly WorkoutSession[], records: readonly SetRecord[]): LegacyWorkoutProjection[] {
  return sessions.map(session => {
    const snapshots = session.exerciseSnapshots;
    const actual = records.filter(set => set.sessionId === session.id && set.completed);
    const plannedExercises = snapshots.map((item, itemIndex) => ({ exerciseId: item.exerciseId, itemIndex, plannedSetCount: item.targetSets.length }));
    const plannedSetCount = plannedExercises.reduce((sum, item) => sum + item.plannedSetCount, 0);
    const sets = actual.flatMap(set => {
      const itemIndex = snapshots.findIndex(item => item.exerciseInstanceId === set.exerciseInstanceId);
      if (itemIndex < 0) return []; // Orphan facts remain in the original table; never guess their exercise.
      return [{ exerciseId: snapshots[itemIndex].exerciseId, itemIndex, setIndex: set.order,
        ...(set.reps !== undefined ? { reps: set.reps } : {}), ...(set.loadGrams !== undefined ? { loadGrams: set.loadGrams } : {}),
        ...(set.durationSeconds !== undefined ? { durationSeconds: set.durationSeconds } : {}),
        ...(set.distanceMeters !== undefined ? { distanceMeters: set.distanceMeters } : {}), legacyUpdatedAt: set.updatedAt }];
    });
    const allDone = plannedSetCount > 0 && snapshots.every(item => item.targetSets.every((_, index) => actual.some(set => set.exerciseInstanceId === item.exerciseInstanceId && set.order === index)));
    const status = session.status === 'in_progress' ? 'in_progress' : session.status === 'abandoned' ? 'abandoned'
      : actual.length === 0 ? 'not_started' : allDone ? 'complete' : 'partial';
    return { id: session.id, source: 'legacy', ...(session.planVersionId ? { planVersionId: session.planVersionId } : {}),
      startedAt: session.startedAt, ...(session.completedAt ? { endedAt: session.completedAt } : {}), localDate: session.localDate,
      timeZone: session.timeZone, status, plannedSetCount, plannedExercises, sets };
  });
}
