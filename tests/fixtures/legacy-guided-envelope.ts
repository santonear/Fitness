import { confirmationFor, goalConfirmationFor, requestSchema, type AiRequest } from '../../src/backend/contracts';
import { CATALOG_VERSION } from '../../src/catalog/exercises';
import type { GuidedDialogueRequest } from '../../src/domain/guided-ai-contracts';
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
