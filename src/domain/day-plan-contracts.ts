/** G1 pure policy input: callers supply the approved calendar projection. */
export interface SlotTask {
  taskId: string;
  source: 'legacy-week' | 'date-day';
  revision: number;
  projectedDate: string;
  current: boolean;
  status: 'pending' | 'skipped';
  hidden: boolean;
  completedSessionId: string | null;
  inProgressSessionId: string | null;
}
export interface SlotEvaluation { occupants: string[]; releasedHistory: string[] }
/** No global dataRevision: only affected dependencies invalidate confirmation. */
export interface LegacyConfirmationDependencies { restoreGeneration: number; tasks: SlotTask[] }
export interface LegacyConfirmation { dependencySnapshot: string; operation: string }
