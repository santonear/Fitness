import { describe, expect, it } from 'vitest';
import { DAY_MS, DEFAULT_TIME_ZONE, addDays, daysBetween, isLocalDate, todayIn, weekStart } from '../../src/domain/local-date';

describe('local dates', () => {
  it('checks real calendar dates only', () => {
    expect(isLocalDate('2026-10-22')).toBe(true);
    expect(isLocalDate('2028-02-29')).toBe(true);
    for (const bad of ['2026-02-29', '2026-13-01', '2026-04-31', '2026-1-01', '2026-10-22T00:00:00Z', '']) expect(isLocalDate(bad)).toBe(false);
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2026-10-22', 0)).toBe('2026-10-22');
  });

  it('counts whole days, negative when going back', () => {
    expect(daysBetween('2026-12-25', '2027-01-08')).toBe(14);
    expect(daysBetween('2027-01-08', '2026-12-25')).toBe(-14);
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
    expect(DAY_MS).toBe(24 * 60 * 60 * 1000);
  });

  it('finds the Monday of a week, also across a year', () => {
    expect(weekStart('2026-10-19')).toBe('2026-10-19');
    expect(weekStart('2026-10-25')).toBe('2026-10-19');
    expect(weekStart('2027-01-02')).toBe('2026-12-28');
  });

  it('reads today in the given time zone, not in UTC', () => {
    // 00:30 in Shanghai is still the previous day in UTC.
    const justAfterMidnight = Date.parse('2026-10-21T16:30:00Z');
    expect(DEFAULT_TIME_ZONE).toBe('Asia/Shanghai');
    expect(todayIn(DEFAULT_TIME_ZONE, justAfterMidnight)).toBe('2026-10-22');
    expect(todayIn('UTC', justAfterMidnight)).toBe('2026-10-21');
    expect(todayIn('Asia/Shanghai', new Date('2026-12-31T16:00:00Z'))).toBe('2027-01-01');
    expect(todayIn('Pacific/Honolulu', '2027-01-01T05:00:00Z')).toBe('2026-12-31');
    expect(todayIn('UTC', '2026-10-21T23:59:59Z')).toBe('2026-10-21');
  });
});
