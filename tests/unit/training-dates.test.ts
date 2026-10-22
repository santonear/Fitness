import { describe, it, expect } from 'vitest';
import { addDays } from '../../src/application/plan-presentation';
import {
  dateRange,
  normalizeTrainingDates,
  selectableDate,
  sessionForDate,
  shiftTrainingDates,
  validTrainingDates,
  weeklyTargetFromDates,
} from '../../src/application/training-dates';
import { monthCalendar } from '../../src/application/plan-calendar';
import { localProfile } from '../../src/application/rules/local-profile';
import { parseComposedSchedule } from '../../src/ui/pages/onboarding/OnboardingPage';
import { v8PlanVersionSchema } from '../../src/domain/schemas';

const today = '2026-10-19';
const templates = [
  { id: 'a', name: 'A', estimatedMinutes: 30, items: [] },
  { id: 'b', name: 'B', estimatedMinutes: 30, items: [] },
] as never;

describe('calendar training days (Bo 2026-10-19)', () => {
  it('a single day is a whole plan: frequency 1, the one day planned', () => {
    const { dates, rest, outside } = normalizeTrainingDates([today], today);
    expect(dates).toEqual([today]);
    expect(rest).toEqual([]);
    expect(outside).toEqual([]);
    expect(validTrainingDates(dates)).toBe(true);
    expect(weeklyTargetFromDates(dates)).toBe(1);
    expect(sessionForDate({ weeklyTarget: 1, templates, trainingDates: dates }, today)).toBe('a');
    expect(sessionForDate({ weeklyTarget: 1, templates, trainingDates: dates }, addDays(today, 1))).toBeUndefined();
  });
  it('30 dragged days keep one rest day in every 7 and stay within 30 days', () => {
    const range = dateRange(today, addDays(today, 29));
    expect(range).toHaveLength(30);
    const { dates, rest } = normalizeTrainingDates(range, today);
    expect(rest).toEqual([addDays(today, 6), addDays(today, 13), addDays(today, 20), addDays(today, 27)]);
    expect(dates).toHaveLength(26);
    expect(validTrainingDates(dates)).toBe(true);
    expect(validTrainingDates(range)).toBe(false);
    expect(weeklyTargetFromDates(dates)).toBe(6);
  });
  it('every-other-day for 30 days is accepted as is (15 days, 4 a week)', () => {
    const dates = Array.from({ length: 15 }, (_, i) => addDays(today, i * 2));
    expect(normalizeTrainingDates(dates, today).dates).toEqual(dates);
    expect(weeklyTargetFromDates(dates)).toBe(4);
  });
  it('drops past days, a start beyond two weeks and anything past 30 days, and says so', () => {
    const r = normalizeTrainingDates([addDays(today, -1), addDays(today, 3), addDays(today, 40), '2026-02-30'], today);
    expect(r.dates).toEqual([addDays(today, 3)]);
    expect(r.outside).toEqual([addDays(today, -1), addDays(today, 40)]);
    expect(normalizeTrainingDates([addDays(today, 20)], today).dates).toEqual([]);
  });
  it('only offers days that keep the plan within two weeks to start and 30 days long', () => {
    expect(selectableDate(addDays(today, -1), today, [])).toBe(false);
    expect(selectableDate(addDays(today, 14), today, [])).toBe(true);
    expect(selectableDate(addDays(today, 15), today, [])).toBe(false);
    const chosen = [addDays(today, 10)];
    expect(selectableDate(addDays(today, 39), today, chosen)).toBe(true);
    expect(selectableDate(addDays(today, 40), today, chosen)).toBe(false);
  });
  it('sessions take turns in date order; the month calendar shows exactly the chosen days', () => {
    const dates = [today, addDays(today, 2), addDays(today, 3)];
    const plan = { weeklyTarget: 3, templates, trainingDates: dates };
    expect(dates.map(date => sessionForDate(plan, date))).toEqual(['a', 'b', 'a']);
    const month = monthCalendar({ plan, workouts: [], month: '2026-10', today });
    expect(month.filter(day => day.state === 'planned').map(day => day.date)).toEqual(dates);
  });
  it('moving the start shifts the days and keeps the rhythm', () => {
    expect(shiftTrainingDates([today, addDays(today, 2)], addDays(today, 5))).toEqual([
      addDays(today, 5),
      addDays(today, 7),
    ]);
  });
  it('frequency comes from the chosen days, not weekday words; weekly answers still parse', () => {
    const answers = {
      goalText: '力量',
      scheduleOriginalText: '每周 2 次，每次 30 分钟，共 3 天',
      placeEquipmentText: '在家',
      adultConfirmed: true,
      cautions: [] as never[],
    };
    const profile = localProfile({ ...answers, trainingDates: [today, addDays(today, 1), addDays(today, 2)] });
    expect(profile.weeklyTarget).toBe(3);
    expect(profile.preferredDays).toBeUndefined();
    expect(profile.sessionMinutes).toBe(30);
    expect(parseComposedSchedule('每周 2 次，每次 30 分钟，共 3 天')).toEqual({ weekly: 2, minutes: 30 });
    expect(parseComposedSchedule('每周 3 次，每次 45 分钟')).toEqual({ weekly: 3, minutes: 45 });
    expect(parseComposedSchedule('2 times a week, 30 minutes each time, 3 days in total')).toEqual({
      weekly: 2,
      minutes: 30,
    });
  });
  it('plan versions accept the optional days and time; old versions are unchanged', () => {
    const shape = v8PlanVersionSchema.shape;
    expect(shape.trainingDates.safeParse(undefined).success).toBe(true);
    expect(shape.trainingDates.safeParse([today]).success).toBe(true);
    expect(shape.trainingDates.safeParse([]).success).toBe(false);
    expect(shape.trainingDates.safeParse(Array.from({ length: 31 }, (_, i) => addDays(today, i))).success).toBe(false);
    expect(shape.startTime.safeParse('19:00').success).toBe(true);
    expect(shape.startTime.safeParse('25:00').success).toBe(false);
  });
});
