import { addDays, daysBetween, todayIn } from './local-date';
import type { FutureLetter } from './plan-upgrade';

/** 几天后打开 (Bo 2026-10-23): preset waits in days; 7 is the default. A picked date lies between tomorrow and one year out. */
export const LETTER_WAIT_DAYS = [3, 7, 30] as const;
export const DEFAULT_LETTER_WAIT_DAYS = 7;
export const letterDateRange = (today: string) => ({ min: addDays(today, 1), max: addDays(today, 365) });

/** Only a letter with a chosen open date pops up, once that date has come and until it is kept. */
export const letterDue = (letter: FutureLetter, today: string) =>
  !!letter.openOn && letter.openOn <= today && !letter.openedAt;

/** The oldest letter that is due, or undefined. */
export const nextDueLetter = (letters: readonly FutureLetter[], today: string, skip: ReadonlySet<string> = new Set()) =>
  letters
    .filter(letter => letterDue(letter, today) && !skip.has(letter.id))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];

/** A letter's text can be read again once opened, or when it was written before open dates existed. */
export const letterReadable = (letter: FutureLetter, today: string) =>
  !letter.openOn || !!letter.openedAt || letter.openOn <= today;

/** The local date the letter was written on and how many days ago that was. */
export function letterWritten(letter: FutureLetter, today: string, timeZone: string) {
  const date = todayIn(timeZone, letter.createdAt);
  return { date, daysAgo: Math.max(0, daysBetween(date, today)) };
}

const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
/** `{month}`/`{day}` values for letter copy: 10 / 23 in Chinese, October / 23 in English. */
export function letterDateParts(date: string, locale: 'zh' | 'en') {
  const [, month, day] = date.split('-').map(Number);
  return { month: locale === 'zh' ? month : months[month - 1], day };
}
