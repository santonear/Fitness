import type { SlotTask } from '../../../src/domain/day-plan-contracts';
export const slot = '2027-01-04';
export function task(overrides: Partial<SlotTask> = {}): SlotTask {
  return { taskId: 'legacy-a', source: 'legacy-week', revision: 1, projectedDate: slot,
    current: true, status: 'pending', hidden: false, completedSessionId: null,
    inProgressSessionId: null, ...overrides };
}
