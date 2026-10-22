import type { WorkoutRecord } from '../domain/v8/contracts';
import { Rules, calendarDay } from '../engine/data';
import { DAY_MS as DAY } from '../domain/local-date';
interface ActivityEvidenceInput {
  records: readonly WorkoutRecord[];
  asOfDate: string;
  timeZone: string;
  weeklyTarget: number;
  screeningEvents?: readonly { answeredAt: string; symptoms: boolean }[];
}
function monday(day: string): number {
  const stamp = Date.parse(day + 'T00:00:00Z');
  return stamp - ((new Date(stamp).getUTCDay() + 6) % 7) * DAY;
}
/** Closed local calendar weeks only; training age and missing reports are never evidence. */
export function deriveActivityEvidence(
  input: ActivityEvidenceInput,
  rules = new Rules(),
): { consecutiveRegularWeeks: number; noSymptomReportsWeeks: number; missingEvidence: string[] } {
  const zero = {
    consecutiveRegularWeeks: 0,
    noSymptomReportsWeeks: 0,
    missingEvidence: ['general_symptom_report_coverage'],
  };
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.asOfDate) ||
    calendarDay(input.asOfDate) !== input.asOfDate ||
    !Number.isInteger(input.weeklyTarget) ||
    input.weeklyTarget <= 0
  )
    return zero;
  try {
    new Intl.DateTimeFormat('en', { timeZone: input.timeZone });
  } catch {
    return zero;
  }
  const source = rules.get('safety.unlock.regular_week');
  const current = monday(input.asOfDate),
    weeks = new Map<number, { completed: number; symptom: boolean }>(),
    seen = new Set<string>();
  for (const record of input.records) {
    if (seen.has(record.id)) return zero;
    seen.add(record.id);
    const day = calendarDay(record.endedAt ?? record.startedAt, input.timeZone);
    if (!day || day > input.asOfDate) continue;
    const week = monday(day);
    if (week >= current) continue;
    const value = weeks.get(week) ?? { completed: 0, symptom: false };
    const actual = new Set(record.sets.map(set => `${set.itemIndex}:${set.setIndex}`)).size;
    if (
      record.status === 'complete' &&
      record.endedAt &&
      record.plannedSetCount > 0 &&
      actual / record.plannedSetCount >= source.completion_rate_min
    )
      value.completed++;
    if (
      record.feedback?.reasons.includes('discomfort') ||
      record.feedback?.discomfortExerciseIds?.length ||
      record.setFeedbackEvents?.some(e => e.effort === 'discomfort') ||
      record.checkin?.newOrWorseJointPain === true ||
      record.painReviewRequired ||
      record.postpartumSymptoms?.some(e => e.urgent.length > 0 || e.regression.length > 0)
    )
      value.symptom = true;
    weeks.set(week, value);
  }
  const reports = new Map<number, { negative: boolean; positive: boolean }>();
  for (const event of input.screeningEvents ?? []) {
    const day = calendarDay(event.answeredAt, input.timeZone);
    if (!day || day > input.asOfDate) continue;
    const week = monday(day);
    if (week >= current) continue;
    const report = reports.get(week) ?? { negative: false, positive: false };
    if (event.symptoms === true) report.positive = true;
    else if (event.symptoms === false) report.negative = true;
    reports.set(week, report);
  }
  let regular = 0,
    misses = 0,
    noSymptoms = 0,
    symptomStreak = true,
    missing = false;
  const starts = [...weeks.keys()].filter(week => week < current);
  if (!starts.length) return zero;
  const oldest = Math.min(...starts);
  for (let week = current - 7 * DAY; week >= oldest; week -= 7 * DAY) {
    const value = weeks.get(week),
      report = reports.get(week),
      symptomFree = !!report?.negative && !report.positive && !value?.symptom;
    if (!report?.negative) missing = true;
    if (
      symptomStreak &&
      symptomFree &&
      !!value &&
      value.completed >= source.sessions_completed_min &&
      value.completed / input.weeklyTarget >= source.completion_rate_min
    )
      noSymptoms++;
    else symptomStreak = false;
    const qualified =
      !!value &&
      value.completed >= source.sessions_completed_min &&
      value.completed / input.weeklyTarget >= source.completion_rate_min &&
      (!source.no_symptom_reports || symptomFree);
    if (qualified) {
      regular++;
      misses = 0;
    } else if (++misses >= source.reset_after_consecutive_non_qualifying_weeks) break;
  }
  return {
    consecutiveRegularWeeks: regular,
    noSymptomReportsWeeks: noSymptoms,
    missingEvidence: missing ? zero.missingEvidence : [],
  };
}
