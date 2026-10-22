import type { Repository } from '../persistence/repository';
import { DomainError } from '../domain/errors';
export const PLAN_UNDO_MS = 10_000;
export const PLAN_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const conflict = (message: string): never => {
  throw new DomainError('CONFLICT', message);
};
export function createPlanLifecycle(repo: Repository, now: () => number = Date.now) {
  const db = repo.db;
  async function deletePlan(planId: string, expectedRevision: number) {
    return repo.write(async () => {
      const plan = await db.v8Plans.get(planId),
        state = await db.v8State.get('v8');
      if (!plan || plan.deletedAt || !state) return conflict('PLAN_UNAVAILABLE');
      const versions = await db.v8PlanVersions.where('planId').equals(planId).toArray();
      const versionIds = new Set(versions.map(v => v.id));
      if (
        (await db.v8Workouts.toArray()).some(
          w => w.status === 'in_progress' && w.planVersionId && versionIds.has(w.planVersionId),
        )
      )
        return conflict('PLAN_TRAINING_ACTIVE');
      const deletedAt = new Date(now()).toISOString(),
        deletedWasCurrent = state.currentPlanId === planId;
      await db.v8Plans.put({
        ...plan,
        readOnly: true,
        deletedAt,
        deletedWasCurrent,
        ...(deletedWasCurrent && state.nextWorkoutOverride
          ? { deletedNextWorkoutOverride: state.nextWorkoutOverride }
          : {}),
      });
      if (deletedWasCurrent) {
        const { currentPlanId: _current, nextWorkoutOverride: _override, ...rest } = state;
        const target = versions.find(v => v.id === plan.currentVersionId)?.weeklyTarget;
        await db.v8State.put({
          ...rest,
          planDismissedAt: deletedAt,
          ...(target ? { reviewWeeklyTarget: target } : {}),
        });
      }
      return { planId, deletedAt, undoUntil: Date.parse(deletedAt) + PLAN_UNDO_MS };
    }, expectedRevision);
  }
  async function restorePlan(planId: string, expectedRevision: number, undo = false) {
    return repo.write(async () => {
      const plan = await db.v8Plans.get(planId),
        state = await db.v8State.get('v8');
      if (!plan?.deletedAt || !state) return conflict('PLAN_UNAVAILABLE');
      const age = now() - Date.parse(plan.deletedAt);
      if (age < 0 || age >= (undo ? PLAN_UNDO_MS : PLAN_RETENTION_MS))
        return conflict(undo ? 'PLAN_UNDO_EXPIRED' : 'PLAN_RECOVERY_EXPIRED');
      const makeCurrent = undo && plan.deletedWasCurrent && !state.currentPlanId;
      const {
        deletedAt: _deleted,
        deletedWasCurrent: _current,
        deletedNextWorkoutOverride: override,
        ...retained
      } = plan;
      await db.v8Plans.put({ ...retained, readOnly: !makeCurrent });
      if (makeCurrent) {
        const { planDismissedAt: _dismissed, ...rest } = state;
        await db.v8State.put({
          ...rest,
          currentPlanId: plan.id,
          ...(override ? { nextWorkoutOverride: override } : {}),
        });
      }
      return { planId, restoredAsCurrent: !!makeCurrent };
    }, expectedRevision);
  }
  async function activatePlan(planId: string, expectedRevision: number) {
    return repo.write(async () => {
      const plan = await db.v8Plans.get(planId),
        state = await db.v8State.get('v8');
      if (!plan || plan.deletedAt || !state) return conflict('PLAN_UNAVAILABLE');
      const version = await db.v8PlanVersions.get(plan.currentVersionId);
      if (!version || version.planId !== plan.id) return conflict('PLAN_UNAVAILABLE');
      if ((await db.v8Workouts.toArray()).some(w => w.status === 'in_progress'))
        return conflict('PLAN_TRAINING_ACTIVE');
      if (state.currentPlanId === plan.id) return { planId };
      const current = state.currentPlanId ? await db.v8Plans.get(state.currentPlanId) : undefined;
      if (current) await db.v8Plans.put({ ...current, readOnly: true });
      await db.v8Plans.put({ ...plan, readOnly: false });
      const { planDismissedAt: _dismissed, nextWorkoutOverride: _override, ...rest } = state;
      await db.v8State.put({ ...rest, currentPlanId: plan.id, reviewWeeklyTarget: version.weeklyTarget });
      return { planId };
    }, expectedRevision);
  }
  async function purgeExpiredPlans() {
    // Check and mutate under one serialized transaction. No-op reads do not increment revisions.
    return db.transaction('rw', db.tables, async () => {
      const plans = await db.v8Plans.toArray(),
        workouts = await db.v8Workouts.toArray(),
        versions = await db.v8PlanVersions.toArray();
      const activeVersions = new Set(workouts.filter(w => w.status === 'in_progress').map(w => w.planVersionId));
      const expired = plans.filter(
        p =>
          p.deletedAt &&
          now() - Date.parse(p.deletedAt) >= PLAN_RETENTION_MS &&
          !versions.some(v => v.planId === p.id && activeVersions.has(v.id)),
      );
      if (!expired.length) return 0;
      return repo.write(async () => {
        for (const plan of expired) {
          for (const v of versions.filter(v => v.planId === plan.id)) {
            const linked = workouts.filter(w => w.planVersionId === v.id);
            if (linked.length) {
              const templateIds = [...new Set(linked.map(w => w.templateId).filter((id): id is string => !!id))];
              const needed = new Set(linked.filter(w => !w.templateSnapshot).map(w => w.templateId));
              const legacyTemplates = v.templates.filter(t => needed.has(t.id));
              await db.v8PlanReferences.put({
                id: v.id,
                planId: plan.id,
                planName: plan.name,
                versionNumber: v.versionNumber,
                templateIds,
                ...(legacyTemplates.length ? { legacyTemplates } : {}),
              });
            }
            await db.v8PlanVersions.delete(v.id);
          }
          await db.v8Plans.delete(plan.id);
        }
        return expired.length;
      });
    });
  }
  return { deletePlan, restorePlan, activatePlan, purgeExpiredPlans };
}
