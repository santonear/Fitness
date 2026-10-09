import type { GuidedState } from '../guided-contracts';
import type { Plan, PlanVersion as LegacyPlanVersion, ScheduledWorkout, WorkoutSession } from '../models';
import { DomainError } from '../errors';
import type { PlanVersion, SessionTemplate } from './contracts';
import { legacyItemsToV8 } from './legacy-items';
import { legacyPlanMinutes, legacyTemplateMinutes } from './legacy-duration';
import { selectLegacyCurrentPlan } from './legacy-selection';

interface LegacyPlansInput {
  plans: readonly Plan[];
  planVersions: readonly LegacyPlanVersion[];
  sessions: readonly WorkoutSession[];
  scheduledWorkouts: readonly ScheduledWorkout[];
  guidedStates?: readonly GuidedState[];
}

function templateName(index: number): string {
  let name = '';
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) name = String.fromCharCode(65 + (value - 1) % 26) + name;
  return name;
}

/** Pure projection: the transaction must retain all original legacy tables separately. */
export function migrateLegacyPlans(
  source: LegacyPlansInput,
  estimate: (exercises: LegacyPlanVersion['days'][number]['exercises']) => number,
  migratedAt: string,
): { plans: { id: string; name: string; currentVersionId: string; readOnly: boolean }[]; versions: PlanVersion[]; currentPlanId?: string } {
  const onboarding = source.guidedStates?.find(state => state.id === 'guided')?.onboarding;
  const schedule = onboarding?.answers.schedule;
  const scheduleValue = schedule?.status === 'answered' ? schedule.value : undefined;
  const onboardingSlot = Array.isArray(scheduleValue) && scheduleValue[1] !== '' ? Number(scheduleValue[1]) : undefined;
  const versions = source.plans.map(plan => {
    const original = source.planVersions.find(version => version.id === plan.currentVersionId && version.planId === plan.id);
    if (!original) throw new DomainError('INVALID', 'Legacy current plan version is missing');
    const id = `v8:migrated:${original.id}`;
    const templates: SessionTemplate[] = [];
    const unique = new Set<string>();
    let estimated = false;
    for (const day of original.days) {
      const items = legacyItemsToV8(day.exercises);
      const schedules = source.scheduledWorkouts.filter(row => row.planVersionId === original.id && row.plannedDayId === day.dayId);
      const durations = schedules.length ? schedules.map(row => row.durationMinutes) : [undefined];
      for (const raw of durations) {
        const duration = legacyTemplateMinutes(raw, () => estimate(day.exercises));
        estimated ||= duration.estimated;
        const key = JSON.stringify([items, duration.minutes]);
        if (unique.has(key)) continue;
        unique.add(key);
        const index = templates.length;
        templates.push({ id: `${id}:template:${index}`, name: templateName(index), estimatedMinutes: duration.minutes, items });
      }
    }
    if (!templates.length) throw new DomainError('INVALID', 'Legacy plan has no training templates');
    return {
      id, planId: plan.id, versionNumber: original.versionNumber + 1,
      goalText: original.goalSnapshot.goal,
      weeklyTarget: Math.max(1, Math.min(7, Math.round(original.days.length / ('durationWeeks' in original ? original.durationWeeks : 1)))),
      scheduleOriginalText: typeof scheduleValue === 'string' ? scheduleValue : '',
      sessionMinutes: legacyPlanMinutes(onboardingSlot, templates.map(template => template.estimatedMinutes)),
      templates, createdAt: migratedAt, origin: 'migrated' as const,
      changeSummary: estimated ? ['部分时长按动作估算'] : [], basedOnVersionId: original.id,
    };
  });
  const current = selectLegacyCurrentPlan(source.plans, source.planVersions, source.sessions);
  return {
    plans: source.plans.map((plan, index) => ({ id: plan.id, name: plan.name, currentVersionId: versions[index].id, readOnly: plan.id !== current?.id })),
    versions, ...(current ? { currentPlanId: current.id } : {}),
  };
}
