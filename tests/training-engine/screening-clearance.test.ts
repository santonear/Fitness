import { describe, expect, it } from 'vitest';
import { generatePlan } from '../../src/engine';
import { baseProfile } from '../../tools/eval/training-engine-profiles';
import type { EngineProfile } from '../../src/engine/contracts';

function screenedHistory(question: 1 | 2 = 1): EngineProfile {
  const p = baseProfile();
  p.screening.parqAllNo = false;
  p.screening.parqAnswers![question] = true;
  p.screening.completedAt = '2026-10-10T12:00:00.000Z';
  p.screening.lastScreenedAt = '2026-10-10T12:00:00.000Z';
  return p;
}
function clearanceBlocked(profile: EngineProfile) {
  return generatePlan(profile).gates.some(
    gate => gate.status === 'blocked' && gate.ruleId.startsWith('safety.clearance'),
  );
}
describe('explicit screening and user-recorded clearance chronology', () => {
  it('never substitutes parqAllNo or a completion date for seven actual answers', () => {
    const p = baseProfile();
    delete p.screening.parqAnswers;
    const plan = generatePlan(p);
    expect(plan.gates.some(gate => gate.ruleId === 'safety.screen.parq' && gate.status === 'blocked')).toBe(true);
    expect(plan.templates).toEqual([]);
  });
  it('keeps current symptoms blocked even with a recent user-recorded clearance', () => {
    const p = screenedHistory();
    p.screening.symptoms = true;
    p.screening.clearance = { date: '2026-10-14', intensity: 'moderate' };
    expect(clearanceBlocked(p)).toBe(true);
    expect(generatePlan(p).templates).toEqual([]);
  });
  it.each([1, 2] as const)(
    'accepts a later valid attestation for historical PAR-Q question %s without current symptoms',
    question => {
      const p = screenedHistory(question);
      p.screening.clearance = { date: '2026-10-14', intensity: 'moderate' };
      expect(clearanceBlocked(p)).toBe(false);
    },
  );
  it('compares same-day screening and attestation by their recorded local date', () => {
    const p = screenedHistory();
    p.screening.clearance = { date: '2026-10-10', intensity: 'moderate' };
    expect(clearanceBlocked(p)).toBe(false);
  });
  it.each([undefined, '2026-10-09', '2024-10-01', '2026-10-16'])(
    'keeps absent, pre-screen, expired or future clearance blocked: %s',
    date => {
      const p = screenedHistory();
      if (date) p.screening.clearance = { date, intensity: 'moderate' };
      expect(clearanceBlocked(p)).toBe(true);
      expect(generatePlan(p).templates).toEqual([]);
    },
  );
  it('does not let an inconsistent parqAllNo summary erase an actual positive answer', () => {
    const p = screenedHistory();
    p.screening.parqAllNo = true;
    expect(clearanceBlocked(p)).toBe(true);
  });
  it('requires rescreening after the recorded screen has expired', () => {
    const p = baseProfile();
    p.screening.completedAt = '2025-10-01T00:00:00.000Z';
    p.screening.lastScreenedAt = p.screening.completedAt;
    const plan = generatePlan(p);
    expect(plan.gates.some(gate => gate.ruleId === 'safety.rescreen.interval' && gate.status === 'blocked')).toBe(true);
    expect(plan.templates).toEqual([]);
  });
});
