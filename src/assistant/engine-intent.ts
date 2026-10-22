import { assembleEngineIntent } from '../backend/assistant/engine-assemble';
import { localEngineContext } from '../coach/engine-health';
import type { CoachRequest, CoachResponse } from '../coach/contracts';
import type { EnginePlan } from '../engine/contracts';
import type { AssistantIntent } from './contracts';

export type EngineIntentCandidate = {
  request: CoachRequest;
  response: CoachResponse;
  expectedRevision: number;
  enginePlan?: EnginePlan;
};
/**
 * The outcome of one model intent. Every intent ends either as a previewable
 * candidate (never written until the user confirms) or as an explicit status;
 * an intent is never dropped silently.
 */
export type EngineIntentOutcome =
  | { kind: 'candidate'; candidate: EngineIntentCandidate; notices: string[] }
  | { kind: 'no_session'; notices: string[] }
  | { kind: 'noop'; notices: string[] }
  | { kind: 'review' };

export function resolveEngineIntent(input: {
  intent: AssistantIntent;
  routed?: CoachRequest;
  sent?: CoachRequest;
  locale: 'zh' | 'en';
  conversationId: string;
  message: string;
  engineCandidateIds?: string[];
  lockedItemIndexes: number[];
  expectedRevision: number;
}): EngineIntentOutcome {
  const { intent, routed, sent } = input;
  if (intent.kind === 'review') return { kind: 'review' };
  // A today adjustment needs a concrete session. A plan conversation has none,
  // and a network-scoped request lacks the local engine profile.
  if (intent.kind === 'today_adjust' && (routed?.task !== 'ADJUST_TODAY' || sent?.task !== 'ADJUST_TODAY'))
    return { kind: 'no_session', notices: [] };
  if (!routed || !sent || !routed.engineProfile || routed.task !== sent.task)
    return { kind: 'no_session', notices: [] };
  const request = localEngineContext(routed, sent);
  const assembled = assembleEngineIntent(
    intent,
    {
      version: 'fitness-assistant-v2',
      requestId: sent.requestId,
      conversationId: input.conversationId,
      locale: input.locale,
      timeZone: sent.timeZone,
      adultConfirmed: sent.adultConfirmed,
      messages: [{ role: 'user', content: input.message }],
      engineCandidateIds: input.engineCandidateIds,
      context: request,
    },
    input.lockedItemIndexes,
  );
  if (assembled.attachment && assembled.attachment.type !== 'exercise_info')
    return {
      kind: 'candidate',
      notices: assembled.notices,
      candidate: {
        request,
        response: assembled.attachment,
        expectedRevision: input.expectedRevision,
        ...(assembled.enginePlan ? { enginePlan: assembled.enginePlan } : {}),
      },
    };
  return { kind: 'noop', notices: assembled.notices };
}
