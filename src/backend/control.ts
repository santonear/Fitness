import { canonical, digest, validateCandidate, validateRequest, type AiRequest } from './contracts';
import { ControlError, type ControlState, type ControlStore, type OperationCounts } from './store';
import { buildAdminReport } from './admin-report';
import { TrialApplications, applicationAdminView } from './trial-applications';
export { ControlError } from './store';

export interface ControlConfig {
  /** Costs are integer RMB fen; external operation requires separately validated operator configuration. */
  mode: 'local-test' | 'external'; timeZone: string; k: number; budgetLimit: number; maximumRequestCost: number;
  requestBounds: OperationCounts; quotas: OperationCounts; maxInputBytes: number;
  maxConcurrent: number; adminSecret: string; digestSecret: string;
  allowBoundedPending?: boolean;
}
export const testConfig: ControlConfig = { mode: 'local-test', timeZone: 'UTC', k: 1, budgetLimit: 3500,
  maximumRequestCost: 1000, requestBounds: { understand: 100, generate: 300, summary: 300 }, quotas: { understand: 8, generate: 4, summary: 4 },
  maxInputBytes: 65536, maxConcurrent: 4, adminSecret: 'local-test-admin-only', digestSecret: 'local-test-digest-key-only' };
export interface MockSupplier { kind: 'local-mock'; costUpperBoundFen?(request: AiRequest): number | undefined; call(request: AiRequest): Promise<{ result: unknown; actualCost?: number }> }
export interface ExternalSupplier { kind: 'external-transport'; costUpperBoundFen?(request: AiRequest): number | undefined; call(request: AiRequest): Promise<{ result: unknown; actualCost?: number }> }
function token() { return Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join(''); }
function integer(value: number) { return Number.isSafeInteger(value) && value >= 0; }
const DAY = 86400000;
const requestKey = (subjectId: string, requestId: string) => `${subjectId}:${requestId}`;
const usageKey = (subjectId: string, period: string) => `${subjectId}:${period}`;

export class ControlService {
  get applications() { return new TrialApplications(this.store, this.config.digestSecret, this.now); }
  constructor(private readonly store: ControlStore, private readonly config: ControlConfig,
    private readonly supplier: MockSupplier | ExternalSupplier, private readonly now = Date.now) {
    new Intl.DateTimeFormat('en', { timeZone: config.timeZone });
    if (!((config.mode === 'local-test' && supplier.kind === 'local-mock') || (config.mode === 'external' && supplier.kind === 'external-transport')) || !config.adminSecret || !config.digestSecret ||
      ![config.k, config.budgetLimit, config.maximumRequestCost, config.maxConcurrent, config.maxInputBytes,
        ...Object.values(config.quotas), ...Object.values(config.requestBounds)].every(integer) || config.k < 1 || config.maxConcurrent < 1 ||
      (config.mode === 'external' && [config.adminSecret, config.digestSecret].some(secret => secret.length < 32 || /local-test|placeholder|example/i.test(secret))) ||
      (config.mode === 'external' && config.adminSecret === config.digestSecret)) throw new ControlError(config.mode === 'external' ? 'INVALID_CONTROL_CONFIG' : 'INVALID_TEST_CONFIG', 500);
  }
  private async admin(secret: string) {
    // HMAC fixed-length digests avoid comparing credential content or storing its plaintext.
    const a = await digest(secret, this.config.digestSecret), b = await digest(this.config.adminSecret, this.config.digestSecret);
    let delta = 0; for (let i = 0; i < a.length; i++) delta |= a.charCodeAt(i) ^ b.charCodeAt(i);
    if (delta) throw new ControlError('ADMIN_REQUIRED', 401);
  }
  private period() {
    const parts = new Intl.DateTimeFormat('en', { timeZone: this.config.timeZone, year: 'numeric', month: '2-digit' }).formatToParts(this.now());
    return `${parts.find(p => p.type === 'year')!.value}-${parts.find(p => p.type === 'month')!.value}`;
  }
  private qualification(state: ControlState, tokenDigest: string) {
    const session = state.sessions[tokenDigest]; const subject = session && state.subjects[session.subjectId];
    if (!session || session.revoked || !subject || subject.revoked || subject.expiresAt <= this.now()) throw new ControlError('QUALIFICATION_REQUIRED', 401);
    return session.subjectId;
  }
  private audit(state: ControlState, event: string, subjectId?: string) {
    state.audit.push({ at: this.now(), event, ...(subjectId ? { subjectId } : {}) });
    if (state.audit.length > 1000) state.audit.splice(0, state.audit.length - 1000);
  }
  async retainLedger(admin: string) {
    await this.admin(admin); await this.store.transact(state => {
      for (const [key, invite] of Object.entries(state.invites)) if (invite.expiresAt <= this.now()) delete state.invites[key];
      for (const [key, session] of Object.entries(state.sessions)) {
        const subject = state.subjects[session.subjectId]; if (!subject || subject.expiresAt <= this.now()) delete state.sessions[key];
      }
      // Quota, cost and request tombstones have no TTL: pruning them could revive spent
      // allowance or erase unresolved charges. Subject tombstones preserve reissue expiry.
      this.audit(state, 'credential-retention');
    });
  }
  private needsReconciliation(state: ControlState, period: string) {
    return state.recoveryRequired || this.hasAccountingAnomaly(state) || Object.values(state.requests).some(entry => (entry.status === 'pending' &&
      !(this.config.allowBoundedPending && entry.verifiedBoundFen !== undefined && integer(entry.verifiedBoundFen) && entry.verifiedBoundFen <= entry.bound && !entry.error)) ||
      (entry.period !== period && ['submitted', 'reserved'].includes(entry.status)));
  }
  private hasAccountingAnomaly(state: ControlState) {
    if (!this.config.allowBoundedPending) return false;
    const expected: Record<string, number> = {}, settled: Record<string, number> = {};
    for (const entry of Object.values(state.requests)) {
      if (!integer(entry.bound) || entry.actualCost !== undefined && !integer(entry.actualCost)) return true;
      if (!['reserved', 'submitted', 'pending', 'settled', 'released'].includes(entry.status) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(entry.period)) return true;
      if (entry.status === 'settled') {
        if (entry.actualCost === undefined) return true;
        settled[entry.period] = (settled[entry.period] ?? 0) + entry.actualCost;
      } else if (entry.actualCost !== undefined) return true;
      if (['reserved', 'submitted', 'pending'].includes(entry.status)) expected[entry.period] = (expected[entry.period] ?? 0) + entry.bound;
    }
    return Object.entries(expected).some(([period, value]) => !state.budgets[period] || state.budgets[period].reserved !== value) ||
      Object.entries(settled).some(([period, value]) => !integer(value) || !state.budgets[period] || state.budgets[period].spent < value) ||
      Object.entries(state.budgets).some(([period, budget]) => !integer(budget.spent) || !integer(budget.reserved) || budget.reserved !== (expected[period] ?? 0));
  }
  async issue(admin: string) {
    await this.admin(admin); const code = token(), codeDigest = await digest(code, this.config.digestSecret);
    const expiresAt = this.now() + 7 * DAY;
    await this.store.transact(state => { state.invites[codeDigest] = { expiresAt, redeemed: false }; this.audit(state, 'invite-issued'); });
    return { code, inviteId: codeDigest, expiresAt };
  }
  async revokeInvite(admin: string, inviteId: string) {
    await this.admin(admin); await this.store.transact(state => {
      const invite = state.invites[inviteId]; if (!invite) throw new ControlError('INVITE_NOT_FOUND', 404);
      invite.redeemed = true; this.audit(state, 'invite-revoked');
    });
  }
  async redeem(code: string) {
    if (!/^[a-f0-9]{64}$/.test(code)) throw new ControlError('INVITE_INVALID', 401);
    const codeDigest = await digest(code, this.config.digestSecret), value = token(), sessionDigest = await digest(value, this.config.digestSecret), subjectId = crypto.randomUUID();
    const qualification = await this.store.transact(state => {
      const invite = state.invites[codeDigest];
      if (!invite || invite.redeemed || invite.expiresAt <= this.now()) throw new ControlError('INVITE_INVALID', 401);
      const id = invite.subjectId ?? subjectId;
      const existing = invite.subjectId && state.subjects[invite.subjectId];
      if (invite.subjectId && (!existing || existing.expiresAt <= this.now())) throw new ControlError('SUBJECT_EXPIRED', 401);
      invite.redeemed = true; const expiry = existing ? existing.expiresAt : this.now() + 30 * DAY;
      state.subjects[id] = { expiresAt: expiry, revoked: false };
      state.sessions[sessionDigest] = { subjectId: id, revoked: false }; this.audit(state, 'invite-redeemed', id); return { subjectId: id, expiresAt: expiry };
    });
    return { token: value, ...qualification };
  }
  async revoke(admin: string, subjectId: string) {
    await this.admin(admin); await this.store.transact(state => {
      const subject = state.subjects[subjectId]; if (!subject) throw new ControlError('SUBJECT_NOT_FOUND', 404);
      subject.revoked = true; for (const session of Object.values(state.sessions)) if (session.subjectId === subjectId) session.revoked = true;
      for (const invite of Object.values(state.invites)) if (invite.subjectId === subjectId) invite.redeemed = true;
      this.audit(state, 'subject-revoked', subjectId);
    });
  }
  async reissue(admin: string, subjectId: string) {
    await this.admin(admin); const code = token(), codeDigest = await digest(code, this.config.digestSecret);
    const expiresAt = await this.store.transact(state => {
      const subject = state.subjects[subjectId]; if (!subject || subject.expiresAt <= this.now()) throw new ControlError('SUBJECT_EXPIRED', 401);
      for (const session of Object.values(state.sessions)) if (session.subjectId === subjectId) session.revoked = true;
      for (const invite of Object.values(state.invites)) if (invite.subjectId === subjectId) invite.redeemed = true;
      subject.revoked = true;
      state.invites[codeDigest] = { subjectId, redeemed: false, expiresAt: Math.min(subject.expiresAt, this.now() + 7 * DAY) };
      this.audit(state, 'replacement-invite-issued', subjectId); return subject.expiresAt;
    }); return { code, inviteId: codeDigest, subjectId, expiresAt };
  }
  async status(value: string) {
    const sessionDigest = await digest(value, this.config.digestSecret); const state = await this.store.read(); const subjectId = this.qualification(state, sessionDigest);
    const period = this.period(); const recorded = state.usages[usageKey(subjectId, period)] ?? { understand: 0, generate: 0 };
    const summaryConfigured = (this.config.quotas.summary ?? 0) > 0 && this.config.requestBounds.summary !== undefined;
    const used = { ...recorded, ...(summaryConfigured ? { summary: recorded.summary ?? 0 } : {}) };
    return { subjectId, expiresAt: state.subjects[subjectId].expiresAt, period, used, limits: this.quotaLimits(state, subjectId, period),
      pending: Object.values(state.requests).filter(r => r.subjectId === subjectId && ['reserved', 'submitted', 'pending'].includes(r.status)).length,
      aiEnabled: state.aiEnabled && !state.recoveryRequired, reconciliationRequired: this.needsReconciliation(state, period),
      summaryAvailable: summaryConfigured && state.aiEnabled && !this.needsReconciliation(state, period) };
  }
  async adminReport(admin: string) {
    await this.admin(admin);
    return buildAdminReport(await this.store.read(), this.now());
  }
  async managementReport(admin: string) {
    await this.admin(admin); const state = await this.store.read();
    return { report: buildAdminReport(state, this.now()), applications: Object.values(state.applications ?? {}).map(applicationAdminView),
      invites: Object.entries(state.invites).filter(([, invite]) => !invite.redeemed && invite.expiresAt > this.now()).map(([inviteId, invite]) => ({ inviteId, expiresAt: invite.expiresAt })),
      quotas: Object.keys(state.subjects).map(subjectId => {
        const period = this.period(), used = state.usages[usageKey(subjectId, period)] ?? { understand: 0, generate: 0 };
        return { subjectId, period, used, limits: this.quotaLimits(state, subjectId, period), defaults: this.config.quotas };
      }), quotaRestorations: Object.entries(state.quotaRestorations ?? {}).map(([id, entry]) => ({ id, ...entry })),
      audit: state.audit.slice(-100), policy: { budgetLimit: this.config.budgetLimit, reservation: this.config.maximumRequestCost, timeZone: this.config.timeZone },
      service: { mode: this.config.mode, provider: this.supplier.kind, reconciliationRequired: this.needsReconciliation(state, this.period()) } };
  }
  async enableMock(admin: string, enabled: boolean) {
    if (this.config.mode !== 'local-test') throw new ControlError('MOCK_ONLY', 400);
    return this.enableSupplier(admin, enabled);
  }
  private quotaLimits(state: ControlState, subjectId: string, period: string): OperationCounts {
    const limits = { ...this.config.quotas }, used = state.usages[usageKey(subjectId, period)] ?? { understand: 0, generate: 0 };
    for (const operation of ['understand', 'generate'] as const) {
      let credit = 0;
      for (const entry of Object.values(state.quotaRestorations ?? {})) if (entry.subjectId === subjectId && entry.period === period) {
        if (!integer(entry.credits[operation])) throw new ControlError('RECONCILIATION_REQUIRED', 503);
        credit = Math.max(credit, entry.credits[operation]);
      }
      limits[operation] += Math.min(used[operation], credit);
      if (!integer(used[operation]) || !integer(limits[operation])) throw new ControlError('RECONCILIATION_REQUIRED', 503);
    }
    return limits;
  }
  async restoreQuota(admin: string, input: { id: string; subjectId: string; period: string; reason: string }) {
    await this.admin(admin);
    const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
    if (!uuid.test(input.id) || !uuid.test(input.subjectId) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(input.period) ||
        typeof input.reason !== 'string' || !input.reason.trim() || input.reason.length > 200) throw new ControlError('INVALID_INPUT', 400);
    return this.store.transact(state => {
      const previous = state.quotaRestorations?.[input.id];
      if (previous) {
        if (previous.subjectId !== input.subjectId || previous.period !== input.period || previous.reason !== input.reason) throw new ControlError('REQUEST_CONFLICT');
        return previous;
      }
      if (input.period !== this.period()) throw new ControlError('QUOTA_PERIOD_CHANGED');
      const subject = state.subjects[input.subjectId];
      if (!subject || subject.revoked || subject.expiresAt <= this.now()) throw new ControlError('QUALIFICATION_REQUIRED', 401);
      if (state.recoveryRequired || this.hasAccountingAnomaly(state)) throw new ControlError('RECONCILIATION_REQUIRED', 503);
      const used = state.usages[usageKey(input.subjectId, input.period)] ?? { understand: 0, generate: 0 };
      if (!integer(used.understand) || !integer(used.generate)) throw new ControlError('RECONCILIATION_REQUIRED', 503);
      const entry = { subjectId: input.subjectId, period: input.period, reason: input.reason, at: this.now(), credits: { understand: used.understand, generate: used.generate } };
      (state.quotaRestorations ??= {})[input.id] = entry;
      this.quotaLimits(state, input.subjectId, input.period);
      this.audit(state, `quota-restored:${input.id}`, input.subjectId);
      return entry;
    });
  }
  async enableSupplier(admin: string, enabled: boolean) {
    await this.admin(admin); await this.store.transact(state => {
      if (enabled && state.recoveryRequired) throw new ControlError('RECONCILIATION_REQUIRED', 503);
      state.aiEnabled = enabled; this.audit(state, enabled ? 'supplier-enabled' : 'supplier-disabled');
    });
  }
  async submit(value: string, payload: unknown) {
    const sessionDigest = await digest(value, this.config.digestSecret);
    this.qualification(await this.store.read(), sessionDigest);
    const request = await validateRequest(payload, this.config.k, this.config.maxInputBytes);
    const verifiedBoundFen = this.config.allowBoundedPending ? this.supplier.costUpperBoundFen?.(request) : undefined;
    if (this.config.allowBoundedPending && (verifiedBoundFen === undefined || !integer(verifiedBoundFen) || verifiedBoundFen > this.config.requestBounds[request.operation]!))
      throw new ControlError('COST_BOUND_UNVERIFIED', 503);
    const inputDigest = await digest(canonical(request), this.config.digestSecret), period = this.period();
    const key = await this.store.transact(state => {
      const subjectId = this.qualification(state, sessionDigest), key = requestKey(subjectId, request.requestId), previous = state.requests[key];
      if (previous) {
        if (previous.inputDigest !== inputDigest) throw new ControlError('REQUEST_CONFLICT');
        throw new ControlError(['reserved', 'submitted', 'pending'].includes(previous.status) ? 'REQUEST_IN_PROGRESS' : 'RESULT_UNAVAILABLE');
      }
      if (this.needsReconciliation(state, period)) throw new ControlError('RECONCILIATION_REQUIRED', 503);
      if (!state.aiEnabled) throw new ControlError('AI_DISABLED', 503);
      if (request.operation === 'summary' && (!(this.config.quotas.summary ?? 0) || this.config.requestBounds.summary === undefined)) throw new ControlError('SUMMARY_DISABLED', 503);
      const bound = this.config.requestBounds[request.operation]!; if (bound > this.config.maximumRequestCost) throw new ControlError('REQUEST_COST_BOUND', 400);
      const used = state.usages[usageKey(subjectId, period)] ?? { understand: 0, generate: 0 };
      if ((used[request.operation] ?? 0) >= (this.quotaLimits(state, subjectId, period)[request.operation] ?? 0)) throw new ControlError('INDIVIDUAL_QUOTA_EXHAUSTED', 429);
      const budget = state.budgets[period] ?? { spent: 0, reserved: 0 };
      const carriedReservations = this.config.allowBoundedPending ? Object.entries(state.budgets).reduce((sum, [key, value]) => sum + (key !== period ? value.reserved : 0), 0) : 0;
      if (budget.spent + budget.reserved + carriedReservations + bound > this.config.budgetLimit) throw new ControlError('GLOBAL_BUDGET_EXHAUSTED', 429);
      if (Object.values(state.requests).filter(r => ['reserved', 'submitted'].includes(r.status)).length >= this.config.maxConcurrent) throw new ControlError('CONCURRENCY_LIMIT', 429);
      used[request.operation] = (used[request.operation] ?? 0) + 1; budget.reserved += bound; state.usages[usageKey(subjectId, period)] = used; state.budgets[period] = budget;
      state.requests[key] = { subjectId, requestId: request.requestId, inputDigest, operation: request.operation, period, bound, status: 'reserved', cancelled: false,
        ...(verifiedBoundFen === undefined ? {} : { verifiedBoundFen }) };
      return key;
    });
    // Recheck authoritative accounting at the same boundary which grants submission.
    // Admission can have completed before another call became pending or the month changed.
    const submitted = await this.store.transact(state => {
      const reservation = state.requests[key];
      if (reservation.status !== 'reserved') return false;
      try { this.qualification(state, sessionDigest); } catch { this.releaseUnsubmitted(state, key); return false; }
      const currentBound = this.config.allowBoundedPending ? this.supplier.costUpperBoundFen?.(request) : undefined;
      if (reservation.cancelled || !state.aiEnabled || this.needsReconciliation(state, this.period()) ||
          this.config.allowBoundedPending && (currentBound === undefined || !integer(currentBound) || currentBound > reservation.bound)) { this.releaseUnsubmitted(state, key); return false; }
      // Keep the larger verified ceiling if provider configuration changed after admission.
      if (currentBound !== undefined) reservation.verifiedBoundFen = Math.max(reservation.verifiedBoundFen ?? currentBound, currentBound);
      reservation.status = 'submitted'; return true;
    });
    if (!submitted) throw new ControlError('NOT_SUBMITTED');
    let response: { result: unknown; actualCost?: number };
    try {
      const supplied: unknown = await this.supplier.call(request);
      if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied) || !Object.hasOwn(supplied, 'result')) throw new Error('invalid envelope');
      const envelope = supplied as { result: unknown; actualCost?: unknown };
      const hasCost = Object.hasOwn(envelope, 'actualCost');
      const actualCost = hasCost ? envelope.actualCost : undefined;
      if (hasCost && (typeof actualCost !== 'number' || !integer(actualCost))) throw new Error('uncertain accounting');
      // Copy all supplier-controlled fields while still inside the uncertainty boundary;
      // malformed envelopes/accessors must never strand a submitted reservation.
      response = { result: hasCost ? envelope.result : validateCandidate(request, envelope.result),
        ...(hasCost ? { actualCost: actualCost as number } : {}) };
    }
    catch { await this.pending(key); throw new ControlError('ACCOUNTING_PENDING', 503); }
    if (response.actualCost === undefined) {
      // Candidate delivery does not prove a bill. Only excess above a verified ceiling can be released.
      // Observe cancellation and independent settlement in the same transaction.
      const delivery = await this.store.transact(state => {
        const entry = state.requests[key];
        if (entry.status !== 'settled') {
          entry.status = 'pending';
          const ceiling = entry.verifiedBoundFen;
          if (this.config.allowBoundedPending && !entry.error && !this.hasAccountingAnomaly(state) &&
              ceiling !== undefined && integer(ceiling) && ceiling < entry.bound) {
            const previous = entry.bound;
            state.budgets[entry.period].reserved -= previous - ceiling;
            entry.bound = ceiling;
            this.audit(state, `reservation-excess-released:${entry.requestId}:${previous}:${ceiling}`, entry.subjectId);
          }
        }
        return { cancelled: entry.cancelled, accounting: entry.status === 'settled' ? 'settled' as const : 'pending' as const };
      });
      if (delivery.cancelled) throw new ControlError('CANCELLED');
      return { requestId: request.requestId, result: response.result,
        context: { restoreGeneration: request.restoreGeneration, inputDigest: request.sendConfirmation }, accounting: delivery.accounting };
    }
    await this.store.transact(state => this.settleState(state, key, response.actualCost!));
    const reservation = (await this.store.read()).requests[key];
    if (reservation.cancelled) throw new ControlError('CANCELLED');
    const result = validateCandidate(request, response.result);
    return { requestId: request.requestId, result, context: { restoreGeneration: request.restoreGeneration, inputDigest: request.sendConfirmation }, accounting: 'settled' as const };
  }
  private async pending(key: string) { await this.store.transact(state => { if (state.requests[key].status !== 'settled') {
    state.requests[key].status = 'pending'; state.requests[key].error = 'SUPPLIER_UNCERTAIN';
  } }); }
  private releaseUnsubmitted(state: ControlState, key: string) {
    const entry = state.requests[key]; if (entry.status !== 'reserved') throw new ControlError('ALREADY_SUBMITTED');
    state.budgets[entry.period].reserved -= entry.bound; const usage = state.usages[usageKey(entry.subjectId, entry.period)];
    usage[entry.operation] = (usage[entry.operation] ?? 0) - 1; entry.status = 'released';
  }
  async cancel(value: string, requestId: string) {
    const sessionDigest = await digest(value, this.config.digestSecret);
    await this.store.transact(state => {
      const subjectId = this.qualification(state, sessionDigest), key = requestKey(subjectId, requestId), entry = state.requests[key];
      if (!entry) throw new ControlError('REQUEST_NOT_FOUND', 404); entry.cancelled = true;
      if (entry.status === 'reserved') this.releaseUnsubmitted(state, key);
      // Submitted calls retain their full reservation until evidence-based settlement.
    });
  }
  private settleState(state: ControlState, key: string, actualCost: number) {
    const entry = state.requests[key]; if (!entry) throw new ControlError('REQUEST_NOT_FOUND', 404);
    if (entry.status === 'settled') { if (entry.actualCost !== actualCost) throw new ControlError('SETTLEMENT_CONFLICT'); return; }
    if (!['submitted', 'pending'].includes(entry.status)) throw new ControlError('NOT_SUBMITTED');
    const budget = state.budgets[entry.period]; budget.reserved -= entry.bound; budget.spent += actualCost;
    entry.actualCost = actualCost; entry.status = 'settled';
    if (actualCost > entry.bound || budget.spent + budget.reserved > this.config.budgetLimit) { state.recoveryRequired = true; state.aiEnabled = false; this.audit(state, 'cost-bound-breached'); }
  }
  async settle(admin: string, subjectId: string, requestId: string, actualCost: number) {
    await this.admin(admin); if (!integer(actualCost)) throw new ControlError('INVALID_COST', 400);
    await this.store.transact(state => {
      const wasSettled = state.requests[requestKey(subjectId, requestId)]?.status === 'settled';
      this.settleState(state, requestKey(subjectId, requestId), actualCost);
      if (!wasSettled) for (const application of Object.values(state.applications ?? {})) if (application.subjectId === subjectId) application.accountingClosedAt = this.now();
      this.audit(state, 'request-reconciled', subjectId);
    });
  }
  async markLedgerRecovered(admin: string) {
    await this.admin(admin); await this.store.transact(state => {
      state.aiEnabled = false; state.recoveryRequired = true;
      for (const request of Object.values(state.requests)) if (['reserved', 'submitted'].includes(request.status)) request.status = 'pending';
      this.audit(state, 'ledger-recovery');
    });
  }
  async confirmReconciled(admin: string, evidence: { budgets: Record<string, number>; usages: Record<string, OperationCounts> }) {
    await this.admin(admin); await this.store.transact(state => {
      if (Object.values(state.requests).some(r => ['pending', 'submitted', 'reserved'].includes(r.status))) throw new ControlError('RECONCILIATION_REQUIRED', 503);
      const summaryEvidenceKeys = new Set<string>();
      if ((this.config.quotas.summary ?? 0) > 0 && this.config.requestBounds.summary !== undefined) {
        for (const subjectId of Object.keys(state.subjects)) summaryEvidenceKeys.add(usageKey(subjectId, this.period()));
        for (const key of Object.keys(state.usages)) summaryEvidenceKeys.add(key);
        for (const key of Object.keys(evidence?.usages ?? {})) summaryEvidenceKeys.add(key);
      }
      for (const [key, usage] of Object.entries(state.usages)) if (usage.summary !== undefined) summaryEvidenceKeys.add(key);
      for (const request of Object.values(state.requests)) if (request.operation === 'summary') summaryEvidenceKeys.add(usageKey(request.subjectId, request.period));
      if (!evidence || !evidence.budgets || !evidence.usages || !Object.hasOwn(evidence.budgets, this.period()) ||
        Object.keys(state.budgets).some(period => !Object.hasOwn(evidence.budgets, period)) ||
        Object.keys(state.subjects).some(subjectId => !Object.hasOwn(evidence.usages, usageKey(subjectId, this.period()))) ||
        Object.entries(evidence.budgets).some(([period, spent]) => !/^\d{4}-\d{2}$/.test(period) || !integer(spent)) ||
        Object.entries(evidence.usages).some(([key, usage]) => !/^[a-f0-9-]{36}:\d{4}-\d{2}$/.test(key) || !integer(usage.understand) || !integer(usage.generate) || (usage.summary !== undefined && !integer(usage.summary))) ||
        [...summaryEvidenceKeys].some(key => !evidence.usages[key] || !integer(evidence.usages[key].summary!))) throw new ControlError('RECONCILIATION_EVIDENCE_REQUIRED', 400);
      // Owner supplies independent billing/count evidence, including records missing from a restored snapshot.
      // Reconciliation never decreases known charges or usage. Empty current month must be explicit.
      for (const [period, spent] of Object.entries(evidence.budgets)) {
        const budget = state.budgets[period] ?? { spent: 0, reserved: 0 }; budget.spent = Math.max(budget.spent, spent); state.budgets[period] = budget;
      }
      for (const [key, observed] of Object.entries(evidence.usages)) {
        const known = state.usages[key] ?? { understand: 0, generate: 0 };
        state.usages[key] = { understand: Math.max(known.understand, observed.understand), generate: Math.max(known.generate, observed.generate),
          ...(known.summary !== undefined || observed.summary !== undefined ? { summary: Math.max(known.summary ?? 0, observed.summary ?? 0) } : {}) };
      }
      state.recoveryRequired = false; state.aiEnabled = false; this.audit(state, 'ledger-reconciled');
    });
  }
  assertApplicable(context: { restoreGeneration: number; inputDigest: string }, currentGeneration: number, currentInputDigest = context.inputDigest) {
    if (context.restoreGeneration !== currentGeneration) throw new ControlError('STALE_RESTORE_GENERATION');
    if (context.inputDigest !== currentInputDigest) throw new ControlError('STALE_INPUT');
  }
}
