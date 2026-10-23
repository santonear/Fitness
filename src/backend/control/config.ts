import type { TransportRequest as AiRequest } from '../contracts';
import type { OperationCounts } from '../store';
import { randomHex } from '../../domain/hex';

export interface ControlConfig {
  /** Costs are integer RMB fen; external operation requires separately validated operator configuration. */
  mode: 'local-test' | 'external';
  timeZone: string;
  k: number;
  budgetLimit: number;
  maximumRequestCost: number;
  requestBounds: OperationCounts;
  quotas: OperationCounts;
  maxInputBytes: number;
  maxConcurrent: number;
  adminSecret: string;
  digestSecret: string;
  allowBoundedPending?: boolean;
  planningBudgetDisabled?: boolean;
  allowUncertainPlanningPending?: boolean;
  adminOperationId?: string;
  retentionDays?: number;
  coachPromptVersion?: string;
}
export const testConfig: ControlConfig = {
  mode: 'local-test',
  timeZone: 'UTC',
  k: 1,
  budgetLimit: 3500,
  maximumRequestCost: 1000,
  requestBounds: { understand: 100, generate: 300, summary: 300 },
  quotas: { understand: 8, generate: 4, summary: 4 },
  maxInputBytes: 65536,
  maxConcurrent: 4,
  adminSecret: 'local-test-admin-only',
  digestSecret: 'local-test-digest-key-only',
};
export interface MockSupplier {
  kind: 'local-mock';
  costUpperBoundFen?(request: AiRequest): number | undefined;
  call(request: AiRequest): Promise<{ result: unknown; actualCost?: number }>;
}
export interface ExternalSupplier {
  kind: 'external-transport';
  costUpperBoundFen?(request: AiRequest): number | undefined;
  call(request: AiRequest): Promise<{ result: unknown; actualCost?: number }>;
}
export const token = () => randomHex();
export function integer(value: number) {
  return Number.isSafeInteger(value) && value >= 0;
}
export const requestKey = (subjectId: string, requestId: string) => `${subjectId}:${requestId}`;
export const usageKey = (subjectId: string, period: string) => `${subjectId}:${period}`;
