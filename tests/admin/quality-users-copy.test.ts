import { describe, expect, it } from 'vitest';
import { userLabel, userLabels, type UserLabelGroup } from '../../src/ui/admin/users/copy';
describe('admin user enum copy', () => {
  it('maps every declared enum into Chinese and English without exposing raw values', () => {
    for (const group of Object.keys(userLabels) as UserLabelGroup[]) for (const value of Object.keys(userLabels[group])) {
      expect(userLabel(group, value, 'zh')).toMatch(/[\u3400-\u9fff]/);
      expect(userLabel(group, value, 'zh')).not.toContain(value);
      expect(userLabel(group, value, 'en')).toMatch(/[A-Za-z]/);
      expect(userLabel(group, value, 'en')).not.toBe(value);
    }
  });
  it('covers each live backend request status and application kind', () => {
    for (const status of ['reserved','submitted','pending','settled','released']) expect(userLabel('requestStatus',status)).not.toBe('其他或尚未记录');
    for (const kind of ['new','extend','replace']) expect(userLabel('applicationKind',kind)).not.toBe('其他或尚未记录');
    for (const status of ['pending','approved','rejected','claimed']) expect(userLabel('applicationState',status)).not.toBe('其他或尚未记录');
  });
  it('never surfaces unknown backend fields as raw text', () => {
    expect(userLabel('event','PRIVATE_HEALTH_SENTINEL')).toBe('其他或尚未记录');
    expect(userLabel('requestStatus','new_future_state','en')).toBe('Other / not recorded');
  });
});
