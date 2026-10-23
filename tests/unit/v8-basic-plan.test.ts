import { describe, expect, it } from 'vitest';
import { basicProposal } from '../../src/application/v8-workflow';
import { localProfile } from '../../src/application/rules/local-profile';
import { basicItems } from '../../src/application/rules/basic-items';
import type { CoachProfile } from '../../src/domain/v8/contracts';
const profile: CoachProfile = {
  goalText: '活动',
  weeklyTarget: 2,
  sessionMinutes: 20,
  scheduleOriginalText: '每次20分钟',
  place: 'home',
  equipment: ['none'],
  adultConfirmed: true,
  cautions: [],
  confirmedAt: '2026-10-10T00:00:00Z',
};
describe('local basic plan', () => {
  it.each([15, 20, 30, 120])('respects %s minute capacity with four real movements', minutes => {
    const p = basicProposal({ ...profile, sessionMinutes: minutes })!;
    expect(p.templates).toHaveLength(2);
    for (const t of p.templates) {
      expect(t.items.length).toBeGreaterThanOrEqual(4);
      expect(t.estimatedMinutes).toBeLessThanOrEqual(minutes);
    }
    expect(p.sessionMinutes).toBe(minutes);
  });
  // ch13 duration.fit.tolerance: estimate within ±10% of the chosen length whenever the safe pool can fill it.
  it.each([15, 20, 30, 45, 60, 75, 90])('fits a %s minute fat-loss session within ±10%%', minutes => {
    const p = basicProposal({ ...profile, goalText: '减脂', equipment: ['哑铃', '弹力带'], sessionMinutes: minutes })!;
    for (const t of p.templates) {
      expect(t.estimatedMinutes).toBeGreaterThanOrEqual(minutes * 0.9);
      expect(t.estimatedMinutes).toBeLessThanOrEqual(minutes * 1.1);
      const walk = t.items.find(item => item.target.metricType === 'duration_distance')!;
      expect(walk.target).toMatchObject({ durationSeconds: expect.any(Number) });
      expect((walk.target as { durationSeconds: number }).durationSeconds).toBeLessThanOrEqual(600);
    }
  });
  it('keeps the walk capped and discloses a shorter session once the safe pool is exhausted', () => {
    const p = basicProposal({ ...profile, goalText: '减脂', sessionMinutes: 120 })!;
    for (const t of p.templates) {
      expect(t.estimatedMinutes).toBeLessThan(120);
      expect(t.items.filter(item => item.target.metricType === 'duration_distance')).toEqual([
        expect.objectContaining({ target: expect.objectContaining({ durationSeconds: 600 }) }),
      ]);
    }
    expect(p.reasons[1]).toContain(String(p.templates[0].estimatedMinutes));
  });
  it('keeps short words and maps ranges to smallest legal slot', () => {
    const a = {
      goalText: '活动',
      scheduleOriginalText: '每周2次，每次30–45分钟',
      placeEquipmentText: '在家',
      adultConfirmed: true,
      cautions: [],
    };
    expect(localProfile(a).sessionMinutes).toBe(30);
    expect(localProfile({ ...a, scheduleOriginalText: '每次20分钟' }).sessionMinutes).toBe(20);
    expect(() => localProfile({ ...a, placeEquipmentText: '待定' })).toThrow();
  });
  it('does not generate for minors', () =>
    expect(basicProposal({ ...profile, adultConfirmed: false })).toBeUndefined());
  it.each(['knee', 'back', 'shoulder', 'wrist'] as const)('keeps an adapted draft for %s', area => {
    const p = basicProposal({ ...profile, cautions: [area] })!;
    expect(p).toBeDefined();
    expect(Array.isArray(p.templates)).toBe(true);
    expect(p.reasons[1]).toContain('排除');
  });
  it('collapses identical safety-limited templates without changing weekly target', () => {
    const result = basicProposal({ ...profile, cautions: ['knee', 'shoulder', 'wrist'] })!;
    expect(result.templates).toHaveLength(1);
    expect(result.templates[0].items.length).toBeLessThan(4);
    expect(result.weeklyTarget).toBe(profile.weeklyTarget);
  });
  it('keeps an empty unsavable draft instead of guessing for unspecified limitations', () => {
    const p = basicProposal({ ...profile, cautions: ['other'] })!;
    expect(p.templates).toEqual([]);
    expect(p.reasons[2]).toContain('已保留');
  });
  it('uses only confirmed equipment and excludes loaded pulling with back limitations', () => {
    const body = basicItems(profile, 1).items;
    expect(body.every(i => i.equipment === 'none')).toBe(true);
    const weighted = basicItems({ ...profile, equipment: ['哑铃'] }, 1).items;
    expect(weighted.some(i => i.equipment === 'dumbbell')).toBe(true);
    expect(
      basicItems({ ...profile, equipment: ['哑铃'], cautions: ['back'] }, 1).items.every(
        i => i.equipment !== 'dumbbell' || i.exerciseId === '189798ab-984f-52b5-86aa-be66ed00289a',
      ),
    ).toBe(true);
  });
});
