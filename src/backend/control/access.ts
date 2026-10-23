import { digest } from '../contracts';
import { ControlError } from '../store';
import { buildAdminReport } from '../admin-report';
import { applicationAdminView } from '../trial-applications';
import { DAY_MS as DAY } from '../../domain/local-date';
import { integer, token, usageKey } from './config';
import { ControlCore } from './core';

export class ControlAccess extends ControlCore {
  async retainLedger(admin: string) {
    await this.admin(admin);
    await this.store.transact(state => {
      for (const [key, invite] of Object.entries(state.invites))
        if (invite.expiresAt <= this.now()) delete state.invites[key];
      for (const [key, session] of Object.entries(state.sessions)) {
        const subject = state.subjects[session.subjectId];
        if (!subject || subject.expiresAt <= this.now()) delete state.sessions[key];
      }
      // Quota, cost and request tombstones have no TTL: pruning them could revive spent
      // allowance or erase unresolved charges. Subject tombstones preserve reissue expiry.
      this.audit(state, 'credential-retention');
    });
  }
  async issue(admin: string) {
    await this.admin(admin);
    const code = this.config.adminOperationId
        ? await digest(`admin-invite:${this.config.adminOperationId}`, this.config.digestSecret)
        : token(),
      codeDigest = await digest(code, this.config.digestSecret);
    const expiresAt = this.now() + 7 * DAY;
    const savedExpiry = await this.store.transact(state => {
      state.invites[codeDigest] = { expiresAt, redeemed: false };
      this.audit(state, 'invite-issued');
      return expiresAt;
    });
    return { code, inviteId: codeDigest, expiresAt: savedExpiry };
  }
  async revokeInvite(admin: string, inviteId: string) {
    await this.admin(admin);
    await this.store.transact(state => {
      const invite = state.invites[inviteId];
      if (!invite) throw new ControlError('INVITE_NOT_FOUND', 404);
      invite.redeemed = true;
      this.audit(state, 'invite-revoked');
    });
  }
  async redeem(code: string) {
    if (!/^[a-f0-9]{64}$/.test(code)) throw new ControlError('INVITE_INVALID', 401);
    const codeDigest = await digest(code, this.config.digestSecret),
      value = token(),
      sessionDigest = await digest(value, this.config.digestSecret),
      subjectId = crypto.randomUUID();
    const qualification = await this.store.transact(state => {
      const invite = state.invites[codeDigest];
      if (!invite || invite.redeemed || invite.expiresAt <= this.now()) throw new ControlError('INVITE_INVALID', 401);
      const id = invite.subjectId ?? subjectId;
      const existing = invite.subjectId && state.subjects[invite.subjectId];
      if (invite.subjectId && (!existing || existing.deletedAt !== undefined || existing.expiresAt <= this.now()))
        throw new ControlError('SUBJECT_EXPIRED', 401);
      invite.redeemed = true;
      const expiry = existing ? existing.expiresAt : this.now() + 30 * DAY;
      state.subjects[id] = { expiresAt: expiry, revoked: false };
      state.sessions[sessionDigest] = { subjectId: id, revoked: false };
      this.audit(state, 'invite-redeemed', id);
      return { subjectId: id, expiresAt: expiry };
    });
    return { token: value, ...qualification };
  }
  async revoke(admin: string, subjectId: string) {
    await this.admin(admin);
    await this.store.transact(state => {
      const subject = state.subjects[subjectId];
      if (!subject) throw new ControlError('SUBJECT_NOT_FOUND', 404);
      subject.revoked = true;
      for (const session of Object.values(state.sessions)) if (session.subjectId === subjectId) session.revoked = true;
      for (const invite of Object.values(state.invites)) if (invite.subjectId === subjectId) invite.redeemed = true;
      this.audit(state, 'subject-revoked', subjectId);
    });
  }
  async deleteSubject(admin: string, subjectId: string) {
    await this.admin(admin);
    return this.store.transact(state => {
      const subject = state.subjects[subjectId];
      if (!subject) throw new ControlError('SUBJECT_NOT_FOUND', 404);
      if (subject.deletedAt !== undefined) return;
      subject.deletedAt = this.now();
      subject.revoked = true;
      for (const session of Object.values(state.sessions)) if (session.subjectId === subjectId) session.revoked = true;
      for (const invite of Object.values(state.invites)) if (invite.subjectId === subjectId) invite.redeemed = true;
      this.audit(state, 'subject-deleted', subjectId);
    });
  }
  async activateApplication(admin: string, id: string) {
    await this.admin(admin);
    const newSubjectId = crypto.randomUUID();
    return this.store.transact(state => {
      const application = state.applications?.[id];
      if (!application) throw new ControlError('APPLICATION_NOT_FOUND', 404);
      const existing = application.subjectId ? state.subjects[application.subjectId] : undefined;
      if (existing?.deletedAt !== undefined || existing?.revoked) throw new ControlError('QUALIFICATION_REQUIRED', 401);
      // Repeated activation never extends time, resets usage, or revives revoked access.
      if (application.directlyActivated || (existing && existing.expiresAt > this.now()))
        return applicationAdminView(application);
      if (application.kind !== 'new' || !['pending', 'approved'].includes(application.state))
        throw new ControlError('APPLICATION_CONFLICT');
      const expiresAt = this.now() + 30 * DAY;
      state.subjects[newSubjectId] = { expiresAt, revoked: false };
      Object.assign(application, {
        subjectId: newSubjectId,
        state: 'approved',
        directlyActivated: true,
        decidedAt: this.now(),
        actor: 'owner',
        expiresAt,
        claimUntil: expiresAt,
      });
      this.audit(state, 'subject-directly-activated', newSubjectId);
      return applicationAdminView(application);
    });
  }
  async reissue(admin: string, subjectId: string) {
    await this.admin(admin);
    const code = this.config.adminOperationId
        ? await digest(`admin-reissue:${this.config.adminOperationId}`, this.config.digestSecret)
        : token(),
      codeDigest = await digest(code, this.config.digestSecret);
    const expiresAt = await this.store.transact(state => {
      const subject = state.subjects[subjectId];
      if (!subject || subject.deletedAt !== undefined || subject.expiresAt <= this.now())
        throw new ControlError('SUBJECT_EXPIRED', 401);
      for (const session of Object.values(state.sessions)) if (session.subjectId === subjectId) session.revoked = true;
      for (const invite of Object.values(state.invites)) if (invite.subjectId === subjectId) invite.redeemed = true;
      subject.revoked = true;
      state.invites[codeDigest] = {
        subjectId,
        redeemed: false,
        expiresAt: Math.min(subject.expiresAt, this.now() + 7 * DAY),
      };
      this.audit(state, 'replacement-invite-issued', subjectId);
      return subject.expiresAt;
    });
    return { code, inviteId: codeDigest, subjectId, expiresAt };
  }
  async adminReport(admin: string) {
    await this.admin(admin);
    return buildAdminReport(await this.store.read(), this.now());
  }
  async managementReport(admin: string) {
    await this.admin(admin);
    const state = await this.store.read();
    const report = buildAdminReport(state, this.now());
    report.subjects = report.subjects.filter(subject => state.subjects[subject.subjectId].deletedAt === undefined);
    return {
      report,
      applications: Object.values(state.applications ?? {})
        .filter(a => !a.subjectId || state.subjects[a.subjectId]?.deletedAt === undefined)
        .map(applicationAdminView),
      invites: Object.entries(state.invites)
        .filter(([, invite]) => !invite.redeemed && invite.expiresAt > this.now())
        .map(([inviteId, invite]) => ({ inviteId, expiresAt: invite.expiresAt })),
      quotas: Object.keys(state.subjects).map(subjectId => {
        const period = this.period(),
          used = state.usages[usageKey(subjectId, period)] ?? { understand: 0, generate: 0 };
        return {
          subjectId,
          period,
          used,
          limits: this.quotaLimits(state, subjectId, period),
          defaults: this.config.quotas,
        };
      }),
      quotaRestorations: Object.entries(state.quotaRestorations ?? {}).map(([id, entry]) => ({ id, ...entry })),
      audit: state.audit.slice(-100),
      policy: {
        planningBudgetDisabled: this.config.planningBudgetDisabled === true,
        budgetLimit: this.config.budgetLimit,
        reservation: this.config.maximumRequestCost,
        timeZone: this.config.timeZone,
      },
      service: {
        mode: this.config.mode,
        provider: this.supplier.kind,
        reconciliationRequired: this.needsReconciliation(state, this.period()),
        planningReconciliationRequired: this.needsReconciliation(state, this.period(), true),
      },
    };
  }
  async enableMock(admin: string, enabled: boolean) {
    if (this.config.mode !== 'local-test') throw new ControlError('MOCK_ONLY', 400);
    return this.enableSupplier(admin, enabled);
  }
  async restoreQuota(admin: string, input: { id: string; subjectId: string; period: string; reason: string }) {
    await this.admin(admin);
    const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
    if (
      !uuid.test(input.id) ||
      !uuid.test(input.subjectId) ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(input.period) ||
      typeof input.reason !== 'string' ||
      !input.reason.trim() ||
      input.reason.length > 200
    )
      throw new ControlError('INVALID_INPUT', 400);
    return this.store.transact(state => {
      const previous = state.quotaRestorations?.[input.id];
      if (previous) {
        if (
          previous.subjectId !== input.subjectId ||
          previous.period !== input.period ||
          previous.reason !== input.reason
        )
          throw new ControlError('REQUEST_CONFLICT');
        return previous;
      }
      if (input.period !== this.period()) throw new ControlError('QUOTA_PERIOD_CHANGED');
      const subject = state.subjects[input.subjectId];
      if (!subject || subject.revoked || subject.expiresAt <= this.now())
        throw new ControlError('QUALIFICATION_REQUIRED', 401);
      if (state.recoveryRequired || this.hasAccountingAnomaly(state))
        throw new ControlError('RECONCILIATION_REQUIRED', 503);
      const used = state.usages[usageKey(input.subjectId, input.period)] ?? { understand: 0, generate: 0 };
      if (!integer(used.understand) || !integer(used.generate)) throw new ControlError('RECONCILIATION_REQUIRED', 503);
      const entry = {
        subjectId: input.subjectId,
        period: input.period,
        reason: input.reason,
        at: this.now(),
        credits: { understand: used.understand, generate: used.generate },
      };
      (state.quotaRestorations ??= {})[input.id] = entry;
      this.quotaLimits(state, input.subjectId, input.period);
      this.audit(state, `quota-restored:${input.id}`, input.subjectId);
      return entry;
    });
  }
  async enableSupplier(admin: string, enabled: boolean) {
    await this.admin(admin);
    await this.store.transact(state => {
      if (enabled && state.recoveryRequired) throw new ControlError('RECONCILIATION_REQUIRED', 503);
      state.aiEnabled = enabled;
      this.audit(state, enabled ? 'supplier-enabled' : 'supplier-disabled');
    });
  }
}
