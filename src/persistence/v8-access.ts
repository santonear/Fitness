import { DomainError } from '../domain/errors';
import { legacyTrainingSeconds } from '../domain/v8/legacy-selection';
import type { Repository } from './repository';
import { v8WorkoutSchema } from '../domain/schemas';

export async function assertLegacyPlanEditable(repo: Repository, planId: string): Promise<void> {
  if ((await repo.db.v8State.get('v8'))?.legacyPlanIds.includes(planId)) throw new DomainError('SESSION_READ_ONLY', 'Retained legacy plans are read-only');
}

export function createV8DataService(repo: Repository) {
  async function getMigrationNotice() {
    const state = await repo.db.v8State.get('v8');
    return state && !state.notice.acknowledged ? state.notice : undefined;
  }
  async function acknowledgeMigrationNotice() {
    await repo.write(async () => {
      const state = await repo.db.v8State.get('v8');
      if (state && !state.notice.acknowledged) await repo.db.v8State.put({ ...state, notice: { ...state.notice, acknowledged: true } });
    });
  }
  async function getLegacyHistory() {
    return repo.db.transaction('r', [repo.db.sessions, repo.db.sets], async () => {
      const sets = await repo.db.sets.toArray();
      return (await repo.db.sessions.toArray()).map(session => ({ session, sets: sets.filter(set => set.sessionId === session.id), trainingSeconds: legacyTrainingSeconds(session) }));
    });
  }
  async function appendWorkoutNote(workoutId: string, text: string) {
    if (!text.trim()) throw new DomainError('INVALID', 'A note must contain text');
    return repo.write(async () => {
      const workout = await repo.db.v8Workouts.get(workoutId);
      if (!workout || workout.status === 'in_progress') throw new DomainError('INVALID', 'Append notes only after training ends');
      const next = v8WorkoutSchema.parse({ ...workout, appendedNotes: [...(workout.appendedNotes ?? []), { text, createdAt: new Date().toISOString() }] });
      await repo.db.v8Workouts.put(next);
      return next;
    });
  }
  return { getMigrationNotice, acknowledgeMigrationNotice, getLegacyHistory, appendWorkoutNote };
}
