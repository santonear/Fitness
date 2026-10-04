import { localDateSchema, timeZoneSchema } from './schemas';
const DAY = 86400000;
export const dateProjectionPolicy = 'civil-day-max-overlap-v1';
function formatter(zone: string) { return new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }); }
function label(format: Intl.DateTimeFormat, instant: number): string {
  const parts = format.formatToParts(instant); const get = (type: string) => parts.find(part => part.type === type)!.value;
  return `${get('year').padStart(4, '0')}-${get('month')}-${get('day')}`;
}
/** Lower bounds over a bounded UTC window; no machine-local Date getters. */
export function civilDayInterval(date: string, zone: string): [number, number] | null {
  localDateSchema.parse(date); timeZoneSchema.parse(zone);
  const center = Date.parse(`${date}T12:00:00Z`); const format = formatter(zone);
  function lower(strict: boolean) {
    let low = center - 3 * DAY, high = center + 3 * DAY;
    while (low < high) { const middle = Math.floor((low + high) / 2); const d = label(format, middle);
      if (strict ? d <= date : d < date) low = middle + 1; else high = middle;
    } return low;
  }
  const start = lower(false), end = lower(true);
  return start < end && label(format, start) === date ? [start, end] : null;
}
export function projectDay(date: string, sourceZone: string, calendarZone: string): string | null {
  const interval = civilDayInterval(date, sourceZone); timeZoneSchema.parse(calendarZone);
  if (!interval) return null;
  if (sourceZone === calendarZone) return date;
  const format = formatter(calendarZone); const first = label(format, interval[0]), last = label(format, interval[1] - 1);
  let best: string | null = null, maximum = 0, tied = false;
  for (let instant = Date.parse(`${first}T00:00:00Z`); instant <= Date.parse(`${last}T00:00:00Z`); instant += DAY) {
    const candidate = new Date(instant).toISOString().slice(0, 10); const target = civilDayInterval(candidate, calendarZone);
    if (!target) continue;
    const overlap = Math.max(0, Math.min(interval[1], target[1]) - Math.max(interval[0], target[0]));
    if (overlap > maximum) { maximum = overlap; best = candidate; tied = false; } else if (overlap > 0 && overlap === maximum) tied = true;
  }
  return tied ? null : best;
}
