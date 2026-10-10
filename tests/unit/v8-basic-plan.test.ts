import { describe, expect, it } from 'vitest';
import { basicProposal } from '../../src/application/v8-workflow';
import type { CoachProfile } from '../../src/domain/v8/contracts';
import { localProfile } from '../../src/application/rules/local-profile';
const profile: CoachProfile = { goalText: '活动', weeklyTarget: 2, sessionMinutes: 20, scheduleOriginalText: '每次20分钟', place: 'home', equipment: ['none'], adultConfirmed: true, cautions: [], confirmedAt: '2026-10-10T00:00:00Z' };
describe('local basic plan', () => {
  it('keeps short answers and chooses the lowest allowed slot in a range', () => {
    const answers = { goalText: '活动', scheduleOriginalText: '每周2次，每次30–45分钟', placeEquipmentText: '在家', adultConfirmed: true, cautions: [] };
    expect(localProfile(answers).sessionMinutes).toBe(30);
    expect(localProfile({ ...answers, scheduleOriginalText: '每次20分钟' }).sessionMinutes).toBe(20);
    expect(() => localProfile({ ...answers, placeEquipmentText: '待定' })).toThrow();
  });
  it.each([15, 20, 30, 120])('respects %s minute capacity using shared estimate', minutes => {
    const proposal = basicProposal({ ...profile, sessionMinutes: minutes })!;
    expect(proposal.templates).toHaveLength(2); expect(proposal.templates.every(t => t.estimatedMinutes <= minutes)).toBe(true);
    expect(proposal.sessionMinutes).toBe(minutes); expect(proposal.scheduleOriginalText).toBe(profile.scheduleOriginalText);
  });
  it('does not generate adult advice for minors or guess suitability for limitations', () => {
    expect(basicProposal({ ...profile, adultConfirmed: false })).toBeUndefined();
    expect(basicProposal({ ...profile, cautions: ['knee'] })).toBeUndefined();
  });
});
