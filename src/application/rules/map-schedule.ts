import type { MapSchedule, OnboardingMinutes } from '../../domain/v8/contracts';

const legalMinutes: readonly OnboardingMinutes[] = [30, 40, 50, 60, 70, 80, 90, 100, 110, 120];
const unit = '(分钟|分鐘|minutes?|mins?|小时|小時|hours?|hrs?)';
const number = '(\\d+(?:\\.\\d+)?)';
const duration = new RegExp(`${number}\\s*${unit}?\\s*(?:[-–—~～至到]|\\bto\\b)\\s*${number}\\s*${unit}|${number}\\s*${unit}`, 'gi');
const inMinutes = (value: string, suffix: string) => Number(value) * (/小时|小時|hour|hr/i.test(suffix) ? 60 : 1);

/** Part 3 B: this maps the legacy slot only; original text remains available to plan generation. */
export const mapSchedule: MapSchedule = originalText => {
  const result: ReturnType<MapSchedule> = { originalText, minutes: { status: 'skipped' }, startTime: { status: 'skipped' } };
  const text = originalText.trim();
  if (/帮我定|幫我定|help me decide|you decide/i.test(text)) return result;
  let low: number;
  let high: number;
  if (/^\d+$/.test(text)) low = high = Number(text);
  else {
    const matches = [...text.matchAll(duration)];
    if (matches.length !== 1) return result;
    const match = matches[0];
    // A leftover alternative/range/negative sign is ambiguous, not a second answer to discard.
    const prefix = text.slice(0, match.index);
    if (/[\d或/\-–—~～至到.]\s*$/.test(prefix)) return result;
    if (match[1]) {
      low = inMinutes(match[1], match[2] ?? match[4]);
      high = inMinutes(match[3], match[4]);
    } else low = high = inMinutes(match[5], match[6]);
  }
  const value = legalMinutes.find(candidate => candidate >= low && candidate <= high);
  if (value !== undefined) result.minutes = { status: 'answered', value };
  return result;
};
