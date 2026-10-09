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
  scheduledWorkouts: readonly (Omit<ScheduledWorkout, 'durationMinutes'> & { durationMinutes?: unknown })[];
  guidedStates?: readonly GuidedState[];
}

function templateName(index: number): string {
  let name = '';
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) name = String.fromCharCode(65 + (value - 1) % 26) + name;
  return name;
}

async function migratedVersionId(originalId: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`fitness:v8:legacy-plan-version:${originalId}`))).slice(0, 16);
  digest[6] = (digest[6] & 0x0f) | 0x80;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Pure projection. Retain legacy tables separately; precompute before writes or keep the Dexie upgrade alive with waitFor. */
export async function migrateLegacyPlans(
  source: LegacyPlansInput,
  estimate: (exercises: LegacyPlanVersion['days'][number]['exercises']) => number,
  migratedAt: string,
): Promise<{ plans: { id: string; name: string; currentVersionId: string; readOnly: boolean }[]; versions: PlanVersion[]; currentPlanId?: string }> {
  const onboarding = source.guidedStates?.find(state => state.id === 'guided')?.onboarding;
  const schedule = onboarding?.answers.schedule;
  const scheduleValue = schedule?.status === 'answered' ? schedule.value : undefined;
  const onboardingSlot = Array.isArray(scheduleValue) && scheduleValue[1] !== '' ? Number(scheduleValue[1]) : undefined;
  const retainedPlans = source.plans.filter(plan => !plan.deletedAt);
  const versions = await Promise.all(retainedPlans.map(async plan => {
    const original = source.planVersions.find(version => version.id === plan.currentVersionId && version.planId === plan.id);
    if (!original) throw new DomainError('INVALID', 'Legacy current plan version is missing');
    const id = await migratedVersionId(original.id);
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
      // Period-plan days already contain every week; date-day plans contain exactly one day.
      weeklyTarget: 'durationWeeks' in original ? Math.max(1, Math.min(7, Math.round(original.days.length / original.durationWeeks))) : 1,
      // Legacy plan versions have no plan-scoped original schedule text. A current global answer is not its provenance.
      scheduleOriginalText: '',
      sessionMinutes: legacyPlanMinutes(onboardingSlot, templates.map(template => template.estimatedMinutes)),
      templates, createdAt: migratedAt, origin: 'migrated' as const,
      changeSummary: estimated ? ['部分时长按动作估算'] : [], basedOnVersionId: original.id,
    };
  }));
  const current = selectLegacyCurrentPlan(source.plans, source.planVersions, source.sessions);
  return {
    plans: retainedPlans.map((plan, index) => ({ id: plan.id, name: plan.name, currentVersionId: versions[index].id, readOnly: plan.id !== current?.id })),
    versions, ...(current ? { currentPlanId: current.id } : {}),
  };
}
