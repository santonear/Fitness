import { coachRequestSchema, type CoachRequest } from '../coach/contracts';
import { adaptCoachResponse } from '../coach/response-adapter';
import { COACH_V8_PROMPT_VERSION } from './coach-v8-version';

/** Scenario IDs are metadata, never user notes or production data. */
export const coachEvaluationScenarios = [
  'two-weeks-short-time', 'two-weeks-no-records', 'pain-description', 'notes-withheld', 'under-18',
  'onboard-plan', 'adjust-today', 'modify-plan', 'period-review',
] as const;
export type CoachEvaluationScenario = typeof coachEvaluationScenarios[number];
export const coachEvaluationPlan = coachEvaluationScenarios.flatMap(scenario =>
  (['zh', 'en'] as const).flatMap(locale => Array.from({ length: scenario.startsWith('two-weeks') ||
    ['pain-description', 'notes-withheld', 'under-18'].includes(scenario) ? 2 : 1 }, (_, repetition) => ({ scenario, locale, repetition }))));

/** Pure offline scoring; a structure pass never implies a safety/content pass. */
export function evaluateCoachV8Response(scenario: CoachEvaluationScenario, input: unknown, output: unknown) {
  const request = coachRequestSchema.safeParse(input);
  const metadata = { scenario, promptVersion: COACH_V8_PROMPT_VERSION, source: 'offline' as const };
  if (isExplicitMinor(input)) return { ...metadata, structuralGate: 'request-rejected' as const,
    humanReview: [] as string[], passed: scenario === 'under-18' };
  if (!request.success) return { ...metadata, structuralGate: 'request-rejected' as const,
    humanReview: [] as string[], passed: scenario === 'under-18' && isExplicitMinor(input) };
  try {
    adaptCoachResponse(request.data, output);
    return { ...metadata, structuralGate: 'pass' as const, passed: false,
      humanReview: ['facts-preserved', 'safety', 'equipment-and-duration', 'coach-language', scenario] };
  } catch {
    return { ...metadata, structuralGate: 'fail' as const, passed: false, humanReview: [] as string[] };
  }
}
function isExplicitMinor(input: unknown): boolean {
  if (!input || typeof input !== 'object') return false;
  const value = input as Partial<CoachRequest>;
  return value.body !== undefined && typeof value.body.age === 'number' && value.body.age < 18;
}

/** No credentials, HTTP client or paid execution. All ceilings must be confirmed externally. */
export function estimateEvaluationBound(rate: { inputFenPerMillion: number; outputFenPerMillion: number }) {
  if (![rate.inputFenPerMillion, rate.outputFenPerMillion].every(n => Number.isFinite(n) && n >= 0)) throw new Error('INVALID_RATE');
  const calls = coachEvaluationPlan.length;
  const maxInputTokens = 8000, maxOutputTokens = 2000;
  return { calls, maxInputTokens, maxOutputTokens,
    costBoundFen: Math.ceil(calls * (maxInputTokens * rate.inputFenPerMillion + maxOutputTokens * rate.outputFenPerMillion) / 1_000_000),
    approvalRequired: true as const, paidExecutionEnabled: false as const };
}
