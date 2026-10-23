import { describe, expect, it } from 'vitest';
import { escapeText, foldLine, trainingCalendar } from '../../src/application/calendar-export';
import type { PlanVersion } from '../../src/domain/v8/contracts';

const template = (id: string, minutes: number, weekday?: string) =>
  ({ id, name: id, estimatedMinutes: minutes, items: [], ...(weekday ? { weekday } : {}) }) as never;
const base = {
  weeklyTarget: 2,
  templates: [template('A', 40, 'mon'), template('B', 25, 'thu')],
} as unknown as PlanVersion;
const copy = { summary: 'Fitness 训练', description: '只是提醒，不代表那天必须练。' };
const now = new Date('2026-10-23T08:09:10.123Z');
const unfold = (ics: string) => ics.replace(/\r\n /g, '');

describe('calendar export (.ics)', () => {
  it('escapes commas, semicolons, backslashes and newlines', () => {
    expect(escapeText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
  });

  it('folds long lines at 75 octets without splitting a UTF-8 character', () => {
    const line = `DESCRIPTION:${'练'.repeat(40)}`;
    const folded = foldLine(line);
    const parts = folded.split('\r\n');
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(parts.slice(1).every(part => part.startsWith(' '))).toBe(true);
    expect(unfold(folded)).toBe(line);
    expect(foldLine('SHORT:x')).toBe('SHORT:x');
  });

  it('repeats fixed weekdays weekly from the next such date, with CRLF endings', () => {
    // 2026-10-23 is a Friday.
    const ics = trainingCalendar({ plan: base, today: '2026-10-23', time: '07:15', now, ...copy })!;
    expect(ics.endsWith('\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/\n/);
    const text = unfold(ics);
    expect(text).toContain('DTSTART:20261026T071500\r\nDURATION:PT40M\r\nRRULE:FREQ=WEEKLY;BYDAY=MO');
    expect(text).toContain('DTSTART:20261029T071500\r\nDURATION:PT25M\r\nRRULE:FREQ=WEEKLY;BYDAY=TH');
    expect(text).toContain('UID:fitness-mon@fitness.initdevl.workers.dev');
    expect(text).toContain('DTSTAMP:20261023T080910Z');
    expect(text).toContain('DESCRIPTION:只是提醒，不代表那天必须练。');
    expect(text).toContain('TRIGGER:-PT10M');
    expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });

  it('never starts before the plan start date and defaults to 19:30', () => {
    const text = unfold(trainingCalendar({ plan: base, today: '2026-10-23', startDate: '2026-11-03', now, ...copy })!);
    expect(text).toContain('DTSTART:20261109T193000');
    expect(text).toContain('DTSTART:20261105T193000');
  });

  it('lists upcoming picked dates one by one within about eight weeks', () => {
    const plan = {
      ...base,
      templates: [template('A', 0)],
      trainingDates: ['2026-10-20', '2026-10-24', '2026-11-02', '2027-01-10'],
    } as unknown as PlanVersion;
    const text = unfold(trainingCalendar({ plan, today: '2026-10-23', time: 'bad', now, ...copy })!);
    expect(text).not.toContain('RRULE');
    expect(text).toContain('UID:fitness-2026-10-24@fitness.initdevl.workers.dev');
    expect(text).toContain('DTSTART:20261102T193000\r\nDURATION:PT30M');
    expect(text).not.toContain('20261020');
    expect(text).not.toContain('20270110');
    expect(trainingCalendar({ plan: { ...plan, trainingDates: ['2026-10-01'] }, today: '2026-10-23', ...copy })).toBe(
      undefined,
    );
  });
});
