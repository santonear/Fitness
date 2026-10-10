import { z } from 'zod';
import { repository, type Repository } from '../persistence/repository';
import { DomainError } from '../domain/errors';
import { datePlanVersionSchema, planSchema, scheduledWorkoutSchema, localDateSchema, timeZoneSchema, plannedExerciseSchema } from '../domain/schemas';
import { exercises } from '../catalog/exercises';
import { civilDayInterval, projectDay } from '../domain/day-date-projection';
import { evaluateSlot } from '../domain/day-slot-policy';
import type { SlotTask } from '../domain/day-plan-contracts';
import { schedulingFields, validateScheduling } from '../domain/training-time';
import { createBackupService } from './backup';

const inputSchema = z.strictObject({ id: z.uuid().optional(), name: z.string().trim().min(1), date: localDateSchema, timeZone: timeZoneSchema,
  exercises: z.array(plannedExerciseSchema).min(1), ...schedulingFields, expectedRevision: z.number().int().nonnegative().optional(), expectedGeneration: z.number().int().nonnegative().optional() }).superRefine(validateScheduling);
export type DayPlanInput = z.infer<typeof inputSchema>;
export async function slotTasks(repo: Repository, zone: string, affectedDates?: string[]): Promise<SlotTask[]> {
  const [plans, versions, rows, sessions] = await Promise.all([repo.db.plans.toArray(), repo.db.planVersions.toArray(), repo.db.scheduledWorkouts.toArray(), repo.db.sessions.where('status').equals('in_progress').toArray()]);
  const tasks: SlotTask[] = [];
  for (const row of rows) {
    const version = versions.find(version => version.id === row.planVersionId); const plan = plans.find(plan => plan.id === version?.planId);
    if (!version || !plan) throw new DomainError('INVALID', 'Missing plan provenance');
    const ongoing = sessions.find(session => session.planVersionId === row.planVersionId && session.plannedDayId === row.plannedDayId);
    const current = !plan.deletedAt && plan.status === 'active' && plan.currentVersionId === version.id;
    const protectedTask = Boolean(row.completedSessionId || ongoing);
    const occupying = protectedTask || (current && !row.hiddenAt && row.status !== 'skipped');
    const date = projectDay(row.scheduledDate, version.scheduleTimeZone, zone);
    if (!date) {
      const source = civilDayInterval(row.scheduledDate, version.scheduleTimeZone);
      const affectsRequest = affectedDates === undefined || source === null || affectedDates.some(date => {
        const target = civilDayInterval(date, zone);
        return target !== null && Math.min(source[1], target[1]) > Math.max(source[0], target[0]);
      });
      if (occupying && affectsRequest) throw new DomainError('CALENDAR_PROVENANCE_MISSING', `Review ambiguous date for task ${row.id} (${row.scheduledDate}, ${version.scheduleTimeZone})`);
      continue;
    }
    tasks.push({ taskId: row.id, source: plan.model ? 'date-day' : 'legacy-week', revision: row.revision, projectedDate: date, current,
      status: row.status, hidden: Boolean(row.hiddenAt), completedSessionId: row.completedSessionId ?? null, inProgressSessionId: ongoing?.id ?? null });
  } return tasks;
}
export function createDayPlanService(repo: Repository) {
  const db = repo.db;
  async function guardGeneration(expected?: number) { if (expected !== undefined && ((await repo.readMetadata()).restoreGeneration ?? 0) !== expected) throw new DomainError('CONFLICT', 'Library restored; reopen the day editor'); }
  async function assertFree(date: string, zone: string, exclude?: string) {
    if (evaluateSlot((await slotTasks(repo, zone, [date])).filter(task => task.taskId !== exclude), date).occupants.length) throw new DomainError('CONFLICT', 'This date already has an occupying plan');
  }
  async function saveDayPlan(value: DayPlanInput) {
    const parsed = inputSchema.safeParse(value); if (!parsed.success) throw new DomainError('INVALID', 'Enter one date, name and valid exercise targets');
    const input = parsed.data;
    for (const item of input.exercises) { const exercise = exercises.find(entry => entry.id === item.exerciseId);
      if (!exercise || item.targetSets.some(target => target.metricType !== exercise.metricType)) throw new DomainError('INVALID', 'Targets must match exercise metrics'); }
    if (new Set(input.exercises.map(item => item.order)).size !== input.exercises.length) throw new DomainError('INVALID', 'Duplicate exercise order');
    return repo.write(async () => {
      await guardGeneration(input.expectedGeneration); const profile = await db.profiles.toCollection().first();
      if (profile?.timeZone !== input.timeZone) throw new DomainError('INVALID', 'Use the saved profile calendar time zone');
      const old = input.id ? await db.plans.get(input.id) : undefined;
      if (input.id) await assertLegacyPlanEditable(repo, input.id);
      if (input.id && (await db.guidedStates.get('guided'))?.programs.some(program => program.planIds.includes(input.id!))) throw new DomainError('CONFLICT', 'Retained phase content cannot be changed through a day plan editor');
      if (input.id && (!old || old.model !== 'date-day' || old.deletedAt)) throw new DomainError('INVALID', 'Day plan not found');
      if (old && old.revision !== input.expectedRevision) throw new DomainError('CONFLICT', 'Day plan changed; reopen it');
      const previous = old ? await db.planVersions.get(old.currentVersionId) : undefined;
      const row = old ? await db.scheduledWorkouts.where('planVersionId').equals(old.currentVersionId).first() : undefined;
      if (old && (!row || !previous || 'durationWeeks' in previous || row.hiddenAt || row.status === 'skipped')) throw new DomainError('INVALID', 'Rearrange released history as a new day plan');
      if (row && row.scheduledDate !== input.date) throw new DomainError('INVALID', 'Use explicit reschedule for date changes');
      if (row?.completedSessionId || (row && await db.sessions.where('status').equals('in_progress').filter(session => session.planVersionId === row.planVersionId && session.plannedDayId === row.plannedDayId).count())) throw new DomainError('WORKOUT_IN_PROGRESS', 'Completed or ongoing day plans cannot be edited');
      const durationMinutes = input.durationMinutes ?? row?.durationMinutes;
      // Unknown estimates remain unknown. Explicit timed targets still establish a lower bound.
      const knownSeconds = input.exercises.reduce((total, item) => total + item.targetSets.reduce((sum, target, index) => {
        const timing = item.setTimings?.[index];
        return sum + (timing ? timing.durationSeconds + timing.restSeconds : 'durationSeconds' in target ? target.durationSeconds : 0);
      }, 0), 0);
      if (durationMinutes !== undefined && knownSeconds > durationMinutes * 60) throw new DomainError('INVALID', 'Known exercise and rest durations exceed the session duration');
      if (!row) await assertFree(input.date, input.timeZone);
      const now = new Date().toISOString(); const id = old?.id ?? crypto.randomUUID();
      const nameOnly = previous && JSON.stringify(previous.days[0].exercises) === JSON.stringify(input.exercises);
      const version = nameOnly ? previous : datePlanVersionSchema.parse({ id: crypto.randomUUID(), planId: id, createdAt: now, updatedAt: now, revision: 0,
        model: 'date-day', versionNumber: (previous?.versionNumber ?? 0) + 1, goalSnapshot: previous?.goalSnapshot ?? { goal: '' }, generationMetadata: previous?.generationMetadata, startDate: row?.originalDate ?? input.date, scheduleTimeZone: input.timeZone,
        days: [{ dayId: row?.plannedDayId ?? crypto.randomUUID(), date: row?.originalDate ?? input.date, exercises: input.exercises }] });
      const plan = planSchema.parse({ id, createdAt: old?.createdAt ?? now, updatedAt: now, revision: (old?.revision ?? -1) + 1, model: 'date-day', name: input.name,
        source: old?.source ?? 'manual', status: 'active', currentVersionId: version.id, startDate: version.startDate, scheduleTimeZone: input.timeZone });
      const task = scheduledWorkoutSchema.parse({ id: row?.id ?? crypto.randomUUID(), createdAt: row?.createdAt ?? now, updatedAt: now,
        revision: (row?.revision ?? -1) + 1, planVersionId: version.id, plannedDayId: version.days[0].dayId, originalDate: version.startDate, scheduledDate: input.date, status: 'pending', startTime: input.startTime ?? row?.startTime, durationMinutes: input.durationMinutes ?? row?.durationMinutes });
      if (!nameOnly) await db.planVersions.add(version); await db.plans.put(plan); await db.scheduledWorkouts.put(task); return { plan, task, version };
    });
  }
  async function saveDayPlans(inputs: DayPlanInput[], expectedGeneration: number) {
    if (!Array.isArray(inputs) || inputs.length < 1 || inputs.length > 14 || inputs.some(input => input.id !== undefined) || new Set(inputs.map(input => input.date)).size !== inputs.length || new Set(inputs.map(input => input.timeZone)).size !== 1) throw new DomainError('INVALID', 'Select 1–14 distinct dates in one calendar time zone');
    return repo.write(async () => {
      await guardGeneration(expectedGeneration);
      const saved = [];
      for (const input of inputs) saved.push(await saveDayPlan({ ...input, expectedGeneration }));
      // Check the complete library while the outer write transaction can still roll back every day.
      // Checking individual nested writes would also inspect intermediate guided-program state.
      await createBackupService(repo).exportBackup();
      return saved;
    });
  }
  async function change(id: string, revision: number, action: 'hide' | 'skip' | 'reschedule', date?: string, expectedGeneration?: number) {
    return repo.write(async () => {
      await guardGeneration(expectedGeneration);
      const row = await db.scheduledWorkouts.get(id); const version = row && await db.planVersions.get(row.planVersionId);
      if (version) await assertLegacyPlanEditable(repo, version.planId);
      if (!row || !version || 'durationWeeks' in version || row.revision !== revision) throw new DomainError('CONFLICT', 'Day task changed');
      const plan = await db.plans.get(version.planId); if (!plan || plan.deletedAt || row.hiddenAt) throw new DomainError('INVALID', 'Day plan unavailable');
      if (await db.sessions.where('status').equals('in_progress').filter(session => session.planVersionId === row.planVersionId && session.plannedDayId === row.plannedDayId).count()) throw new DomainError('WORKOUT_IN_PROGRESS', 'Finish or abandon this training first');
      if (row.completedSessionId && action !== 'hide') throw new DomainError('SESSION_READ_ONLY', 'Completed day identity stays occupied');
      if (action === 'reschedule') { localDateSchema.parse(date); const profile = await db.profiles.toCollection().first();
        if (profile?.timeZone !== version.scheduleTimeZone) throw new DomainError('CALENDAR_PROVENANCE_MISSING', 'Review the calendar time zone before rescheduling');
        await assertFree(date!, version.scheduleTimeZone, row.id); }
      await db.scheduledWorkouts.put({ ...row, revision: row.revision + 1, updatedAt: new Date().toISOString(),
        ...(action === 'hide' ? { hiddenAt: new Date().toISOString() } : action === 'skip' ? { status: 'skipped' as const } : { scheduledDate: date!, status: 'pending' as const }) });
    });
  }
  return { saveDayPlan, saveDayPlans, skipDayPlan: (id: string, revision: number, generation?: number) => change(id, revision, 'skip', undefined, generation), hideDayPlan: (id: string, revision: number, generation?: number) => change(id, revision, 'hide', undefined, generation),
    rescheduleDayPlan: (id: string, date: string, revision: number, generation?: number) => change(id, revision, 'reschedule', date, generation) };
}
export const dayPlanService = createDayPlanService(repository);
import { assertLegacyPlanEditable } from '../persistence/v8-access';
