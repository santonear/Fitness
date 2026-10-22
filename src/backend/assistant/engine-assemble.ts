import { engineDisplayNotices } from '../../application/engine-presentation';
import { engineAction, enginePlanProposal } from '../../application/engine-plan';
import type { AssistantIntent, AssistantRequest, AssistantAttachment } from '../../assistant/contracts';
import type { EngineChange, EnginePlan } from '../../engine/contracts';
import { exercises } from '../../catalog/exercises';
import { explicitScheduleChange } from '../../application/picked-schedule';

function exerciseId(value: string | undefined, candidateIds: string[] = []) {
  if (!value) return;
  const short = value.match(/^E([1-9][0-9]*)$/i);
  if (short) return candidateIds[Number(short[1]) - 1];
  const matches = exercises.filter(row =>
    [row.id, row.name.zh, row.name.en].some(name => name.toLowerCase() === value.toLowerCase()),
  );
  return matches.length === 1 ? matches[0].id : undefined;
}
/** No legacy fallback is allowed once a request selects the deterministic engine. */
export function assembleEngineIntent(
  intent: AssistantIntent,
  request: AssistantRequest,
  lockedItemIndexes: number[] = [],
): {
  attachment: AssistantAttachment | null;
  dropped: string[];
  repaired: boolean;
  notices: string[];
  enginePlan?: EnginePlan;
} {
  const context = request.context,
    profile = context?.engineProfile;
  const empty = { attachment: null, dropped: [], repaired: false, notices: [] as string[] };
  if (!context || !profile || !request.adultConfirmed) return empty;
  // Calendar-picked days are fixed: ignore a model-chosen day count unless the user asked to change days.
  if (
    (intent.kind === 'plan_new' || intent.kind === 'plan_modify') &&
    intent.params &&
    context.schedule &&
    !explicitScheduleChange(request.messages.at(-1)?.content ?? '')
  )
    intent = {
      ...intent,
      params: { ...intent.params, daysPerWeek: undefined, preferredDays: undefined },
    } as AssistantIntent;
  if (context.task === 'ONBOARD_PLAN' && intent.kind === 'plan_new') {
    const { plan, proposal } = enginePlanProposal(context.profile, {
      ...profile,
      locale: request.locale,
      daysPerWeek: Math.min(6, intent.params.daysPerWeek ?? profile.daysPerWeek),
      sessionMinutes: Math.max(10, Math.min(90, intent.params.minutesPerSession ?? profile.sessionMinutes)),
    });
    const notices = engineDisplayNotices(plan).map(notice => notice.message[request.locale]);
    return proposal
      ? {
          ...empty,
          notices,
          enginePlan: plan,
          attachment: {
            type: 'plan_proposal',
            requestId: context.requestId,
            restoreGeneration: context.restoreGeneration,
            mutationAllowed: false,
            proposal,
          },
        }
      : { ...empty, notices };
  }
  const changes = (
    raw: Extract<AssistantIntent, { kind: 'plan_modify' | 'today_adjust' }>['changes'],
  ): EngineChange[] =>
    (raw ?? []).flatMap(change => {
      const template =
        context.task === 'MODIFY_PLAN'
          ? context.plan.templates.find(
              row => !change.session || row.id === change.session || row.name === change.session,
            )
          : context.task === 'ADJUST_TODAY'
            ? context.template
            : undefined;
      const from = exerciseId(change.from, request.engineCandidateIds),
        to = exerciseId(change.to, request.engineCandidateIds);
      if (!template || (change.from && !from) || (change.to && !to)) return [];
      const index = template.items.findIndex(item => item.exerciseId === from);
      return [
        {
          op: change.op,
          templateId: template.id,
          ...(index >= 0 ? { itemIndex: index } : {}),
          exerciseId: change.op === 'add' ? to : from,
          replacementId: to,
          sets: change.sets,
          reps: change.reps ? Number.parseInt(change.reps, 10) : undefined,
          durationSeconds: change.seconds,
          minutes: change.minutes,
        },
      ];
    });
  const locked = [
    ...new Set([...(request.currentWorkout?.completedSets.map(set => set.itemIndex) ?? []), ...lockedItemIndexes]),
  ];
  const result =
    intent.kind === 'today_adjust'
      ? engineAction(
          context,
          { ...profile, locale: request.locale },
          intent.changes?.length && !intent.focus
            ? {
                kind: 'modify',
                changes: [
                  ...changes(intent.changes),
                  ...(intent.minutes ? [{ op: 'shorten' as const, minutes: intent.minutes }] : []),
                ],
              }
            : { kind: 'adjust', request: { minutes: intent.minutes, focus: intent.focus } },
          locked,
        )
      : intent.kind === 'plan_modify'
        ? engineAction(
            context,
            { ...profile, locale: request.locale },
            {
              kind: 'modify',
              changes: [
                ...changes(intent.changes),
                ...(intent.params?.daysPerWeek
                  ? [{ op: 'frequency' as const, daysPerWeek: intent.params.daysPerWeek }]
                  : []),
                ...(intent.params?.minutesPerSession
                  ? [{ op: 'shorten' as const, minutes: intent.params.minutesPerSession }]
                  : []),
              ],
            },
            locked,
          )
        : undefined;
  return result?.response
    ? {
        ...empty,
        notices: result.notices,
        attachment: result.response,
        ...('enginePlan' in result && result.enginePlan ? { enginePlan: result.enginePlan as EnginePlan } : {}),
      }
    : { ...empty, notices: result?.notices ?? [] };
}
