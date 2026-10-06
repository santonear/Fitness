import { z } from 'zod';
import { confirmationFor, goalConfirmationFor, requestSchema, type AiRequest } from '../backend/contracts';
import { CATALOG_VERSION, exercises } from '../catalog/exercises';
import { type GuidedDialogueRequest } from '../domain/guided-ai-contracts';
import { assertGuidedConsentCurrent, validateGuidedResponse, type GuidedSendConsent } from './guided-dialogue';
import { guidedServiceLimits } from '../backend/guided-provider';

export async function guidedTransportEnvelope(request: GuidedDialogueRequest): Promise<Exclude<AiRequest, { operation: 'summary' }>> {
  const base = { contractVersion: 1 as const, requestId: request.requestId, goalText: request.scope.goal,
    locale: request.locale, restoreGeneration: request.restoreGeneration, dialogue: request };
  const value = request.purpose === 'understand' || request.purpose === 'clarify'
    ? { ...base, operation: 'understand' as const }
    : { ...base, operation: 'generate' as const, confirmedGoal: request.confirmedSummary,
      goalConfirmation: await goalConfirmationFor({ goalText: request.scope.goal, confirmedGoal: request.confirmedSummary }),
      dates: request.dates!, timeZone: request.timeZone, catalogVersion: CATALOG_VERSION, conditions: {} };
  const parsed = requestSchema.parse({ ...value, sendConfirmation: await confirmationFor(value) });
  if (parsed.operation === 'summary') throw new Error('INVALID_INPUT');
  return parsed;
}
export async function sendGuidedDialogue(request: GuidedDialogueRequest, consent: GuidedSendConsent, signal: AbortSignal, fetcher: typeof fetch = fetch) {
  assertGuidedConsentCurrent(request, consent);
  const envelope = await guidedTransportEnvelope(request);
  let response: Response;
  try { response = await fetcher(`/api/v1/${envelope.operation === 'understand' ? 'goals/interpret' : 'plans/generate'}`, {
    method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'manual', signal,
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(envelope),
  }); } catch { throw new Error('CONTROL_UNAVAILABLE'); }
  if (response.redirected || response.type === 'opaqueredirect' || response.status >= 300 && response.status < 400) throw new Error('CONTROL_UNAVAILABLE');
  let body: unknown;
  try { body = await response.json(); } catch { throw new Error('CONTROL_UNAVAILABLE'); }
  if (!response.ok) {
    const parsed = z.object({ error: z.string().regex(/^[A-Z_]{1,64}$/) }).safeParse(body);
    throw new Error(parsed.success ? parsed.data.error : 'CONTROL_UNAVAILABLE');
  }
  const parsed = z.object({ requestId: z.string(), accounting: z.enum(['settled', 'pending']), result: z.unknown(),
    context: z.object({ restoreGeneration: z.number(), inputDigest: z.string() }) }).safeParse(body);
  if (!parsed.success || parsed.data.requestId !== request.requestId || parsed.data.context.restoreGeneration !== request.restoreGeneration || parsed.data.context.inputDigest !== envelope.sendConfirmation)
    throw new Error('CONTROL_UNAVAILABLE');
  const result = validateGuidedResponse(parsed.data.result, request, { expectedDates: request.dates ?? [], exerciseCatalog: exercises,
    restoreGeneration: request.restoreGeneration, limits: guidedServiceLimits });
  return { response: result, accounting: parsed.data.accounting };
}
