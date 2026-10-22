import { describe, expect, it } from 'vitest';
import { createContext, generatePlan } from '../../../src/engine/pipeline';
import { runGates } from '../../../src/engine/gates';
import { baseProfile } from '../../../tools/eval/training-engine-profiles';

describe('generation seed separates audit times from medical evidence', () => {
  it('keeps equal answers deterministic across screening submission times', () => {
    const first = baseProfile({
      daysPerWeek: 1,
      sessionMinutes: 10,
      trainingAgeWeeks: 0,
    });
    const second = structuredClone(first);
    first.screening.completedAt = first.screening.lastScreenedAt = '2026-10-15T01:00:00.000Z';
    second.screening.completedAt = second.screening.lastScreenedAt = '2026-10-15T02:00:00.000Z';
    const before = structuredClone([first, second]);
    expect(createContext(first).profileHash).toBe(createContext(second).profileHash);
    expect(generatePlan(first)).toEqual(generatePlan(second));
    expect(createContext(first, 1).profileHash).not.toBe(createContext(first, 0).profileHash);
    expect([first, second]).toEqual(before);
  });
  it('still evaluates expiry using the unchanged actual profile', () => {
    const current = baseProfile(),
      expired = structuredClone(current);
    expired.screening.completedAt = expired.screening.lastScreenedAt = '2020-01-01T00:00:00.000Z';
    const before = structuredClone(expired),
      context = createContext(expired);
    expect(context.profile).toBe(expired);
    expect(context.gate).toEqual(runGates(expired));
    expect(context.gate.reasons).not.toEqual(createContext(current).gate.reasons);
    expect(context.profileHash).not.toBe(createContext(current).profileHash);
    expect(expired).toEqual(before);
  });
  it('retains different medical answers and clinical dates in the seed', () => {
    const first = baseProfile(),
      second = structuredClone(first);
    second.screening.acuteIllness = true;
    expect(createContext(first).profileHash).not.toBe(createContext(second).profileHash);
    second.screening.acuteIllness = false;
    second.asOfDate = '2026-10-16';
    expect(createContext(first).profileHash).not.toBe(createContext(second).profileHash);
  });
  it('normalizes joint-review audit times without accepting answers before the request', () => {
    const first = baseProfile({ cautions: ['knee'] }),
      second = structuredClone(first);
    first.screening.redFlagReview!.requiredAt = '2026-10-15T01:00:00.000Z';
    first.screening.redFlagReview!.answeredAt = '2026-10-15T02:00:00.000Z';
    second.screening.redFlagReview!.requiredAt = '2026-10-15T03:00:00.000Z';
    second.screening.redFlagReview!.answeredAt = '2026-10-15T04:00:00.000Z';
    expect(createContext(first).profileHash).toBe(createContext(second).profileHash);
    second.screening.redFlagReview!.answeredAt = '2026-10-15T02:00:00.000Z';
    const before = structuredClone(second),
      context = createContext(second);
    expect(context.gate.status).toBe('blocked');
    expect(context.gate).toEqual(runGates(second));
    expect(context.profileHash).not.toBe(createContext(first).profileHash);
    expect(second).toEqual(before);
  });
  it('normalizes advisory audit times but retains the exact screening-link check', () => {
    const first = baseProfile({ birthYearMonth: '1960-01' }),
      second = structuredClone(first);
    first.screening.completedAt = '2026-10-15T01:00:00.000Z';
    first.screening.age45AdvisoryAck = {
      screenedAt: first.screening.completedAt,
      acknowledgedAt: '2026-10-15T02:00:00.000Z',
    };
    second.screening.completedAt = '2026-10-15T03:00:00.000Z';
    second.screening.age45AdvisoryAck = {
      screenedAt: second.screening.completedAt,
      acknowledgedAt: '2026-10-15T04:00:00.000Z',
    };
    expect(createContext(first).profileHash).toBe(createContext(second).profileHash);
    second.screening.age45AdvisoryAck.screenedAt = first.screening.completedAt;
    expect(createContext(second).gate.reasons).not.toEqual(createContext(first).gate.reasons);
    expect(createContext(second).profileHash).not.toBe(createContext(first).profileHash);
  });
});
