export type Operation = 'understand' | 'generate';
export type RequestStatus = 'reserved' | 'submitted' | 'pending' | 'settled' | 'released';
export interface ControlState {
  version: 1;
  aiEnabled: boolean;
  recoveryRequired: boolean;
  invites: Record<string, { expiresAt: number; redeemed: boolean; subjectId?: string }>;
  subjects: Record<string, { expiresAt: number; revoked: boolean }>;
  sessions: Record<string, { subjectId: string; revoked: boolean }>;
  usages: Record<string, Record<Operation, number>>;
  budgets: Record<string, { spent: number; reserved: number }>;
  requests: Record<string, { subjectId: string; requestId: string; inputDigest: string; operation: Operation;
    period: string; bound: number; status: RequestStatus; cancelled: boolean; actualCost?: number; error?: string }>;
  audit: Array<{ at: number; event: string; subjectId?: string }>;
}
export const initialState = (): ControlState => ({ version: 1, aiEnabled: false, recoveryRequired: false,
  invites: {}, subjects: {}, sessions: {}, usages: {}, budgets: {}, requests: {}, audit: [] });
/** Callbacks must be synchronous and pure: CAS adapters may run them more than once. */
export interface ControlStore {
  read(): Promise<ControlState>;
  transact<T>(change: (state: ControlState) => T): Promise<T>;
}
export class ControlError extends Error {
  constructor(public readonly code: string, public readonly status = 409) { super(code); }
}
