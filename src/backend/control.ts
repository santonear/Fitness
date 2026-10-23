import { COACH_V8_PROMPT_VERSION } from './coach-v8-version';
import { canonical, digest, validateCandidate, validateTransportRequest } from './contracts';
import { ControlError, type OperationCounts } from './store';
import { COACH_PROMPT_VERSION, coachTask } from './coach-prompt-registry';
import { CATALOG_VERSION } from '../catalog/exercises';
import { integer, requestKey, usageKey } from './control/config';
import { ControlAccess } from './control/access';
export { ControlError } from './store';
export { testConfig, type ControlConfig, type ExternalSupplier } from './control/config';

export class ControlService extends ControlAccess {
  async status(value: string) {
    const sessionDigest = await digest(value, this.config.digestSecret);
    const state = await this.store.read();
    const subjectId = this.qualification(state, sessionDigest);
    return { subjectId, ...this.subjectStatus(state, subjectId) };
  }
  /** Read-only ownership lookup. A receipt never creates or authenticates a session. */
  async accessStatus(value?: string, receipt?: string) {
    if (receipt !== undefined && !/^[a-f0-9]{64}$/.test(receipt))
      throw new ControlError('APPLICATION_CREDENTIAL_REQUIRED', 401);
    const state = await this.store.read();
    const session = value ? state.sessions[await digest(value, this.config.digestSecret)] : undefined;
    const owner = receipt ? await digest(`application:${receipt}`, this.config.digestSecret) : undefined;
    const owned = owner
      ? Object.values(state.applications ?? {})
          .filter(a => a.ownerDigest === owner && a.state === 'claimed' && a.subjectId)
          .sort((a, b) => b.createdAt - a.createdAt)[0]
      : undefined;
    // An existing cookie takes precedence: another receipt cannot change its identity.
    const subjectId = session?.subjectId ?? owned?.subjectId;
    const subject = subjectId ? state.subjects[subjectId] : undefined;
    if (!subject || !subjectId) return { qualification: 'none' as const, sessionValid: false };
    const qualification = subject.revoked
      ? ('revoked' as const)
      : subject.expiresAt <= this.now()
        ? ('expired' as const)
        : ('active' as const);
    const sessionValid = qualification === 'active' && Boolean(session && !session.revoked);
    return { qualification, sessionValid, ...this.subjectStatus(state, subjectId) };
  }
  async submit(value: string, payload: unknown) {
    const sessionDigest = await digest(value, this.config.digestSecret);
    this.qualification(await this.store.read(), sessionDigest);
    const request = await validateTransportRequest(payload, this.config.k, this.config.maxInputBytes);
    const verifiedBoundFen = this.config.allowBoundedPending ? this.supplier.costUpperBoundFen?.(request) : undefined;
    if (
      !this.budgetDisabled(request.operation) &&
      this.config.allowBoundedPending &&
      (verifiedBoundFen === undefined ||
        !integer(verifiedBoundFen) ||
        verifiedBoundFen > this.config.requestBounds[request.operation]!)
    )
      throw new ControlError('COST_BOUND_UNVERIFIED', 503);
    const inputDigest = await digest(canonical(request), this.config.digestSecret),
      period = this.period();
    const key = await this.store.transact(state => {
      const subjectId = this.qualification(state, sessionDigest),
        key = requestKey(subjectId, request.requestId),
        previous = state.requests[key];
      if (previous) {
        if (previous.inputDigest !== inputDigest) throw new ControlError('REQUEST_CONFLICT');
        throw new ControlError(
          ['reserved', 'submitted', 'pending'].includes(previous.status) ? 'REQUEST_IN_PROGRESS' : 'RESULT_UNAVAILABLE',
        );
      }
      if (this.needsReconciliation(state, period, request.operation === 'generate'))
        throw new ControlError('RECONCILIATION_REQUIRED', 503);
      if (!state.aiEnabled) throw new ControlError('AI_DISABLED', 503);
      if (
        request.operation === 'summary' &&
        (!(this.config.quotas.summary ?? 0) || this.config.requestBounds.summary === undefined)
      )
        throw new ControlError('SUMMARY_DISABLED', 503);
      const bound = this.config.requestBounds[request.operation]!;
      if (!this.budgetDisabled(request.operation) && bound > this.config.maximumRequestCost)
        throw new ControlError('REQUEST_COST_BOUND', 400);
      const used = state.usages[usageKey(subjectId, period)] ?? { understand: 0, generate: 0 };
      if (
        request.operation !== 'understand' &&
        (used[request.operation] ?? 0) >= (this.quotaLimits(state, subjectId, period)[request.operation] ?? 0)
      )
        throw new ControlError('INDIVIDUAL_QUOTA_EXHAUSTED', 429);
      const budget = state.budgets[period] ?? { spent: 0, reserved: 0 };
      const carriedReservations = this.config.allowBoundedPending
        ? Object.entries(state.budgets).reduce((sum, [key, value]) => sum + (key !== period ? value.reserved : 0), 0)
        : 0;
      if (
        !this.budgetDisabled(request.operation) &&
        budget.spent + budget.reserved + carriedReservations + bound > this.config.budgetLimit
      )
        throw new ControlError('GLOBAL_BUDGET_EXHAUSTED', 429);
      if (
        Object.values(state.requests).filter(r => ['reserved', 'submitted'].includes(r.status)).length >=
        this.config.maxConcurrent
      )
        throw new ControlError('CONCURRENCY_LIMIT', 429);
      used[request.operation] = (used[request.operation] ?? 0) + 1;
      budget.reserved += bound;
      state.usages[usageKey(subjectId, period)] = used;
      state.budgets[period] = budget;
      state.requests[key] = {
        subjectId,
        requestId: request.requestId,
        inputDigest,
        operation: request.operation,
        period,
        bound,
        status: 'reserved',
        cancelled: false,
        createdAt: this.now(),
        ...('dialogue' in request && request.dialogue
          ? {
              coachContract: {
                promptVersion: COACH_PROMPT_VERSION,
                schemaVersion: request.dialogue.version,
                catalogVersion: CATALOG_VERSION,
                task: request.dialogue.coachTask ?? coachTask(request.dialogue.purpose),
              },
            }
          : {}),
        ...('coach' in request
          ? {
              coachContract: {
                promptVersion: this.config.coachPromptVersion ?? COACH_V8_PROMPT_VERSION,
                schemaVersion: request.coach.version,
                catalogVersion: CATALOG_VERSION,
                task: request.coach.task,
              },
            }
          : {}),
        ...(verifiedBoundFen === undefined ? {} : { verifiedBoundFen }),
      };
      return key;
    });
    // Recheck authoritative accounting at the same boundary which grants submission.
    // Admission can have completed before another call became pending or the month changed.
    const submitted = await this.store.transact(state => {
      const reservation = state.requests[key];
      if (reservation.status !== 'reserved') return false;
      try {
        this.qualification(state, sessionDigest);
      } catch {
        this.releaseUnsubmitted(state, key);
        return false;
      }
      const currentBound = this.config.allowBoundedPending ? this.supplier.costUpperBoundFen?.(request) : undefined;
      if (
        reservation.cancelled ||
        !state.aiEnabled ||
        this.needsReconciliation(state, this.period(), request.operation === 'generate') ||
        (!this.budgetDisabled(request.operation) &&
          this.config.allowBoundedPending &&
          (currentBound === undefined || !integer(currentBound) || currentBound > reservation.bound))
      ) {
        this.releaseUnsubmitted(state, key);
        return false;
      }
      // Keep the larger verified ceiling if provider configuration changed after admission.
      if (currentBound !== undefined)
        reservation.verifiedBoundFen = Math.max(reservation.verifiedBoundFen ?? currentBound, currentBound);
      reservation.status = 'submitted';
      return true;
    });
    if (!submitted) throw new ControlError('NOT_SUBMITTED');
    let response: { result: unknown; actualCost?: number };
    let supplierReturned = false;
    try {
      const supplied: unknown = await this.supplier.call(request);
      supplierReturned = true;
      if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied) || !Object.hasOwn(supplied, 'result'))
        throw new Error('invalid envelope');
      const envelope = supplied as { result: unknown; actualCost?: unknown };
      const hasCost = Object.hasOwn(envelope, 'actualCost');
      const actualCost = hasCost ? envelope.actualCost : undefined;
      if (hasCost && (typeof actualCost !== 'number' || !integer(actualCost))) throw new Error('uncertain accounting');
      // Copy all supplier-controlled fields while still inside the uncertainty boundary;
      // malformed envelopes/accessors must never strand a submitted reservation.
      response = {
        result: hasCost ? envelope.result : validateCandidate(request, envelope.result),
        ...(hasCost ? { actualCost: actualCost as number } : {}),
      };
    } catch (error) {
      if (supplierReturned) {
        try {
          this.onCandidateFailure?.(error);
        } catch {
          /* Diagnostics cannot change accounting. */
        }
      }
      await this.pending(key);
      throw new ControlError('ACCOUNTING_PENDING', 503);
    }
    if (response.actualCost === undefined) {
      // Candidate delivery does not prove a bill. Only excess above a verified ceiling can be released.
      // Observe cancellation and independent settlement in the same transaction.
      const delivery = await this.store.transact(state => {
        const entry = state.requests[key];
        if (entry.status !== 'settled') {
          entry.status = 'pending';
          const ceiling = entry.verifiedBoundFen;
          if (
            this.config.allowBoundedPending &&
            !entry.error &&
            !this.hasAccountingAnomaly(state) &&
            ceiling !== undefined &&
            integer(ceiling) &&
            ceiling < entry.bound
          ) {
            const previous = entry.bound;
            state.budgets[entry.period].reserved -= previous - ceiling;
            entry.bound = ceiling;
            this.audit(state, `reservation-excess-released:${entry.requestId}:${previous}:${ceiling}`, entry.subjectId);
          }
        }
        return {
          cancelled: entry.cancelled,
          accounting: entry.status === 'settled' ? ('settled' as const) : ('pending' as const),
        };
      });
      if (delivery.cancelled) throw new ControlError('CANCELLED');
      return {
        requestId: request.requestId,
        result: response.result,
        context: { restoreGeneration: request.restoreGeneration, inputDigest: request.sendConfirmation },
        accounting: delivery.accounting,
      };
    }
    await this.store.transact(state => this.settleState(state, key, response.actualCost!));
    const reservation = (await this.store.read()).requests[key];
    if (reservation.cancelled) throw new ControlError('CANCELLED');
    const result = validateCandidate(request, response.result);
    return {
      requestId: request.requestId,
      result,
      context: { restoreGeneration: request.restoreGeneration, inputDigest: request.sendConfirmation },
      accounting: 'settled' as const,
    };
  }
  async cancel(value: string, requestId: string) {
    const sessionDigest = await digest(value, this.config.digestSecret);
    await this.store.transact(state => {
      const subjectId = this.qualification(state, sessionDigest),
        key = requestKey(subjectId, requestId),
        entry = state.requests[key];
      if (!entry) throw new ControlError('REQUEST_NOT_FOUND', 404);
      entry.cancelled = true;
      if (entry.status === 'reserved') this.releaseUnsubmitted(state, key);
      // Submitted calls retain their full reservation until evidence-based settlement.
    });
  }
  async settle(admin: string, subjectId: string, requestId: string, actualCost: number) {
    await this.admin(admin);
    if (!integer(actualCost)) throw new ControlError('INVALID_COST', 400);
    await this.store.transact(state => {
      const wasSettled = state.requests[requestKey(subjectId, requestId)]?.status === 'settled';
      this.settleState(state, requestKey(subjectId, requestId), actualCost);
      if (!wasSettled)
        for (const application of Object.values(state.applications ?? {}))
          if (application.subjectId === subjectId) application.accountingClosedAt = this.now();
      this.audit(state, 'request-reconciled', subjectId);
    });
  }
  async markLedgerRecovered(admin: string) {
    await this.admin(admin);
    await this.store.transact(state => {
      state.aiEnabled = false;
      state.recoveryRequired = true;
      for (const request of Object.values(state.requests))
        if (['reserved', 'submitted'].includes(request.status)) request.status = 'pending';
      this.audit(state, 'ledger-recovery');
    });
  }
  async confirmReconciled(
    admin: string,
    evidence: { budgets: Record<string, number>; usages: Record<string, OperationCounts> },
  ) {
    await this.admin(admin);
    await this.store.transact(state => {
      if (Object.values(state.requests).some(r => ['pending', 'submitted', 'reserved'].includes(r.status)))
        throw new ControlError('RECONCILIATION_REQUIRED', 503);
      const summaryEvidenceKeys = new Set<string>();
      if ((this.config.quotas.summary ?? 0) > 0 && this.config.requestBounds.summary !== undefined) {
        for (const subjectId of Object.keys(state.subjects))
          summaryEvidenceKeys.add(usageKey(subjectId, this.period()));
        for (const key of Object.keys(state.usages)) summaryEvidenceKeys.add(key);
        for (const key of Object.keys(evidence?.usages ?? {})) summaryEvidenceKeys.add(key);
      }
      for (const [key, usage] of Object.entries(state.usages))
        if (usage.summary !== undefined) summaryEvidenceKeys.add(key);
      for (const request of Object.values(state.requests))
        if (request.operation === 'summary') summaryEvidenceKeys.add(usageKey(request.subjectId, request.period));
      if (
        !evidence ||
        !evidence.budgets ||
        !evidence.usages ||
        !Object.hasOwn(evidence.budgets, this.period()) ||
        Object.keys(state.budgets).some(period => !Object.hasOwn(evidence.budgets, period)) ||
        Object.keys(state.subjects).some(
          subjectId => !Object.hasOwn(evidence.usages, usageKey(subjectId, this.period())),
        ) ||
        Object.entries(evidence.budgets).some(([period, spent]) => !/^\d{4}-\d{2}$/.test(period) || !integer(spent)) ||
        Object.entries(evidence.usages).some(
          ([key, usage]) =>
            !/^[a-f0-9-]{36}:\d{4}-\d{2}$/.test(key) ||
            !integer(usage.understand) ||
            !integer(usage.generate) ||
            (usage.summary !== undefined && !integer(usage.summary)),
        ) ||
        [...summaryEvidenceKeys].some(key => !evidence.usages[key] || !integer(evidence.usages[key].summary!))
      )
        throw new ControlError('RECONCILIATION_EVIDENCE_REQUIRED', 400);
      // Owner supplies independent billing/count evidence, including records missing from a restored snapshot.
      // Reconciliation never decreases known charges or usage. Empty current month must be explicit.
      for (const [period, spent] of Object.entries(evidence.budgets)) {
        const budget = state.budgets[period] ?? { spent: 0, reserved: 0 };
        budget.spent = Math.max(budget.spent, spent);
        state.budgets[period] = budget;
      }
      for (const [key, observed] of Object.entries(evidence.usages)) {
        const known = state.usages[key] ?? { understand: 0, generate: 0 };
        state.usages[key] = {
          understand: Math.max(known.understand, observed.understand),
          generate: Math.max(known.generate, observed.generate),
          ...(known.summary !== undefined || observed.summary !== undefined
            ? { summary: Math.max(known.summary ?? 0, observed.summary ?? 0) }
            : {}),
        };
      }
      state.recoveryRequired = false;
      state.aiEnabled = false;
      this.audit(state, 'ledger-reconciled');
    });
  }
  assertApplicable(
    context: { restoreGeneration: number; inputDigest: string },
    currentGeneration: number,
    currentInputDigest = context.inputDigest,
  ) {
    if (context.restoreGeneration !== currentGeneration) throw new ControlError('STALE_RESTORE_GENERATION');
    if (context.inputDigest !== currentInputDigest) throw new ControlError('STALE_INPUT');
  }
}
