import { DomainError } from '../errors';
import type { OnboardingMinutes } from './contracts';

const onboardingMinutes: readonly OnboardingMinutes[] = [30, 40, 50, 60, 70, 80, 90, 100, 110, 120];
const legalTemplateMinutes = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 15 && value <= 120;

/** The migration caller supplies the same estimator used by base-plan generation. */
export function legacyTemplateMinutes(rawMinutes: unknown, estimate: () => number): { minutes: number; estimated: boolean } {
  if (legalTemplateMinutes(rawMinutes)) return { minutes: rawMinutes, estimated: false };
  const estimateMinutes = estimate();
  if (!Number.isFinite(estimateMinutes)) throw new DomainError('INVALID', 'Duration estimation must be finite');
  return { minutes: Math.max(15, Math.min(120, estimateMinutes)), estimated: true };
}

/** Preserve the legal onboarding slot; otherwise use the median of actual template durations. */
export function legacyPlanMinutes(onboardingSlot: unknown, templateMinutes: readonly number[]): number {
  if (typeof onboardingSlot === 'number' && onboardingMinutes.some(value => value === onboardingSlot)) return onboardingSlot;
  if (!templateMinutes.length || templateMinutes.some(value => !legalTemplateMinutes(value))) {
    throw new DomainError('INVALID', 'Migration requires valid template durations');
  }
  const ordered = [...templateMinutes].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}
