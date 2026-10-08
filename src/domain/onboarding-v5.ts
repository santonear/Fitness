import { type Answer, type OnboardingKey } from './onboarding-v4';

// V5 is a presentation change. Stable V4 field positions remain the persistence contract.
export const stageKeys = ['biologicalSex','age','bodyMetrics','goal','experience','location','equipment','safety','schedule','preferences'] as const;
export const bodyKeys = ['heightCm','weightKg','waistCm'] as const satisfies readonly OnboardingKey[];
const positions = [0,1,2,5,6,7,8,9,10,11,12] as const;
export function storedStep(stage: number): number { return positions[stage] ?? 12; }
export function visibleStep(position: number): number { return position >= 12 ? 10 : position >= 5 ? position - 2 : position >= 2 ? 2 : position; }
export function finishBody(answers: Record<string, Answer>): Record<string, Answer> {
  const result = {...answers};
  for (const key of bodyKeys) result[key] ??= {status:'skipped'};
  return result;
}
