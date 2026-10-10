import { confirmationFor } from '../domain/request-fingerprint';
import { coachRequestSchema, type CoachRequest } from './contracts';

/** Optional sensitive fields are absent, not empty placeholders, until selected. */
export function coachScope(request: CoachRequest, includeBody = false, includeHistory = false): CoachRequest {
  const { body, history, ...required } = structuredClone(request);
  return coachRequestSchema.parse({ ...required, ...(includeBody && body ? { body } : {}), ...(includeHistory && history ? { history } : {}) });
}
/** Shared by the home disclosure and its explicitly authorized panel send. */
export function coachMessageScope(request:CoachRequest,message:string):CoachRequest{
  const text=message.trim();
  return coachScope({...request,...('instruction' in request&&text?{instruction:text}:{}),messages:text?[...request.messages.slice(-7),{role:'user',content:text}]:request.messages});
}

export async function approveCoachScope(request: CoachRequest): Promise<CoachRequest> {
  const parsed = coachRequestSchema.parse(request);
  return { ...parsed, sendConfirmation: await confirmationFor(parsed) };
}

/** Complete actual payload for disclosure, including snapshot and conversation text. */
export function coachScopeFields(request: CoachRequest) {
  return Object.entries(request).filter(([key]) => key !== 'sendConfirmation')
    .map(([key, value]) => ({ key, value: typeof value === 'string' ? value : JSON.stringify(value) }));
}
