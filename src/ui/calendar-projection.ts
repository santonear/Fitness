import type { PlanVersion, ScheduledWorkout } from '../domain/models';
import { projectDay } from '../domain/day-date-projection';

export type CalendarTask = ScheduledWorkout & { calendarDate: string | null; sourceTimeZone: string | null };

/** Display metadata only. The source task dates and wall-clock time remain unchanged. */
export function calendarTask(task: ScheduledWorkout, versions: PlanVersion[], calendarZone: string): CalendarTask {
  const sourceTimeZone = versions.find(version => version.id === task.planVersionId)?.scheduleTimeZone ?? null;
  let calendarDate: string | null = null;
  if (sourceTimeZone) { try { calendarDate = projectDay(task.scheduledDate, sourceTimeZone, calendarZone); } catch { /* Invalid provenance requires review, never a guessed date. */ } }
  return { ...task, calendarDate, sourceTimeZone };
}
