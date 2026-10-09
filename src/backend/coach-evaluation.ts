import type { GuidedDialogueRequest } from '../domain/guided-ai-contracts';
import { validateGuidedProviderInput, validateGuidedProviderOutput } from './guided-provider';
import { COACH_PROMPT_VERSION, coachTask } from './coach-prompt-registry';
import { guidedAiExercises } from '../catalog/ai-catalog';
import { EQUIPMENT } from '../catalog/taxonomy';

/** Offline evidence only. No network, persistence, automatic retries or clinical scoring. */
export function evaluateCoachResponse(request: GuidedDialogueRequest, raw: unknown, k: number) {
  const metadata = { promptVersion: COACH_PROMPT_VERSION, schemaVersion: request.version, task: request.coachTask ?? coachTask(request.purpose) };
  try {
    validateGuidedProviderInput(request, k);
    const response = validateGuidedProviderOutput(request, raw);
    const issues: string[] = [];
    const review: string[] = ['adult-general-fitness-safety', 'personalization-and-restrictions', 'explanation-quality'];
    if ('candidate' in response) {
      const available = request.scope.conditions.availableEquipment;
      const known = Array.isArray(available) && available.every(value => typeof value === 'string' && (EQUIPMENT as readonly string[]).includes(value));
      const catalog = guidedAiExercises(request);
      for (const day of response.candidate.days) {
        for (const exercise of day.exercises) {
          const item = catalog.find(entry => entry.id === exercise.exerciseId)!;
          if (known && item.equipment !== 'none' && !available.includes(item.equipment)) issues.push('EQUIPMENT_UNAVAILABLE');
        }
      }
      if (!known) review.push('equipment-language-interpretation');
      if (!request.schedule) review.push('session-duration');
      review.push('training-volume-and-recovery');
    } else if (response.purpose === 'clarify' || response.purpose === 'refused') {
      review.push('question-necessity-and-repetition');
    }
    return { ...metadata, structuralGate: 'pass' as const, deterministicIssues: [...new Set(issues)],
      contentGate: issues.length ? 'fail' as const : 'human-review-required' as const,
      humanReview: review };
  } catch {
    return { ...metadata, structuralGate: 'fail' as const, deterministicIssues: ['INVALID_REQUEST_OR_RESPONSE'],
      contentGate: 'not-evaluated' as const, humanReview: [] as string[] };
  }
}
