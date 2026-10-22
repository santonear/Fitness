/**
 * Local calendar dates (YYYY-MM-DD). One home for date arithmetic so every layer counts days the
 * same way: dates are treated as UTC midnights, so no machine-local getter or DST shift is involved.
 */
export const DAY_MS = 86_400_000;
/** Time zone used when the user has not saved one. */
export const DEFAULT_TIME_ZONE = 'Asia/Shanghai';

const datePattern = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
/** A real calendar date in YYYY-MM-DD form (rejects 2026-02-30). */
export const isLocalDate = (value: string) =>
  datePattern.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const dayNumber = (date: string) => Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
/** Whole days from `from` to `to` (negative when `to` is earlier). */
export const daysBetween = (from: string, to: string) => dayNumber(to) - dayNumber(from);
export const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
/** Monday of the week that contains `date`. */
export const weekStart = (date: string) => addDays(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7));

/** The local date in `timeZone` at the instant `now` (default: now). */
export function todayIn(timeZone: string, now: Date | number | string = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(now));
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-');
}
/** The UTC calendar date of an instant, for UTC day buckets and for dates already held as UTC midnights. */
export const utcDay = (at: Date | number | string = new Date()) => new Date(at).toISOString().slice(0, 10);
