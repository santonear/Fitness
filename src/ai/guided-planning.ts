import { dateInZone } from '../application/progress';

/** Calendar arithmetic after resolving the user's local date, including DST changes. */
export function nextPlanningWindow(now: number, timeZone: string, days = 7) {
  if (!Number.isInteger(days) || days < 1 || days > 14) throw new Error('Planning range must be 1–14 days');
  const today = Date.parse(`${dateInZone(now, timeZone)}T00:00:00Z`);
  const dates = Array.from({ length: days }, (_, index) => new Date(today + (index + 1) * 86400000).toISOString().slice(0, 10));
  return { startDate: dates[0], endDate: dates[days - 1], dates };
}
