import type { ProgressQuery, ProgressReport } from '../domain/models';
import { repository, type Repository } from '../persistence/repository';
import { calculateProgress } from './progress-calculation';
export { calculateProgress, dateInZone } from './progress-calculation';

export function createProgressService(repo: Repository) {
  async function queryProgress(input: ProgressQuery, nowMs: number): Promise<ProgressReport> {
    const db = repo.db;
    return db.transaction('r', [db.sessions, db.sets, db.scheduledWorkouts, db.bodyWeights, db.planVersions], async () => {
      const [sessions, sets, scheduledWorkouts, bodyWeights, versions] = await Promise.all([
        db.sessions.toArray(), db.sets.toArray(), db.scheduledWorkouts.toArray(), db.bodyWeights.toArray(), db.planVersions.toArray(),
      ]);
      const planTimeZones: Record<string, string> = {};
      for (const version of versions) {
        planTimeZones[version.id] = version.scheduleTimeZone;
      }
      return calculateProgress({ ...input, nowMs, planTimeZones, sessions, sets, scheduledWorkouts, bodyWeights }, input.to);
    });
  }
  return { queryProgress };
}

export const progressService = createProgressService(repository);
export const { queryProgress } = progressService;
