import { applicableEnginePlan } from '../engine/environment';
import { engineDisplayNotices } from './engine-presentation';
import { generatePlan, adjustToday, modifyPlan, substitute } from '../engine';
import type {
  EnginePlan,
  EngineProfile,
  EngineChange,
  AdjustTodayRequest,
  SubstituteReason,
} from '../engine/contracts';
import type { SessionTemplate, WorkoutRecord } from '../domain/v8/contracts';
import { planProposalSchema, type CoachRequest, type CoachResponse } from '../coach/contracts';

/** A stub or blocked engine can never become an actionable candidate. */
export function usableEnginePlan(plan: EnginePlan, profile?: EngineProfile) {
  return (
    !plan.meta.engineVersion.includes('stub') &&
    plan.templates.length > 0 &&
    plan.templates.every(template => template.items.length > 0) &&
    !plan.gates.some(gate => gate.status === 'blocked') &&
    (profile ? applicableEnginePlan(plan, profile) : !plan.quality?.issues.some(issue => issue.severity === 'error'))
  );
}
export function enginePlanProposal(
  profile: { goalText: string; scheduleOriginalText: string },
  engineProfile: EngineProfile,
  _history: WorkoutRecord[] = [],
  variant = 0,
) {
  const generated = generatePlan(engineProfile, { variant });
  if (!usableEnginePlan(generated, engineProfile)) return { plan: generated, proposal: undefined };
  // Daily recovery/progression is projected at preview/start, never persisted as the baseline plan.
  const progressed = generated;
  const locale = engineProfile.locale ?? 'zh',
    notices = engineDisplayNotices(progressed).map(notice => notice.message[locale]);
  const summary = notices.join(' ') || profile.goalText;
  const proposal = planProposalSchema.parse({
    goalText: profile.goalText,
    scheduleOriginalText: profile.scheduleOriginalText,
    weeklyTarget: progressed.weeklyTarget,
    preferredDays: progressed.preferredDays,
    sessionMinutes: progressed.sessionMinutes,
    templates: progressed.templates,
    reasons: [summary, summary, summary],
  });
  return { plan: progressed, proposal };
}
export function existingEnginePlan(plan: {
  weeklyTarget: number;
  preferredDays?: EnginePlan['preferredDays'];
  sessionMinutes: number;
  templates: SessionTemplate[];
}): EnginePlan {
  return {
    ...plan,
    weeklyTarget: Math.min(6, plan.weeklyTarget),
    sessionMinutes: Math.min(90, Math.max(10, plan.sessionMinutes)),
    meta: { engineVersion: 'existing', rulesVersion: 'existing', seed: '' },
    trace: [],
    notices: [],
    gates: [],
  };
}
export type LocalEngineAction =
  | { kind: 'adjust'; request: AdjustTodayRequest }
  | { kind: 'substitute'; itemIndex: number; reason: SubstituteReason }
  | { kind: 'modify'; changes: EngineChange[] };
/** Typed buttons and AI intentions share this adapter and the same pure engine operations. */
export function engineAction(
  request: CoachRequest,
  profile: EngineProfile,
  action: LocalEngineAction,
  lockedItemIndexes: number[] = [],
): { response?: CoachResponse; enginePlan?: EnginePlan; notices: string[]; noop: boolean } {
  const locale = profile.locale ?? request.locale,
    identity = {
      requestId: request.requestId,
      restoreGeneration: request.restoreGeneration,
      mutationAllowed: false as const,
    };
  if (request.task === 'ADJUST_TODAY' && action.kind === 'modify') {
    const plan = existingEnginePlan({
      weeklyTarget: profile.daysPerWeek,
      sessionMinutes: request.template.estimatedMinutes,
      templates: [request.template],
    });
    const result = modifyPlan(plan, profile, action.changes),
      template = result.value.templates[0],
      notices = engineDisplayNotices(result).map(notice => notice.message[locale]);
    if (
      result.noop ||
      !usableEnginePlan(result.value, profile) ||
      !template ||
      result.gates.some(gate => gate.status === 'blocked') ||
      lockedItemIndexes.some(
        index => JSON.stringify(request.template.items[index]) !== JSON.stringify(template.items[index]),
      )
    )
      return { noop: true, notices };
    return {
      noop: false,
      notices,
      response: {
        ...identity,
        type: 'today_adjustment',
        target: request.target,
        workoutId: request.workoutId,
        template,
        summary: result.summary[locale],
      },
    };
  }
  if (request.task === 'ADJUST_TODAY' && action.kind !== 'modify') {
    const replacementProfile =
      action.kind === 'substitute'
        ? {
            ...profile,
            preferences: {
              ...profile.preferences,
              excludedExerciseIds: [
                ...new Set([
                  ...profile.preferences.excludedExerciseIds,
                  ...request.template.items
                    .filter((_, index) => index !== action.itemIndex)
                    .map(item => item.exerciseId),
                ]),
              ],
            },
          }
        : profile;
    const result =
      action.kind === 'adjust'
        ? adjustToday(request.template, profile, { ...action.request, lockedItemIndexes })
        : lockedItemIndexes.includes(action.itemIndex) || !request.template.items[action.itemIndex]
          ? undefined
          : substitute(request.template.items[action.itemIndex], replacementProfile, action.reason);
    if (!result) return { noop: true, notices: [] };
    const notices = engineDisplayNotices(result).map(notice => notice.message[locale]);
    if (result.noop || result.gates.some(gate => gate.status === 'blocked')) return { noop: true, notices };
    const template =
      action.kind === 'adjust'
        ? (result.value as SessionTemplate)
        : {
            ...request.template,
            items: request.template.items.map((item, index) =>
              index === action.itemIndex ? (result.value as SessionTemplate['items'][number]) : item,
            ),
          };
    if (
      lockedItemIndexes.some(
        index => JSON.stringify(request.template.items[index]) !== JSON.stringify(template.items[index]),
      )
    )
      return { noop: true, notices };
    return {
      noop: false,
      notices,
      response: {
        ...identity,
        type: 'today_adjustment',
        target: request.target,
        workoutId: request.workoutId,
        template,
        summary: result.summary[locale],
      },
    };
  }
  if (request.task === 'MODIFY_PLAN' && action.kind === 'modify') {
    const result = modifyPlan(existingEnginePlan(request.plan), profile, action.changes),
      notices = engineDisplayNotices(result).map(notice => notice.message[locale]);
    if (result.noop || result.gates.some(gate => gate.status === 'blocked') || !usableEnginePlan(result.value, profile))
      return { noop: true, notices };
    const summary = result.summary[locale];
    const proposal = planProposalSchema.parse({
      ...request.plan,
      weeklyTarget: result.value.weeklyTarget,
      preferredDays: result.value.preferredDays,
      sessionMinutes: result.value.sessionMinutes,
      templates: result.value.templates,
      reasons: [summary, summary, summary],
    });
    return {
      noop: false,
      notices,
      enginePlan: result.value,
      response: { ...identity, type: 'change_proposal', target: request.target, proposal, changes: [summary] },
    };
  }
  return { noop: true, notices: [] };
}
