import { digest } from './contracts';
import { ControlError, type ControlState, type ControlStore } from './store';

const DAY = 86_400_000;
export type ApplicationKind = 'new' | 'extend' | 'replace';
export interface TrialApplication {
  id: string; ownerDigest: string; kind: ApplicationKind; name: string; note: string;
  createdAt: number; state: 'pending' | 'approved' | 'rejected' | 'claimed';
  subjectId?: string; decidedAt?: number; reason?: string; actor?: string;
  inviteId?: string; claimUntil?: number; sessionDigest?: string; expiresAt?: number;
  accountingClosedAt?: number;
}
export const applicationView = (a: TrialApplication) => ({ id: a.id, kind: a.kind, state: a.state,
  createdAt: a.createdAt, decidedAt: a.decidedAt, reason: a.reason, claimUntil: a.claimUntil, expiresAt: a.expiresAt });
export const applicationAdminView = (a: TrialApplication) => ({ ...applicationView(a), name: a.name, note: a.note, subjectId: a.subjectId, actor: a.actor });

/** Uses the existing CAS transaction so approval and qualification cannot diverge.
 * Bounded metadata only; no training, email, raw receipt, code or session is persisted. */
export class TrialApplications {
  constructor(private readonly store: ControlStore, private readonly secret: string, private readonly now = Date.now) {}
  private async owner(receipt: string) {
    if (!/^[a-f0-9]{64}$/.test(receipt)) throw new ControlError('APPLICATION_CREDENTIAL_REQUIRED', 401);
    return digest(`application:${receipt}`, this.secret);
  }
  private audit(state: ControlState, event: string, id: string) {
    state.audit.push({ at: this.now(), event: `${event}:${id}` });
    if (state.audit.length > 1000) state.audit.splice(0, state.audit.length - 1000);
  }
  async list(receipt: string) {
    const owner = await this.owner(receipt), state = await this.store.read();
    return Object.values(state.applications ?? {}).filter(a => a.ownerDigest === owner).map(applicationView);
  }
  async apply(input: { receipt: string; id: string; kind: ApplicationKind; name: string; note: string }, session?: string) {
    const ownerDigest = await this.owner(input.receipt);
    const sessionDigest = session ? await digest(session, this.secret) : undefined;
    return this.store.transact(state => {
      const apps = state.applications ??= {};
      const previous = apps[input.id];
      if (previous) {
        if (previous.ownerDigest !== ownerDigest || previous.kind !== input.kind || previous.name !== input.name || previous.note !== input.note) throw new ControlError('APPLICATION_CONFLICT');
        return applicationView(previous);
      }
      const owned = Object.values(apps).filter(a => a.ownerDigest === ownerDigest);
      const currentSession = sessionDigest ? state.sessions[sessionDigest] : undefined;
      const subjectId = currentSession && !currentSession.revoked ? currentSession.subjectId : owned.find(a => a.state === 'claimed' && a.subjectId)?.subjectId;
      const subject = subjectId ? state.subjects[subjectId] : undefined;
      if (input.kind === 'new' && subject) throw new ControlError('USE_EXTENSION');
      if (input.kind !== 'new' && (!subject || !subjectId || subject.revoked)) throw new ControlError('QUALIFICATION_REQUIRED', 401);
      if (input.kind === 'replace' && subject!.expiresAt <= this.now()) throw new ControlError('SUBJECT_EXPIRED', 401);
      if (Object.values(apps).some(a => (a.ownerDigest === ownerDigest || subjectId && a.subjectId === subjectId) &&
        (a.state === 'pending' || a.state === 'approved' && (a.claimUntil ?? Infinity) > this.now()))) throw new ControlError('APPLICATION_PENDING');
      if (owned.some(a => a.createdAt > this.now() - DAY)) throw new ControlError('APPLICATION_RATE_LIMIT', 429);
      if (Object.keys(apps).length >= 200) throw new ControlError('APPLICATION_CAPACITY', 503);
      // Receipt rotation must not bypass the admission throttle. This is a small-trial
      // global ceiling, applied atomically after retry lookup and before record creation.
      if (Object.values(apps).filter(a => a.createdAt > this.now() - 60_000).length >= 5 ||
          Object.values(apps).filter(a => a.createdAt > this.now() - 3_600_000).length >= 30) throw new ControlError('APPLICATION_BUSY', 429);
      const a: TrialApplication = { id: input.id, ownerDigest, kind: input.kind, name: input.name, note: input.note,
        createdAt: this.now(), state: 'pending', ...(subjectId ? { subjectId } : {}) };
      apps[a.id] = a; this.audit(state, 'application-created', a.id); return applicationView(a);
    });
  }
  async review(id: string, decision: 'approve' | 'reject', reason: string, actor: string) {
    return this.store.transact(state => {
      const a = state.applications?.[id]; if (!a) throw new ControlError('APPLICATION_NOT_FOUND', 404);
      if (a.state !== 'pending') {
        if ((decision === 'reject') !== (a.state === 'rejected')) throw new ControlError('APPLICATION_CONFLICT');
        return applicationView(a);
      }
      a.decidedAt = this.now(); a.reason = reason; a.actor = actor;
      if (decision === 'reject') a.state = 'rejected';
      else {
        if (a.kind !== 'new') {
          const subject = state.subjects[a.subjectId!];
          if (!subject || subject.revoked) throw new ControlError('QUALIFICATION_REQUIRED', 401);
          if (a.kind === 'extend') {
            subject.expiresAt = Math.max(subject.expiresAt, this.now()) + 30 * DAY;
            a.expiresAt = subject.expiresAt;
          } else {
            if (subject.expiresAt <= this.now()) throw new ControlError('SUBJECT_EXPIRED', 401);
            for (const s of Object.values(state.sessions)) if (s.subjectId === a.subjectId) s.revoked = true;
            for (const i of Object.values(state.invites)) if (i.subjectId === a.subjectId) i.redeemed = true;
          }
        }
        a.state = 'approved'; a.claimUntil = this.now() + 7 * DAY;
      }
      this.audit(state, `application-${decision}`, id); return applicationView(a);
    });
  }
  async claim(receipt: string, id: string) {
    const owner = await this.owner(receipt);
    // Deterministic delivery permits a lost HTTP response to be recovered without issuing
    // a second qualification. Only the receipt holder can reproduce this session.
    const token = await digest(`application-session:${receipt}:${id}`, this.secret);
    const sessionDigest = await digest(token, this.secret);
    const inviteId = await digest(`application-invite:${receipt}:${id}`, this.secret);
    const newSubjectId = crypto.randomUUID();
    return this.store.transact(state => {
      const a = state.applications?.[id];
      if (!a || a.ownerDigest !== owner) throw new ControlError('APPLICATION_NOT_FOUND', 404);
      if (a.state === 'claimed') {
        const subject = state.subjects[a.subjectId!], session = state.sessions[sessionDigest];
        if (!subject || subject.revoked || subject.expiresAt <= this.now() || !session || session.revoked) throw new ControlError('QUALIFICATION_REQUIRED', 401);
        return { token, subjectId: a.subjectId!, expiresAt: subject.expiresAt };
      }
      if (a.state !== 'approved') throw new ControlError('APPLICATION_NOT_APPROVED');
      if (!a.claimUntil || a.claimUntil <= this.now()) throw new ControlError('INVITE_INVALID', 401);
      const subjectId = a.subjectId ?? newSubjectId;
      let subject = state.subjects[subjectId];
      if (a.kind !== 'new' && (!subject || subject.revoked || subject.expiresAt <= this.now())) throw new ControlError('QUALIFICATION_REQUIRED', 401);
      subject ??= state.subjects[subjectId] = { expiresAt: this.now() + 30 * DAY, revoked: false };
      // All previous browser sessions are invalidated on replacement; recheck here too.
      if (a.kind !== 'new') for (const s of Object.values(state.sessions)) if (s.subjectId === subjectId) s.revoked = true;
      state.invites[inviteId] = { expiresAt: a.claimUntil, redeemed: true, subjectId };
      state.sessions[sessionDigest] = { subjectId, revoked: false };
      Object.assign(a, { state: 'claimed', subjectId, sessionDigest, inviteId, expiresAt: subject.expiresAt });
      this.audit(state, 'application-claimed', id);
      return { token, subjectId, expiresAt: subject.expiresAt };
    });
  }
  async report() {
    const state = await this.store.read();
    return Object.values(state.applications ?? {}).map(applicationAdminView);
  }
  async retain() {
    return this.store.transact(state => {
      let removed = 0;
      for (const [id, a] of Object.entries(state.applications ?? {})) {
        const subject = a.subjectId ? state.subjects[a.subjectId] : undefined;
        const unresolved = a.subjectId && Object.values(state.requests).some(r => r.subjectId === a.subjectId && ['reserved','submitted','pending'].includes(r.status));
        const closed = a.state === 'rejected' ? a.decidedAt : a.state === 'claimed' ? subject?.expiresAt : a.state === 'approved' ? Math.max(a.claimUntil ?? Infinity, subject?.expiresAt ?? 0) : undefined;
        if (!unresolved && closed !== undefined && Math.max(closed, a.accountingClosedAt ?? 0) + 30 * DAY <= this.now()) { delete state.applications![id]; removed++; }
      }
      this.audit(state, 'application-retention', String(removed)); return { removed };
    });
  }
}
