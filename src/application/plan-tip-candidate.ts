import { buildCoachRequest, type CoachRequestInput } from '../coach/request-builder';
import { coachResponseSchema, type CoachRequest, type CoachResponse } from '../coach/contracts';
import type { EnginePlan } from '../engine/contracts';
import { engineAction } from './engine-plan';
import { isFeatureEnabled } from './feature-flags';
import type { PlanChange } from './yaya-tips';

/**
 * Turns one of 芽芽's plan tips into the same candidate a 芽芽 plan edit produces (the swap sheet's path): with the
 * training engine on, the engine runs the tip's operations under its own rules; otherwise the tip's local proposal
 * becomes a change proposal. Undefined when nothing would change or no plan request can be built.
 */
export function planTipCandidate(
  data: CoachRequestInput['data'],
  tip: PlanChange & { summary: string },
): { request: CoachRequest; response: CoachResponse; expectedRevision: number; enginePlan?: EnginePlan } | undefined {
  const request = buildCoachRequest({ task: 'MODIFY_PLAN', data });
  if (!request || request.task !== 'MODIFY_PLAN') return;
  const expectedRevision = data.metadata.dataRevision;
  if (request.trainingEngine && request.engineProfile && isFeatureEnabled('trainingEngine')) {
    const result = engineAction(request, request.engineProfile, { kind: 'modify', changes: tip.changes });
    if (result.noop || !result.response || result.response.type !== 'change_proposal') return;
    return {
      request,
      response: { ...result.response, changes: [tip.summary] },
      expectedRevision,
      ...(result.enginePlan ? { enginePlan: result.enginePlan } : {}),
    };
  }
  const { weeklyTarget, sessionMinutes, templates } = tip.proposal;
  return {
    request,
    expectedRevision,
    response: coachResponseSchema.parse({
      requestId: request.requestId,
      restoreGeneration: request.restoreGeneration,
      mutationAllowed: false,
      type: 'change_proposal',
      target: request.target,
      proposal: {
        ...request.plan,
        weeklyTarget,
        sessionMinutes,
        templates,
        reasons: [tip.summary, tip.summary, tip.summary],
      },
      changes: [tip.summary],
    }),
  };
}
