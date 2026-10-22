import type { Repository } from '../persistence/repository';
import { DomainError } from '../domain/errors';
import { setFeedbackEventSchema, v8WorkoutSchema } from '../domain/schemas';
import type { SetFeedbackEvent } from '../domain/v8/contracts';
/** Append-only feedback; no completed set, target, timestamp or workout status is edited. */
export function createTrainingFeedback(repo: Repository) {
  async function append(workoutId: string, event: SetFeedbackEvent, expectedRevision?: number) {
    const parsed = setFeedbackEventSchema.parse(event);
    return repo.write(async () => {
      if (
        parsed.effort === 'discomfort' &&
        !(await repo.db.v8State.get('v8'))?.coachProfile?.healthStorageConsent?.acceptedAt
      )
        throw new DomainError('INVALID', 'HEALTH_STORAGE_CONSENT_REQUIRED');
      const record = await repo.db.v8Workouts.get(workoutId);
      if (!record) throw new DomainError('INVALID', 'WORKOUT_NOT_FOUND');
      const fact = record.sets.find(
        set =>
          set.itemIndex === parsed.itemIndex &&
          set.setIndex === parsed.setIndex &&
          set.exerciseId === parsed.exerciseId,
      );
      if (!fact) throw new DomainError('INVALID', 'SET_NOT_COMPLETED');
      const previous = record.setFeedbackEvents?.find(item => item.id === parsed.id);
      if (previous) {
        if (JSON.stringify(previous) !== JSON.stringify(parsed))
          throw new DomainError('CONFLICT', 'FEEDBACK_ID_REUSED');
        return record;
      }
      const next = v8WorkoutSchema.parse({
        ...record,
        setFeedbackEvents: [...(record.setFeedbackEvents ?? []), parsed],
      });
      await repo.db.v8Workouts.put(next);
      return next;
    }, expectedRevision);
  }
  return { append };
}
