import type { LocalDate, PlanVersion, ScheduledWorkout } from './models';
import { DomainError } from './errors';
import { localDateSchema, timeZoneSchema } from './schemas';
export function expandSchedule(version: PlanVersion, startDate: LocalDate, timeZone: string): ScheduledWorkout[] {
  if (!localDateSchema.safeParse(startDate).success || !timeZoneSchema.safeParse(timeZone).success) throw new DomainError('INVALID', 'Invalid calendar date or time zone');
  if (!Number.isInteger(version.durationWeeks) || version.durationWeeks < 1 || version.durationWeeks > 12 || !Number.isInteger(version.daysPerWeek) || version.daysPerWeek < 1 || version.daysPerWeek > 7) throw new DomainError('INVALID', 'Invalid cycle length or weekday count');
  const start = new Date(`${startDate}T00:00:00Z`);
  if (start.toISOString().slice(0,10) !== startDate) throw new DomainError('INVALID', 'Impossible calendar date');
  const weekday = start.getUTCDay() || 7;
  const dayIds = new Set<string>();
  if (version.days.length !== version.durationWeeks * version.daysPerWeek) throw new DomainError('INVALID', 'Weekday count does not match cycle');
  const now = new Date().toISOString();
  const result: ScheduledWorkout[] = [];
  for (let week = 1; week <= version.durationWeeks; week++) {
    const days = version.days.filter(day => day.weekIndex === week);
    if (days.length !== version.daysPerWeek || new Set(days.map(day => day.dayOfWeek)).size !== days.length) throw new DomainError('INVALID', 'Weekdays must be distinct and match days per week');
    for (const day of days) {
      if (!Number.isInteger(day.dayOfWeek) || day.dayOfWeek < 1 || day.dayOfWeek > 7 || dayIds.has(day.dayId)) throw new DomainError('INVALID', 'Invalid day identity or weekday');
      dayIds.add(day.dayId);
      const date = new Date(start);
      date.setUTCDate(date.getUTCDate() + (week-1)*7 + (day.dayOfWeek-weekday+7)%7);
      const localDate = date.toISOString().slice(0,10);
      result.push({id:crypto.randomUUID(),createdAt:now,updatedAt:now,revision:0,planVersionId:version.id,plannedDayId:day.dayId,originalDate:localDate,scheduledDate:localDate,status:'pending'});
    }
  }
  return result.sort((a,b)=>a.originalDate.localeCompare(b.originalDate));
}
