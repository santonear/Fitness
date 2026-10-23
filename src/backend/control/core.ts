import { digest } from '../contracts';
import { ControlError, type ControlState, type ControlStore, type OperationCounts } from '../store';
import { TrialApplications } from '../trial-applications';
import { guidedServiceLimits } from '../../domain/guided-limits';
import { DAY_MS as DAY, todayIn } from '../../domain/local-date';
import { integer, usageKey, type ControlConfig, type ExternalSupplier, type MockSupplier } from './config';

export class ControlCore {
  get applications() {
    return new TrialApplications(this.store, this.config.digestSecret, this.now, this.config.retentionDays);
  }
  constructor(
    protected readonly store: ControlStore,
    protected readonly config: ControlConfig,
    protected readonly supplier: MockSupplier | ExternalSupplier,
    protected readonly now = Date.now,
    protected readonly onCandidateFailure?: (error?: unknown) => void,
  ) {
    new Intl.DateTimeFormat('en', { timeZone: config.timeZone });
    if (
      !(
        (config.mode === 'local-test' && supplier.kind === 'local-mock') ||
        (config.mode === 'external' && supplier.kind === 'external-transport')
      ) ||
      !config.adminSecret ||
      !config.digestSecret ||
      ![
        config.k,
        config.budgetLimit,
        config.maximumRequestCost,
        config.maxConcurrent,
        config.maxInputBytes,
        ...Object.values(config.quotas),
        ...Object.values(config.requestBounds),
      ].every(integer) ||
      config.k < 1 ||
      config.maxConcurrent < 1 ||
      (config.mode === 'external' &&
        [config.adminSecret, config.digestSecret].some(
          secret => secret.length < 32 || /local-test|placeholder|example/i.test(secret),
        )) ||
      (config.mode === 'external' && config.adminSecret === config.digestSecret)
    )
      throw new ControlError(config.mode === 'external' ? 'INVALID_CONTROL_CONFIG' : 'INVALID_TEST_CONFIG', 500);
  }
  protected async admin(secret: string) {
    // HMAC fixed-length digests avoid comparing credential content or storing its plaintext.
    const a = await digest(secret, this.config.digestSecret),
      b = await digest(this.config.adminSecret, this.config.digestSecret);
    let delta = 0;
    for (let i = 0; i < a.length; i++) delta |= a.charCodeAt(i) ^ b.charCodeAt(i);
    if (delta) throw new ControlError('ADMIN_REQUIRED', 401);
  }
  protected budgetDisabled(operation: string) {
    return this.config.planningBudgetDisabled === true && (operation === 'understand' || operation === 'generate');
  }
  protected period() {
    return todayIn(this.config.timeZone, this.now()).slice(0, 7);
  }
  protected qualification(state: ControlState, tokenDigest: string) {
    const session = state.sessions[tokenDigest];
    const subject = session && state.subjects[session.subjectId];
    if (!session || session.revoked || !subject || subject.revoked || subject.expiresAt <= this.now())
      throw new ControlError('QUALIFICATION_REQUIRED', 401);
    return session.subjectId;
  }
  protected audit(state: ControlState, event: string, subjectId?: string) {
    state.audit.push({ at: this.now(), event, ...(subjectId ? { subjectId } : {}) });
    if (state.audit.length > 1000) state.audit.splice(0, state.audit.length - 1000);
  }
  protected needsReconciliation(state: ControlState, period: string, forPlanning = false) {
    return (
      state.recoveryRequired ||
      this.hasAccountingAnomaly(state) ||
      Object.values(state.requests).some(
        entry =>
          (entry.status === 'pending' &&
            !(
              (forPlanning &&
                this.config.allowUncertainPlanningPending === true &&
                this.budgetDisabled('generate') &&
                entry.operation === 'generate' &&
                entry.error === 'SUPPLIER_UNCERTAIN') ||
              (this.budgetDisabled(entry.operation) && !entry.error) ||
              (this.config.allowBoundedPending &&
                entry.verifiedBoundFen !== undefined &&
                integer(entry.verifiedBoundFen) &&
                entry.verifiedBoundFen <= entry.bound &&
                !entry.error)
            )) ||
          (entry.period !== period && ['submitted', 'reserved'].includes(entry.status)),
      )
    );
  }
  protected hasAccountingAnomaly(state: ControlState) {
    if (!this.config.allowBoundedPending && !this.config.allowUncertainPlanningPending) return false;
    const expected: Record<string, number> = {},
      settled: Record<string, number> = {};
    for (const entry of Object.values(state.requests)) {
      if (!integer(entry.bound) || (entry.actualCost !== undefined && !integer(entry.actualCost))) return true;
      if (
        !['reserved', 'submitted', 'pending', 'settled', 'released'].includes(entry.status) ||
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(entry.period)
      )
        return true;
      if (entry.status === 'settled') {
        if (entry.actualCost === undefined) return true;
        settled[entry.period] = (settled[entry.period] ?? 0) + entry.actualCost;
      } else if (entry.actualCost !== undefined) return true;
      if (['reserved', 'submitted', 'pending'].includes(entry.status))
        expected[entry.period] = (expected[entry.period] ?? 0) + entry.bound;
    }
    return (
      Object.entries(expected).some(
        ([period, value]) => !state.budgets[period] || state.budgets[period].reserved !== value,
      ) ||
      Object.entries(settled).some(
        ([period, value]) => !integer(value) || !state.budgets[period] || state.budgets[period].spent < value,
      ) ||
      Object.entries(state.budgets).some(
        ([period, budget]) =>
          !integer(budget.spent) || !integer(budget.reserved) || budget.reserved !== (expected[period] ?? 0),
      )
    );
  }
  protected subjectStatus(state: ControlState, subjectId: string) {
    const period = this.period();
    const recorded = state.usages[usageKey(subjectId, period)] ?? { understand: 0, generate: 0 };
    const summaryConfigured = (this.config.quotas.summary ?? 0) > 0 && this.config.requestBounds.summary !== undefined;
    const used = { ...recorded, ...(summaryConfigured ? { summary: recorded.summary ?? 0 } : {}) };
    const budget = state.budgets[period] ?? { spent: 0, reserved: 0 };
    const carried = this.config.allowBoundedPending
      ? Object.entries(state.budgets)
          .filter(([month]) => month !== period)
          .reduce((sum, [, value]) => sum + value.reserved, 0)
      : 0;
    const available = (bound: number) => budget.spent + budget.reserved + carried + bound <= this.config.budgetLimit;
    // Locate the actual next monthly boundary in the configured zone, including DST.
    const month = (at: number) =>
      new Intl.DateTimeFormat('en', { timeZone: this.config.timeZone, year: 'numeric', month: '2-digit' }).format(at);
    let low = this.now(),
      high = low + 32 * DAY;
    const current = month(low);
    while (high - low > 1) {
      const mid = Math.floor((low + high) / 2);
      if (month(mid) === current) low = mid;
      else high = mid;
    }
    return {
      expiresAt: state.subjects[subjectId].expiresAt,
      period,
      used,
      limits: this.quotaLimits(state, subjectId, period),
      resetAt: high,
      timeZone: this.config.timeZone,
      maxDays: Math.min(this.config.k, guidedServiceLimits.maxDays),
      planningBudgetDisabled: this.config.planningBudgetDisabled === true,
      maximumRequestCost: this.config.maximumRequestCost,
      requestBounds: { ...this.config.requestBounds },
      budgetAvailable: {
        understand: this.budgetDisabled('understand') || available(this.config.requestBounds.understand),
        generate: this.budgetDisabled('generate') || available(this.config.requestBounds.generate),
      },
      pending: Object.values(state.requests).filter(
        r => r.subjectId === subjectId && ['reserved', 'submitted', 'pending'].includes(r.status),
      ).length,
      aiEnabled: state.aiEnabled && !state.recoveryRequired,
      reconciliationRequired: this.needsReconciliation(state, period),
      planningReconciliationRequired: this.needsReconciliation(state, period, true),
      summaryAvailable: summaryConfigured && state.aiEnabled && !this.needsReconciliation(state, period),
    };
  }
  protected quotaLimits(state: ControlState, subjectId: string, period: string): OperationCounts {
    const limits = { ...this.config.quotas },
      used = state.usages[usageKey(subjectId, period)] ?? { understand: 0, generate: 0 };
    for (const operation of ['understand', 'generate'] as const) {
      let credit = 0;
      for (const entry of Object.values(state.quotaRestorations ?? {}))
        if (entry.subjectId === subjectId && entry.period === period) {
          if (!integer(entry.credits[operation])) throw new ControlError('RECONCILIATION_REQUIRED', 503);
          credit = Math.max(credit, entry.credits[operation]);
        }
      limits[operation] += Math.min(used[operation], credit);
      if (!integer(used[operation]) || !integer(limits[operation]))
        throw new ControlError('RECONCILIATION_REQUIRED', 503);
    }
    return limits;
  }
  protected async pending(key: string) {
    await this.store.transact(state => {
      if (state.requests[key].status !== 'settled') {
        state.requests[key].status = 'pending';
        state.requests[key].error = 'SUPPLIER_UNCERTAIN';
      }
    });
  }
  protected releaseUnsubmitted(state: ControlState, key: string) {
    const entry = state.requests[key];
    if (entry.status !== 'reserved') throw new ControlError('ALREADY_SUBMITTED');
    state.budgets[entry.period].reserved -= entry.bound;
    const usage = state.usages[usageKey(entry.subjectId, entry.period)];
    usage[entry.operation] = (usage[entry.operation] ?? 0) - 1;
    entry.status = 'released';
  }
  protected settleState(state: ControlState, key: string, actualCost: number) {
    const entry = state.requests[key];
    if (!entry) throw new ControlError('REQUEST_NOT_FOUND', 404);
    if (entry.status === 'settled') {
      if (entry.actualCost !== actualCost) throw new ControlError('SETTLEMENT_CONFLICT');
      return;
    }
    if (!['submitted', 'pending'].includes(entry.status)) throw new ControlError('NOT_SUBMITTED');
    const budget = state.budgets[entry.period];
    budget.reserved -= entry.bound;
    budget.spent += actualCost;
    entry.actualCost = actualCost;
    entry.status = 'settled';
    if (
      !this.budgetDisabled(entry.operation) &&
      (actualCost > entry.bound || budget.spent + budget.reserved > this.config.budgetLimit)
    ) {
      state.recoveryRequired = true;
      state.aiEnabled = false;
      this.audit(state, 'cost-bound-breached');
    }
  }
}
