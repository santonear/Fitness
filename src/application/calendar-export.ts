import type { PlanVersion } from '../domain/v8/contracts';
import { addDays } from '../domain/local-date';
import { weekSchedule, weekdayOf, type Weekday } from './plan-presentation';
import { sessionForDate, timePattern } from './training-dates';

/**
 * 添加到手机日历: an iCalendar file (RFC 5545) built on the device from the plan's schedule.
 * Fixed weekdays become weekly repeating events; calendar-picked days become one event each.
 * Times are floating local times (no TZID), so the phone shows them at the same clock time.
 */
export const DEFAULT_CALENDAR_TIME = '19:30';
const DEFAULT_MINUTES = 30;
/** Picked days further ahead than this are left out. */
const PICKED_WINDOW_DAYS = 56;
const UID_DOMAIN = 'fitness.initdevl.workers.dev';
const BYDAY: Record<Weekday, string> = { mon: 'MO', tue: 'TU', wed: 'WE', thu: 'TH', fri: 'FR', sat: 'SA', sun: 'SU' };

/** TEXT value escaping (RFC 5545 §3.3.11). */
export const escapeText = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Folds a content line at 75 octets (RFC 5545 §3.1) without splitting a UTF-8 character. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder(),
    parts: string[] = [];
  let current = '',
    size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    // Continuation lines start with one space, which counts toward their 75 octets.
    if (size + bytes > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = '';
      size = 0;
    }
    current += char;
    size += bytes;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

const compactDate = (date: string) => date.replaceAll('-', '');
const utcStamp = (now: Date) => now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');

export interface TrainingCalendarInput {
  plan: Pick<PlanVersion, 'weeklyTarget' | 'preferredDays' | 'templates'> & Partial<Pick<PlanVersion, 'trainingDates'>>;
  /** Today's local date (YYYY-MM-DD). */
  today: string;
  /** Plan start; nothing is placed before it. */
  startDate?: string;
  /** HH:MM local start time; falls back to 19:30. */
  time?: string;
  summary: string;
  description: string;
  now?: Date;
}

/** The .ics text, or undefined when there is no upcoming training day to add. */
export function trainingCalendar(input: TrainingCalendarInput): string | undefined {
  const { plan, today, summary, description } = input;
  const from = input.startDate && input.startDate > today ? input.startDate : today;
  const time = input.time && timePattern.test(input.time) ? input.time : DEFAULT_CALENDAR_TIME;
  const minutes = (templateId: string | undefined) => {
    const value = plan.templates.find(template => template.id === templateId)?.estimatedMinutes;
    return value && value > 0 ? Math.round(value) : DEFAULT_MINUTES;
  };
  const events: { uid: string; date: string; minutes: number; rule?: string }[] = [];
  if (plan.trainingDates?.length) {
    for (const date of plan.trainingDates)
      if (date >= from && date <= addDays(today, PICKED_WINDOW_DAYS))
        events.push({ uid: date, date, minutes: minutes(sessionForDate(plan, date)) });
  } else {
    for (const session of weekSchedule(plan).sessions) {
      let date = from;
      while (weekdayOf(date) !== session.day) date = addDays(date, 1);
      events.push({
        uid: session.day,
        date,
        minutes: minutes(session.templateId),
        rule: `FREQ=WEEKLY;BYDAY=${BYDAY[session.day]}`,
      });
    }
  }
  if (!events.length) return undefined;
  const stamp = utcStamp(input.now ?? new Date()),
    clock = `${time.replace(':', '')}00`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Fitness//Training calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events
      .sort((a, b) => a.date.localeCompare(b.date))
      .flatMap(event => [
        'BEGIN:VEVENT',
        `UID:fitness-${event.uid}@${UID_DOMAIN}`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${compactDate(event.date)}T${clock}`,
        `DURATION:PT${event.minutes}M`,
        ...(event.rule ? [`RRULE:${event.rule}`] : []),
        `SUMMARY:${escapeText(summary)}`,
        `DESCRIPTION:${escapeText(description)}`,
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:${escapeText(summary)}`,
        'TRIGGER:-PT10M',
        'END:VALARM',
        'END:VEVENT',
      ]),
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
