import type { ControlState, Operation, RequestStatus } from './store';

export interface AdminReport {
  format: 'fitness-control-admin-report';
  version: 1;
  capturedAt: string;
  aiEnabled: boolean;
  recoveryRequired: boolean;
  budgets: { period: string; spentFen: number; reservedFen: number }[];
  subjects: { subjectId: string; expiresAt: number; revoked: boolean; expired: boolean }[];
  usages: { subjectId: string; period: string; understand: number; generate: number; summary?: number }[];
  requests: { subjectId: string; requestId: string; operation: Operation; period: string; boundFen: number;
    status: RequestStatus; cancelled: boolean; actualCostFen?: number }[];
}

/** Explicit projection of an already captured ledger; authentication belongs to the caller. */
export function buildAdminReport(state: ControlState, nowMs: number): AdminReport {
  if (!Number.isFinite(nowMs) || !Number.isFinite(new Date(nowMs).getTime())) throw new Error('INVALID_REPORT_CLOCK');
  return {
    format: 'fitness-control-admin-report', version: 1, capturedAt: new Date(nowMs).toISOString(),
    aiEnabled: state.aiEnabled, recoveryRequired: state.recoveryRequired,
    budgets: Object.entries(state.budgets).sort(([a], [b]) => a.localeCompare(b)).map(([period, budget]) => ({ period, spentFen: budget.spent, reservedFen: budget.reserved })),
    subjects: Object.entries(state.subjects).sort(([a], [b]) => a.localeCompare(b)).map(([subjectId, subject]) => ({ subjectId, expiresAt: subject.expiresAt, revoked: subject.revoked, expired: subject.expiresAt <= nowMs })),
    usages: Object.entries(state.usages).sort(([a], [b]) => a.localeCompare(b)).map(([key, usage]) => ({
      subjectId: key.slice(0, key.lastIndexOf(':')), period: key.slice(key.lastIndexOf(':') + 1), understand: usage.understand, generate: usage.generate,
      ...(usage.summary === undefined ? {} : { summary: usage.summary }),
    })),
    requests: Object.values(state.requests).map(request => ({ subjectId: request.subjectId, requestId: request.requestId,
      operation: request.operation, period: request.period, boundFen: request.bound, status: request.status, cancelled: request.cancelled,
      ...(request.actualCost === undefined ? {} : { actualCostFen: request.actualCost }),
    })).sort((a, b) => a.subjectId.localeCompare(b.subjectId) || a.requestId.localeCompare(b.requestId)),
  };
}
