import { z } from 'zod';
import type { LegacyConfirmationDependencies, SlotEvaluation, SlotTask } from './day-plan-contracts';

const counter = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const date = z.iso.date();
const taskSchema = z.strictObject({
  taskId: z.string().min(1), source: z.enum(['legacy-week', 'date-day']), revision: counter,
  projectedDate: date, current: z.boolean(), status: z.enum(['pending', 'skipped']), hidden: z.boolean(),
  completedSessionId: z.string().min(1).nullable(), inProgressSessionId: z.string().min(1).nullable(),
}).superRefine((task, ctx) => {
  if (task.completedSessionId && task.inProgressSessionId) ctx.addIssue({ code: 'custom', message: 'Conflicting session associations' });
  if (task.status === 'skipped' && (task.completedSessionId || task.inProgressSessionId)) ctx.addIssue({ code: 'custom', message: 'Skipped task cannot have protected session' });
});

function validated(tasks: SlotTask[]): SlotTask[] {
  const parsed = z.array(taskSchema).parse(tasks);
  if (new Set(parsed.map(task => task.taskId)).size !== parsed.length) throw new Error('Duplicate taskId');
  return parsed.sort((a, b) => a.taskId < b.taskId ? -1 : a.taskId > b.taskId ? 1 : 0);
}

export function evaluateSlot(tasks: SlotTask[], slotDate: string): SlotEvaluation {
  date.parse(slotDate);
  const result: SlotEvaluation = { occupants: [], releasedHistory: [] };
  for (const task of validated(tasks)) {
    if (task.projectedDate !== slotDate) continue;
    if (task.inProgressSessionId || task.completedSessionId) result.occupants.push(task.taskId);
    else if (task.hidden || task.status === 'skipped' || !task.current) result.releasedHistory.push(task.taskId);
    else result.occupants.push(task.taskId);
  }
  return result;
}

function snapshot(input: LegacyConfirmationDependencies): string {
  counter.parse(input.restoreGeneration);
  return JSON.stringify({ restoreGeneration: input.restoreGeneration, tasks: validated(input.tasks) });
}
/** The caller supplies the complete set of affected tasks, including new occupants. */
export function validateLegacyConfirmation(before: LegacyConfirmationDependencies, current: LegacyConfirmationDependencies): boolean {
  return snapshot(before) === snapshot(current);
}
