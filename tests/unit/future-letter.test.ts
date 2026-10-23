import { describe, expect, it } from 'vitest';
import {
  letterDateParts,
  letterDateRange,
  letterDue,
  letterReadable,
  letterWritten,
  nextDueLetter,
} from '../../src/domain/future-letter';
import type { FutureLetter } from '../../src/domain/plan-upgrade';
import { futureLetterSchema } from '../../src/domain/schemas';

const letter = (id: string, createdAt: string, extra: Partial<FutureLetter> = {}): FutureLetter => ({
  id,
  text: id,
  createdAt,
  ...extra,
});

describe('未来来信 (Bo 2026-10-23)', () => {
  const today = '2026-10-30';
  it('never pops up a letter without an open date, an opened letter or one not yet due', () => {
    expect(letterDue(letter('legacy', '2026-10-01T00:00:00.000Z'), today)).toBe(false);
    const opened = letter('opened', '2026-10-01T00:00:00.000Z', {
      openOn: '2026-10-08',
      openedAt: '2026-10-08T01:00:00.000Z',
    });
    expect(letterDue(opened, today)).toBe(false);
    expect(letterDue(letter('later', '2026-10-01T00:00:00.000Z', { openOn: '2026-10-31' }), today)).toBe(false);
    expect(letterDue(letter('today', '2026-10-23T00:00:00.000Z', { openOn: today }), today)).toBe(true);
  });

  it('opens the oldest due letter first and skips ones set aside with 稍后再看', () => {
    const rows = [
      letter('newer', '2026-10-20T00:00:00.000Z', { openOn: '2026-10-23' }),
      letter('legacy', '2026-09-01T00:00:00.000Z'),
      letter('older', '2026-10-10T00:00:00.000Z', { openOn: '2026-10-29' }),
      letter('future', '2026-10-01T00:00:00.000Z', { openOn: '2026-11-01' }),
    ];
    expect(nextDueLetter(rows, today)?.id).toBe('older');
    expect(nextDueLetter(rows, today, new Set(['older']))?.id).toBe('newer');
    expect(nextDueLetter(rows, today, new Set(['older', 'newer']))).toBeUndefined();
    expect(nextDueLetter([], today)).toBeUndefined();
  });

  it('lets 自记录 reread opened and older letters but hides the text of letters not yet due', () => {
    expect(letterReadable(letter('legacy', '2026-10-01T00:00:00.000Z'), today)).toBe(true);
    expect(letterReadable(letter('due', '2026-10-01T00:00:00.000Z', { openOn: '2026-10-08' }), today)).toBe(true);
    expect(letterReadable(letter('sealed', '2026-10-01T00:00:00.000Z', { openOn: '2026-11-08' }), today)).toBe(false);
  });

  it('counts days from the local day it was written and limits a picked date to tomorrow … one year', () => {
    // 2026-10-22 23:30 UTC is already 10-23 in Shanghai.
    expect(letterWritten(letter('x', '2026-10-22T23:30:00.000Z'), today, 'Asia/Shanghai')).toEqual({
      date: '2026-10-23',
      daysAgo: 7,
    });
    expect(letterDateRange('2026-10-23')).toEqual({ min: '2026-10-24', max: '2027-10-23' });
    expect(letterDateParts('2026-10-23', 'zh')).toEqual({ month: 10, day: 23 });
    expect(letterDateParts('2026-10-23', 'en')).toEqual({ month: 'October', day: 23 });
  });

  it('accepts an optional real local date only', () => {
    const base = { id: crypto.randomUUID(), text: '信', createdAt: '2026-10-23T00:00:00.000Z' };
    expect(futureLetterSchema.safeParse(base).success).toBe(true);
    expect(futureLetterSchema.safeParse({ ...base, openOn: '2026-10-30' }).success).toBe(true);
    for (const openOn of ['2026-02-30', '2026-10-30T00:00:00Z', '', '30/10/2026'])
      expect(futureLetterSchema.safeParse({ ...base, openOn }).success, openOn).toBe(false);
  });
});
