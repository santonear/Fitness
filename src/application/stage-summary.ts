import { localDateSchema, timeZoneSchema } from '../domain/schemas';
import type { PlanVersion, ProgressReport } from '../domain/models';
import { database, type FitnessDatabase } from '../persistence/db';
import { buildHistoryContext, type HistorySnapshot, type HistoryPayload, type HistoryManifest } from './history-context';
import { calculateProgress } from './progress';

export type StageSelection =
  | { kind: 'dateRange'; from: string; to: string; timeZone: string }
  | { kind: 'planWeek'; planId: string; from: string; timeZone: string }
  | { kind: 'wholePlan'; planId: string; timeZone: string };
export type StageSummaryResult =
  | { ok: false; code: 'INVALID_RANGE' | 'EMPTY_STAGE' | 'INVALID_FACTS'; detail: string }
  | { ok: true; selection: StageSelection; range: { from: string; to: string; timeZone: string }; report: ProgressReport;
      payload: HistoryPayload; manifest: HistoryManifest; goals: { planId: string; planVersionId: string; goal: PlanVersion['goalSnapshot'] }[] };

function plusDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Pure local preparation. Actual-session dates and original-task dates remain separate. */
export function buildStageSummary(snapshot: HistorySnapshot, selection: StageSelection): StageSummaryResult {
  const invalid = (detail: string): StageSummaryResult => ({ ok: false, code: 'INVALID_RANGE', detail });
  if (!timeZoneSchema.safeParse(selection.timeZone).success) return invalid('Invalid display time zone');
  const selectedVersions = selection.kind === 'dateRange' ? [...snapshot.planVersions] : snapshot.planVersions.filter(version => version.planId === selection.planId);
  if (selection.kind !== 'dateRange' && (!snapshot.plans.some(plan => plan.id === selection.planId) || !selectedVersions.length)) return invalid('Select an existing plan');
  let from: string;
  let to: string;
  if (selection.kind === 'wholePlan') {
    from = selectedVersions.map(version => version.startDate).sort()[0];
    to = selectedVersions.map(version => 'durationWeeks' in version ? plusDays(version.startDate, version.durationWeeks * 7 - 1) : version.days.map(day => day.date).sort().at(-1)!).sort().at(-1)!;
  } else {
    from = selection.from;
    if (!localDateSchema.safeParse(from).success) return invalid('Invalid inclusive date range');
    to = selection.kind === 'planWeek' ? plusDays(from, 6) : selection.to;
  }
  if (![from, to].every(value => localDateSchema.safeParse(value).success) || from > to) return invalid('Invalid inclusive date range');
  const versionIds = new Set(selectedVersions.map(version => version.id));
  const sessions = snapshot.sessions.filter(session => selection.kind === 'dateRange' || (session.planVersionId !== undefined && versionIds.has(session.planVersionId)));
  const scheduledWorkouts = snapshot.scheduledWorkouts.filter(row => selection.kind === 'dateRange' || versionIds.has(row.planVersionId));
  try {
    const report = calculateProgress({ from, to, timeZone: selection.timeZone, nowMs: Date.parse(snapshot.capturedAt),
      planTimeZones: Object.fromEntries(snapshot.planVersions.map(version => [version.id, version.scheduleTimeZone])),
      sessions, scheduledWorkouts, sets: [...snapshot.sets], bodyWeights: [...snapshot.bodyWeights] }, to);
    const sessionIds = new Set(report.history.map(session => session.id));
    const selectedSnapshot = { ...snapshot, sessions: report.history, sets: snapshot.sets.filter(set => sessionIds.has(set.sessionId) && set.completed), scheduledWorkouts };
    const history = buildHistoryContext(selectedSnapshot, { from, to, sources: ['sessions', 'scheduledWorkouts', 'bodyWeights'], maxUtf8Bytes: Number.MAX_SAFE_INTEGER });
    if (!history.ok) return { ok: false, code: 'INVALID_FACTS', detail: history.reason === 'invalid_snapshot' ? history.detail : 'Local facts exceed preparation capacity' };
    if (!history.payload.sessions.length && !history.payload.bodyWeights.length) return { ok: false, code: 'EMPTY_STAGE', detail: 'No completed sessions or weight observations in this range' };
    const goalVersions = selection.kind === 'dateRange' ? snapshot.planVersions.filter(version => history.payload.planVersions.some(row => row.id === version.id)) : selectedVersions;
    return { ok: true, selection: structuredClone(selection), range: { from, to, timeZone: selection.timeZone }, report,
      payload: history.payload, manifest: history.manifest, goals: goalVersions.map(version => ({ planId: version.planId, planVersionId: version.id, goal: structuredClone(version.goalSnapshot) })) };
  } catch (reason) {
    return { ok: false, code: 'INVALID_FACTS', detail: (reason as Error).message };
  }
}

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
