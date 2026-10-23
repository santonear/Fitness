import { engineDisplayNotices } from '../../../application/engine-presentation';
import { isFeatureEnabled } from '../../../application/feature-flags';
import { enginePlanProposal, engineAction, type LocalEngineAction } from '../../../application/engine-plan';
import { currentWorkoutContext } from '../../../assistant/client-context';
import { repository } from '../../../persistence/repository';
import { engineCopy } from '../../../coach/engine-copy';
import type { AssistantState } from './useAssistantState';

/** This render's on-device engine actions (generate a plan, apply a local action). */
export function assistantLocal(s: AssistantState) {
  const { request, expectedRevision, locale, setError, setCandidate, setLocalReply, engineEnabled, setLocalNotices } =
    s;
  async function localGenerate() {
    if (
      !engineEnabled ||
      !isFeatureEnabled('trainingEngine') ||
      request?.task !== 'ONBOARD_PLAN' ||
      !request.trainingEngine ||
      !request.engineProfile
    )
      return;
    const history = await repository.db.v8Workouts.toArray();
    if (!isFeatureEnabled('trainingEngine')) return;
    const result = enginePlanProposal(request.profile, request.engineProfile, history);
    setLocalReply(true);
    setLocalNotices(engineDisplayNotices(result.plan).map(notice => notice.message[locale]));
    setError(result.proposal ? '' : engineCopy('assistant.copy.engine_noop', locale));
    setCandidate(
      result.proposal
        ? {
            request,
            response: {
              type: 'plan_proposal',
              requestId: request.requestId,
              restoreGeneration: request.restoreGeneration,
              mutationAllowed: false,
              proposal: result.proposal,
            },
            expectedRevision,
            enginePlan: result.plan,
          }
        : undefined,
    );
  }
  async function localAction(action: LocalEngineAction) {
    if (!engineEnabled || !isFeatureEnabled('trainingEngine') || !request?.trainingEngine || !request.engineProfile)
      return;
    const current = await currentWorkoutContext(request, repository.db);
    const active =
      request.task === 'ADJUST_TODAY' && request.workoutId
        ? await repository.db.v8Workouts.get(request.workoutId)
        : undefined;
    const result = engineAction(request, request.engineProfile, action, [
      ...new Set([
        ...(current?.completedSets.map(set => set.itemIndex) ?? []),
        ...(active?.substitutions?.map(row => row.itemIndex) ?? []),
      ]),
    ]);
    setLocalReply(true);
    setLocalNotices(result.notices);
    setCandidate(
      result.response
        ? {
            request,
            response: result.response,
            expectedRevision,
            ...(result.enginePlan ? { enginePlan: result.enginePlan } : {}),
          }
        : undefined,
    );
    if (result.noop) setError(engineCopy('assistant.copy.engine_noop', locale));
    else setError('');
  }
  return { localGenerate, localAction };
}
