import { database, type FitnessDatabase } from '../persistence/db';
import { buildStageSummary, type StageSelection, type StageSummaryResult } from './stage-summary-core';
export { buildStageSummary } from './stage-summary-core';
export type { StageSelection, StageSummaryResult } from './stage-summary-core';

export function createStageSummaryService(db: FitnessDatabase) {
  return { async prepare(selection: StageSelection, nowMs: number): Promise<StageSummaryResult> {
    return db.transaction('r', [db.metadata, db.plans, db.planVersions, db.sessions, db.sets, db.scheduledWorkouts, db.bodyWeights], async () => {
      const [metadata, plans, planVersions, sessions, sets, scheduledWorkouts, bodyWeights] = await Promise.all([
        db.metadata.toCollection().first(), db.plans.toArray(), db.planVersions.toArray(), db.sessions.toArray(), db.sets.toArray(), db.scheduledWorkouts.toArray(), db.bodyWeights.toArray(),
      ]);
      if (!metadata || !Number.isFinite(nowMs)) return { ok: false, code: 'INVALID_FACTS', detail: 'Local metadata or clock is unavailable' };
      return buildStageSummary({ capturedAt: new Date(nowMs).toISOString(), dataRevision: metadata.dataRevision, restoreGeneration: metadata.restoreGeneration ?? 0,
        plans, planVersions, sessions, sets, scheduledWorkouts, bodyWeights }, selection);
    });
  } };
}
export const stageSummaryService = createStageSummaryService(database);
