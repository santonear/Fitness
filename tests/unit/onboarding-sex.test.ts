import { describe, expect, it } from 'vitest';
import { biologicalSexAnswerSchema, onboardingSchema } from '../../src/domain/guided-contracts';

describe('onboarding biological sex', () => {
  const old = { id: '00000000-0000-4000-8000-000000000001', step: 12, answers: {}, completed: true, updatedAt: '2026-10-07T00:00:00Z' };
  it('preserves older completed profiles without fabricating a sex answer', () => {
    expect(onboardingSchema.parse(old)).toEqual(old);
  });
  it.each(['女性', '男性', '其他或不确定', '不愿透露'])('round trips explicit %s independently of locale', value => {
    const input = { ...old, answers: { biologicalSex: { status: 'answered', value } } };
    expect(onboardingSchema.parse(JSON.parse(JSON.stringify(input)))).toEqual(input);
  });
  it('does not accept a skip, fabricated value or array as a required response', () => {
    for (const answer of [{ status: 'skipped' }, { status: 'answered', value: 'healthy' }, { status: 'answered', value: ['女性'] }]) {
      expect(biologicalSexAnswerSchema.safeParse(answer).success).toBe(false);
      expect(onboardingSchema.safeParse({ ...old, answers: { biologicalSex: answer } }).success).toBe(false);
    }
  });
});
