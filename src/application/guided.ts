import { repository, type Repository } from '../persistence/repository';
import { DomainError } from '../domain/errors';
import { biologicalSexAnswerSchema, emptyGuidedState, guidedStateSchema, programCandidateSchema, type GuidedAnswer, type GuidedState, type ProgramCandidate } from '../domain/guided-contracts';
import { createDayPlanService, slotTasks } from './day-plans';
import { evaluateSlot } from '../domain/day-slot-policy';
import { createBackupService } from './backup';
import { dateInZone } from './progress';

export function createGuidedService(repo: Repository) {
  async function read(): Promise<GuidedState> {
    return repo.db.transaction('r', [repo.db.guidedStates, repo.db.metadata], async () => {
      await repo.readMetadata(); return guidedStateSchema.parse(await repo.db.guidedStates.get('guided') ?? emptyGuidedState());
    });
  }
  async function change<T>(revision: number, operation: (state: GuidedState) => Promise<T>): Promise<T> {
    return repo.write(async () => {
      const state = await read();
      if (state.revision !== revision) throw new DomainError('CONFLICT', 'Local state changed; reopen this action');
      const result = await operation(state); state.revision++;
      await repo.db.guidedStates.put(guidedStateSchema.parse(state));
      // New local content must remain exportable, not silently exceed the existing complete-backup contract.
      await createBackupService(repo).exportBackup();
      return result;
    });
  }
  function event(state: GuidedState, input: Omit<GuidedState['events'][number], 'id' | 'createdAt'>) {
    const next = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() }; state.events.push(next); return next;
  }
  async function dependencies(state: GuidedState) {
    const profile = await repo.db.profiles.toCollection().first();
    return { onboardingSnapshot: JSON.stringify(state.onboarding?.answers ?? {}), profileSnapshot: JSON.stringify({ timeZone: profile?.timeZone, conditions: profile?.trainingPreferences }) };
  }
  async function captureDependencies() { return repo.db.transaction('r', repo.db.tables, async () => dependencies(await read())); }
  async function requireCurrentCandidate(state: GuidedState, candidate: ProgramCandidate) {
    const current = await dependencies(state);
    if (candidate.onboardingSnapshot !== current.onboardingSnapshot || candidate.profileSnapshot !== current.profileSnapshot) throw new DomainError('CONFLICT', 'Inputs changed; review this candidate again');
  }
  async function saveAnswer(key: string, answer: GuidedAnswer, step: number, revision: number) {
    return change(revision, async state => {
      state.onboarding ??= { id: crypto.randomUUID(), step: 0, answers: {}, completed: false, updatedAt: new Date().toISOString() };
      state.onboarding.answers[key] = answer; state.onboarding.step = step; state.onboarding.completed = false; state.onboarding.updatedAt = new Date().toISOString();
    });
  }
  async function setStep(step: number, revision: number) { return change(revision, async state => { if (state.onboarding) state.onboarding.step = step; }); }
  async function resetOnboarding(revision: number) { return change(revision, async state => { delete state.onboarding; }); }
  async function completeOnboarding(revision: number) { return change(revision, async state => {
    if (!biologicalSexAnswerSchema.safeParse(state.onboarding?.answers.biologicalSex).success) throw new DomainError('INVALID', 'Choose a biological sex response; prefer not to say is accepted');
    if (state.onboarding) state.onboarding.completed = true;
  }); }
  async function retainCandidate(input: ProgramCandidate, revision: number) {
    const candidate = programCandidateSchema.parse(input);
    return change(revision, async state => {
      if (candidate.restoreGeneration !== ((await repo.readMetadata()).restoreGeneration ?? 0)) throw new DomainError('CONFLICT', 'Candidate belongs to replaced data');
      await requireCurrentCandidate(state, candidate);
      const existing = state.candidates.find(item => item.id === candidate.id);
      if (existing && JSON.stringify(existing) !== JSON.stringify(candidate)) throw new DomainError('CONFLICT', 'Candidate identity already used');
      if (!existing) state.candidates.push(candidate);
    });
  }
  async function applyCandidate(id: string, revision: number, maximumDays: number) {
    if (!Number.isSafeInteger(maximumDays) || maximumDays < 1) throw new DomainError('INVALID', 'Explicit batch support required');
    return change(revision, async state => {
      const candidate = state.candidates.find(item => item.id === id);
      if (!candidate || candidate.days.length > maximumDays) throw new DomainError('INVALID', 'Candidate exceeds configured support');
      if (state.programs.some(item => item.candidateId === id)) throw new DomainError('CONFLICT', 'Candidate already confirmed');
      if (candidate.restoreGeneration !== ((await repo.readMetadata()).restoreGeneration ?? 0)) throw new DomainError('CONFLICT', 'Candidate belongs to replaced data');
      await requireCurrentCandidate(state, candidate);
      const now = new Date().toISOString(); const programId = crypto.randomUUID();
      for (const old of state.programs.filter(item => item.status !== 'terminated')) {
        const before = old.status; old.status = 'terminated'; old.revision++; old.updatedAt = now;
        for (const planId of old.planIds) { const plan = await repo.db.plans.get(planId); if (plan) await repo.db.plans.put({ ...plan, status: 'archived', revision: plan.revision + 1, updatedAt: now }); }
        event(state, { programId: old.id, action: 'replaced', before, after: 'terminated' });
      }
      // Existing independent date plans remain independent; only the one legacy current plan is replaced.
      for (const old of await repo.db.plans.filter(plan => !plan.model && plan.status === 'active').toArray()) {
        const tasks = await repo.db.scheduledWorkouts.where('planVersionId').equals(old.currentVersionId).toArray();
        if (tasks.length && !state.programs.some(item => item.planIds.includes(old.id))) {
          state.programs.push({ id: old.id, name: old.name, goal: '', startDate: tasks.map(item => item.originalDate).sort()[0], endDate: tasks.map(item => item.originalDate).sort().at(-1)!, timeZone: old.scheduleTimeZone,
            status: 'terminated', revision: 0, planIds: [old.id], taskIds: tasks.map(item => item.id), explanation: '', createdAt: old.createdAt, updatedAt: now });
          event(state, { programId: old.id, action: 'replaced', before: 'active', after: 'terminated' });
        }
        await repo.db.plans.put({ ...old, status: 'archived', revision: old.revision + 1, updatedAt: now });
      }
      const planIds: string[] = []; const taskIds: string[] = [];
      for (const day of candidate.days) {
        const saved = await createDayPlanService(repo).saveDayPlan({ name: candidate.name, date: day.date, timeZone: candidate.timeZone, exercises: day.exercises });
        await repo.db.plans.put({ ...saved.plan, source: 'ai' });
        await repo.db.planVersions.put({ ...saved.version, goalSnapshot: { goal: candidate.goal }, generationMetadata: { generatedAt: candidate.createdAt } });
        planIds.push(saved.plan.id); taskIds.push(saved.task.id);
      }
      state.programs.push({ id: programId, name: candidate.name, goal: candidate.goal, startDate: candidate.startDate, endDate: candidate.endDate, timeZone: candidate.timeZone,
        status: 'active', revision: 0, planIds, taskIds, candidateId: id, explanation: candidate.explanation, createdAt: now, updatedAt: now });
      event(state, { programId, action: 'created', after: 'active' }); return programId;
    });
  }
  async function transition(id: string, action: 'paused' | 'active' | 'terminated', revision: number, reason?: string) {
    return change(revision, async state => {
      const program = state.programs.find(item => item.id === id); if (!program || program.status === 'terminated') throw new DomainError('INVALID', 'No resumable current plan');
      const before = program.status;
      if (before === action || (action === 'active' && before !== 'paused')) throw new DomainError('CONFLICT', 'Plan status changed');
      if (action === 'active' && dateInZone(Date.now(), program.timeZone) > program.endDate) throw new DomainError('INVALID', 'Plan has ended; do not extend automatically');
      if (action === 'active' && program.candidateId) {
        const today = dateInZone(Date.now(), program.timeZone);
        const others = (await slotTasks(repo, program.timeZone)).filter(task => !program.taskIds.includes(task.taskId));
        for (const taskId of program.taskIds) {
          const task = await repo.db.scheduledWorkouts.get(taskId);
          if (task && task.scheduledDate >= today && !task.completedSessionId && !task.hiddenAt && task.status === 'pending' && evaluateSlot(others, task.scheduledDate).occupants.length) throw new DomainError('CONFLICT', 'A resumed date is occupied; review the conflicting arrangements');
        }
      }
      program.status = action; program.revision++; program.updatedAt = new Date().toISOString();
      if (action === 'terminated') for (const planId of program.planIds) { const plan = await repo.db.plans.get(planId); if (plan) await repo.db.plans.put({ ...plan, status: 'archived', revision: plan.revision + 1, updatedAt: program.updatedAt }); }
      const next = event(state, { programId: id, action: action === 'paused' ? 'paused' : action === 'active' ? 'resumed' : 'terminated', before, after: action, reason });
      if (action !== 'active') state.invitations.push({ id: crypto.randomUUID(), eventId: next.id, decision: 'pending' });
    });
  }
  async function transitionLegacy(id: string, action: 'paused' | 'active' | 'terminated', revision: number, reason?: string) {
    return repo.write(async () => {
      const state = await read();
      if (state.revision !== revision) throw new DomainError('CONFLICT', 'Local state changed');
      if (!state.programs.some(item => item.id === id)) {
        const plan = await repo.db.plans.get(id);
        if (!plan || plan.status !== 'active') throw new DomainError('CONFLICT', 'Legacy plan is no longer current');
        const tasks = await repo.db.scheduledWorkouts.where('planVersionId').equals(plan.currentVersionId).toArray();
        if (!tasks.length || state.programs.some(item => item.status !== 'terminated')) throw new DomainError('CONFLICT', 'Current plan changed');
        state.programs.push({ id: plan.id, name: plan.name, goal: '', startDate: tasks.map(item => item.originalDate).sort()[0], endDate: tasks.map(item => item.originalDate).sort().at(-1)!, timeZone: plan.scheduleTimeZone,
          status: 'active', revision: 0, planIds: [plan.id], taskIds: tasks.map(item => item.id), explanation: '', createdAt: plan.createdAt, updatedAt: new Date().toISOString() });
        await repo.db.guidedStates.put(guidedStateSchema.parse(state));
      }
      return transition(id, action, revision, reason);
    });
  }
  async function workoutTransition(sessionId: string, paused: boolean, revision: number) {
    return change(revision, async state => {
      const session = await repo.db.sessions.get(sessionId); if (!session || session.status !== 'in_progress') throw new DomainError('SESSION_READ_ONLY', 'Training has ended');
      const previous = state.events.filter(item => item.sessionId === sessionId && ['workout_paused', 'workout_resumed'].includes(item.action)).at(-1);
      if ((previous?.action === 'workout_paused') === paused) throw new DomainError('CONFLICT', 'Training state changed');
      const timerIds: string[] = [];
      if (paused) {
        const now = Date.now();
        for (const timer of await repo.db.timers.where('sessionId').equals(sessionId).toArray()) if (timer.status === 'running') {
          timerIds.push(timer.id);
          await repo.db.timers.put({ ...timer, status: 'paused', startedAtMs: undefined, accumulatedMs: timer.accumulatedMs + Math.max(0, now - (timer.startedAtMs ?? now)), revision: timer.revision + 1, updatedAt: new Date(now).toISOString() });
        }
      } else {
        const now = Date.now();
        for (const id of previous?.timerIds ?? []) {
          const timer = await repo.db.timers.get(id);
          if (timer?.sessionId === sessionId && timer.status === 'paused') await repo.db.timers.put({ ...timer, status: 'running', startedAtMs: now, revision: timer.revision + 1, updatedAt: new Date(now).toISOString() });
        }
      }
      const next = event(state, { sessionId, action: paused ? 'workout_paused' : 'workout_resumed', before: paused ? 'running' : 'paused', after: paused ? 'paused' : 'running', ...(paused ? { timerIds } : {}) });
      if (paused) state.invitations.push({ id: crypto.randomUUID(), eventId: next.id, decision: 'pending' });
    });
  }
  async function decideInvitation(id: string, decision: GuidedState['invitations'][number]['decision'], revision: number) {
    return change(revision, async state => { const invitation = state.invitations.find(item => item.id === id); if (!invitation) throw new DomainError('INVALID', 'Invitation not found'); invitation.decision = decision; });
  }
  async function appendMessage(input: GuidedState['messages'][number], revision: number) { return change(revision, async state => { state.messages.push(input); }); }
  async function saveObservation(input: GuidedState['observations'][number], revision: number) { return change(revision, async state => { state.observations.push(input); }); }
  return { read, captureDependencies, saveAnswer, setStep, resetOnboarding, completeOnboarding, retainCandidate, applyCandidate, transition, transitionLegacy, workoutTransition, decideInvitation, appendMessage, saveObservation };
}
export const guidedService = createGuidedService(repository);
