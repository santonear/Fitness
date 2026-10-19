import type { CoachRequest, PickedSchedule } from '../coach/contracts';
import { preferredTrainingDays } from './rules/local-profile';

/**
 * Calendar-picked training days stay fixed through every AI conversation (Bo 2026-10-19):
 * the model is told the dates, the server never chooses weekdays for them, and an AI proposal
 * keeps them unless the user explicitly asked, in that conversation, to change the days.
 */
export function pickedSchedule(source: { trainingDates?: readonly string[]; startTime?: string } | undefined): PickedSchedule | undefined {
  if (!source?.trainingDates?.length) return undefined;
  return { trainingDates: [...source.trainingDates], ...(source.startTime ? { startTime: source.startTime } : {}) };
}

/** "按我的时间表来" and similar: keep the days the user already chose. */
export const keepPickedScheduleIntent = (text: string) =>
  /按(?:照)?我(?:的|选的|定的|自己的)?(?:时间表|时间|安排|日程|日期|日子|计划)|就按(?:我)?(?:选的|日历)|按日历|(?:stick|keep)\s+(?:to\s+)?my\s+(?:schedule|dates|days)|(?:use|follow)\s+my\s+(?:schedule|dates|days)/i.test(text);

/** Only an explicit new weekday pattern or weekly count changes picked days; a "keep my schedule" message never does. */
export function explicitScheduleChange(text: string): boolean {
  if (!text.trim() || keepPickedScheduleIntent(text)) return false;
  if (preferredTrainingDays(text).length) return true;
  return /(?:每周|一周)\s*[1-7一二两三四五六七]\s*(?:次|天|练)|\b(?:once|twice|one|two|three|four|five|six|seven|[1-7])\s*(?:times?|days?)\s*(?:a |per |each )?week\b|(?:改|换|调整|change|move|switch).{0,8}(?:训练日|休息日|哪几天|日期|training days|rest days)/i.test(text);
}

/** The latest user words of a coach request (chat message or MODIFY_PLAN instruction). */
export function latestUserText(request: CoachRequest): string {
  const message = [...request.messages].reverse().find(row => row.role === 'user')?.content ?? '';
  return message || ('instruction' in request ? request.instruction : '');
}

type DayShape = { weeklyTarget: number; preferredDays?: readonly string[] };
const sameDays = (before: DayShape, after: DayShape) =>
  before.weeklyTarget === after.weeklyTarget && JSON.stringify(before.preferredDays ?? []) === JSON.stringify(after.preferredDays ?? []);

/** True when an AI proposal replaces the picked days: the user asked for it and the days actually differ. */
export function pickedDaysReplaced(request: CoachRequest, before: DayShape, proposal: DayShape): boolean {
  return explicitScheduleChange(latestUserText(request)) && !sameDays(before, proposal);
}

/**
 * Schedule fields an applied AI proposal keeps. Start date and time always stay; the picked
 * dates stay unless {@link pickedDaysReplaced}, in which case the plan follows the new weekly rhythm.
 */
export function scheduleAfterProposal<T extends { startDate?: string; trainingDates?: string[]; startTime?: string }>(
  schedule: T, request: CoachRequest, before: DayShape, proposal: DayShape,
): Pick<T, 'startDate' | 'trainingDates' | 'startTime'> {
  const replaced = !!schedule.trainingDates?.length && pickedDaysReplaced(request, before, proposal);
  return {
    ...(schedule.startDate ? { startDate: schedule.startDate } : {}),
    ...(schedule.trainingDates?.length && !replaced ? { trainingDates: [...schedule.trainingDates] } : {}),
    ...(schedule.startTime ? { startTime: schedule.startTime } : {}),
  } as Pick<T, 'startDate' | 'trainingDates' | 'startTime'>;
}
