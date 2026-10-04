import { expect, it } from 'vitest';
import { civilDayInterval, projectDay } from '../../src/domain/day-date-projection';
it('maps same-zone dates without UTC shifting', () => expect(projectDay('2027-01-04', 'Asia/Shanghai', 'Asia/Shanghai')).toBe('2027-01-04'));
it('measures spring and autumn DST civil days', () => {
  const a = civilDayInterval('2027-03-14', 'America/New_York')!;
  const b = civilDayInterval('2027-11-07', 'America/New_York')!;
  expect(a[1] - a[0]).toBe(23 * 3600000); expect(b[1] - b[0]).toBe(25 * 3600000);
});
it('handles cross-date projection and genuine tied overlap', () => {
  expect(projectDay('2027-01-04', 'Pacific/Kiritimati', 'Pacific/Honolulu')).toBe('2027-01-03');
  expect(projectDay('2027-01-04', 'Etc/GMT-12', 'UTC')).toBeNull();
});
it('returns review-needed for a historical skipped civil day', () => expect(civilDayInterval('2011-12-30', 'Pacific/Apia')).toBeNull());
it('rejects invalid dates/zones', () => { expect(() => projectDay('2027-02-30', 'UTC', 'UTC')).toThrow(); expect(() => civilDayInterval('2027-01-01', 'invalid')).toThrow(); });
