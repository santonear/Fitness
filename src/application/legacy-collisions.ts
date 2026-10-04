import type { PlanInput } from '../domain/models';
import { repository, type Repository } from '../persistence/repository';
import { slotTasks } from './day-plans';
import { evaluateSlot } from '../domain/day-slot-policy';
import { projectDay } from '../domain/day-date-projection';
import { expandSchedule } from '../domain/calendar';
import { legacyPlanVersionSchema } from '../domain/schemas';
import { DomainError } from '../domain/errors';
export type LegacyOperation = { type: 'reschedule'; id: string; date: string } | { type: 'activate'; id: string } | { type: 'start'; versionId: string; dayId: string } | { type: 'save'; input: PlanInput };
import type { LegacyConfirmation } from '../domain/day-plan-contracts';
export type { LegacyConfirmation } from '../domain/day-plan-contracts';
export async function prepareLegacyOperation(operation: LegacyOperation, repo: Repository = repository) {
  return repo.db.transaction('r', repo.db.tables, async () => {
    const profile = await repo.db.profiles.toCollection().first(); if (!profile) throw new DomainError('INVALID','Profile missing');
    const metadata = await repo.readMetadata(); const versions = await repo.db.planVersions.toArray(); const plans = await repo.db.plans.toArray();
    const rows = await repo.db.scheduledWorkouts.toArray(); const dates: string[] = []; const ids: string[] = [];
    if (operation.type === 'save') {
      if (operation.input.status !== 'draft') {
        const input = operation.input, now = new Date().toISOString();
        const v = legacyPlanVersionSchema.parse({ id:crypto.randomUUID(),planId:crypto.randomUUID(),createdAt:now,updatedAt:now,revision:0,versionNumber:1,
          startDate:input.startDate,scheduleTimeZone:input.scheduleTimeZone,goalSnapshot:input.goalSnapshot,durationWeeks:input.durationWeeks,daysPerWeek:input.daysPerWeek,days:input.days });
        for (const row of expandSchedule(v,v.startDate,v.scheduleTimeZone)) { const date = projectDay(row.scheduledDate,v.scheduleTimeZone,profile.timeZone); if (!date) throw new DomainError('CALENDAR_PROVENANCE_MISSING','Review ambiguous legacy date'); dates.push(date); }
      }
    } else {
      const selected = operation.type === 'activate' ? rows.filter(row => row.planVersionId === plans.find(plan => plan.id === operation.id)?.currentVersionId && !row.hiddenAt && row.status !== 'skipped')
        : operation.type === 'reschedule' ? rows.filter(row => row.id === operation.id) : rows.filter(row => row.planVersionId === operation.versionId && row.plannedDayId === operation.dayId);
      for (const row of selected) {
        const version = versions.find(version => version.id === row.planVersionId); if (!version || !('durationWeeks' in version)) continue;
        ids.push(row.id); const date = projectDay(operation.type === 'reschedule' ? operation.date : row.scheduledDate,version.scheduleTimeZone,profile.timeZone);
        if (!date) throw new DomainError('CALENDAR_PROVENANCE_MISSING','Review ambiguous legacy date'); dates.push(date);
      }
    }
    const tasks = (await slotTasks(repo,profile.timeZone,dates)).filter(task => dates.includes(task.projectedDate) || ids.includes(task.taskId));
    const collisions = tasks.filter(task => task.source === 'date-day' && evaluateSlot([task],task.projectedDate).occupants.length).map(task => {
      const row = rows.find(row => row.id === task.taskId)!; const version = versions.find(version => version.id === row.planVersionId)!; const plan = plans.find(plan => plan.id === version.planId)!;
      return {taskId:task.taskId,name:plan.name,date:task.projectedDate,source:task.source,originalDate:row.originalDate};
    });
    const taskIds = new Set(tasks.map(task=>task.taskId)); const affectedPlans = plans.filter(plan=>rows.some(row=>taskIds.has(row.id)&&versions.find(v=>v.id===row.planVersionId)?.planId===plan.id));
    const confirmation = { operation:JSON.stringify(operation), dependencySnapshot:JSON.stringify({ generation:metadata.restoreGeneration??0,zone:profile.timeZone,
      tasks:tasks.sort((a,b)=>a.taskId.localeCompare(b.taskId)), plans:affectedPlans.map(plan=>({id:plan.id,revision:plan.revision,currentVersionId:plan.currentVersionId})).sort((a,b)=>a.id.localeCompare(b.id)) }) };
    return { collisions, confirmation, dates, legacyTasks: rows.filter(row=>ids.includes(row.id)).map(row=>({taskId:row.id,date:row.scheduledDate,originalDate:row.originalDate,source:'legacy-week'})) };
  });
}
export async function authorizeLegacyOperation(operation: LegacyOperation, confirmation: LegacyConfirmation | undefined, repo: Repository) {
  const current = await prepareLegacyOperation(operation,repo);
  if (confirmation && (confirmation.operation !== current.confirmation.operation || confirmation.dependencySnapshot !== current.confirmation.dependencySnapshot)) throw new DomainError('CONFLICT','Collision changed; review both tasks again');
  if (current.collisions.length && !confirmation) throw new DomainError('LEGACY_CONFIRMATION_REQUIRED','Review both task identities, dates, sources and preserved statistics before continuing');
}
