import type { Plan, PlanVersion, WorkoutSession } from '../models';

/** Keep plan identities separate. Ranking never rewrites the legacy plan or session. */
export function selectLegacyCurrentPlan(
  plans: readonly Plan[], versions: readonly PlanVersion[], sessions: readonly WorkoutSession[],
): Plan | undefined {
  const planByVersion = new Map(versions.map(version => [version.id, version.planId]));
  const latest = new Map<string, number>();
  const inProgress = new Set<string>();
  for (const session of sessions) {
    const planId = session.planVersionId && planByVersion.get(session.planVersionId);
    if (!planId) continue;
    if (session.status === 'in_progress') inProgress.add(planId);
    const started = Date.parse(session.startedAt);
    if (!latest.has(planId) || started > latest.get(planId)!) latest.set(planId, started);
  }
  const priority = (plan: Plan) => Number(plan.status === 'active' || inProgress.has(plan.id));
  const compareText = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
  return [...plans].filter(plan => !plan.deletedAt).sort((left, right) =>
    priority(right) - priority(left)
    || (latest.get(right.id) ?? -Infinity) - (latest.get(left.id) ?? -Infinity)
    || Date.parse(right.createdAt) - Date.parse(left.createdAt)
    || compareText(left.id, right.id),
  )[0];
}

/** Undefined means excluded from duration statistics; the original timestamps stay untouched. */
export function legacyTrainingSeconds(session: Pick<WorkoutSession, 'startedAt' | 'completedAt'>): number | undefined {
  if (session.completedAt === undefined) return undefined;
  const seconds = (Date.parse(session.completedAt) - Date.parse(session.startedAt)) / 1000;
  return Number.isFinite(seconds) && seconds >= 0 && seconds <= 12 * 60 * 60 ? seconds : undefined;
}
