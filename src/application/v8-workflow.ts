import type { Repository } from '../persistence/repository';
import { DomainError } from '../domain/errors';
import { v8CoachProfileSchema, v8PlanVersionSchema, v8WorkoutSchema, setMetricsSchema } from '../domain/schemas';
import type { CoachProfile, Feedback, SetFact } from '../domain/v8/contracts';
import type { CoachResponse } from '../coach/contracts';
import { planProposalSchema } from '../coach/contracts';
import { EXERCISE_IDS } from '../catalog/exercise-ids';
import { exercises } from '../catalog/exercises';
import { estimateTrainingMinutes } from './rules/duration-estimate';

export type LocalCandidate = Extract<CoachResponse, { type: 'plan_proposal' }> & { expectedRevision: number; profile: CoachProfile };
const invalid = (message: string): never => { throw new DomainError('INVALID', message); };
/** Basic rules are local and conservative; no model call or inferred medical suitability. */
export function basicProposal(profile: CoachProfile) {
  v8CoachProfileSchema.parse(profile);
  if (!profile.adultConfirmed || profile.cautions.length) return undefined;
  const templates = [EXERCISE_IDS.bodyweightSquat, EXERCISE_IDS.plank].map((exerciseId, index) => {
    const target = index === 0 ? { metricType: 'reps' as const, reps: 8 } : { metricType: 'duration' as const, durationSeconds: 20 };
    const budget = Math.floor(profile.sessionMinutes / 5) * 300;
    const firstSeconds = index === 0 ? 48 : 40;
    const walkSeconds = Math.max(60, budget - firstSeconds - 90 - 60 - 300);
    const items = [{ exerciseId, equipment: 'none', sets: 2, target },
      { exerciseId: EXERCISE_IDS.walking, equipment: 'none', sets: 1, target: { metricType: 'duration_distance' as const, durationSeconds: walkSeconds } }];
    return { id: `basic-${index}`, name: index === 0 ? 'A' : 'B', items, estimatedMinutes: estimateTrainingMinutes(items.map(item => ({
      sets: Array.from({ length: item.sets }, () => 'reps' in item.target ? { reps: item.target.reps! } : { durationSeconds: item.target.durationSeconds! }),
    }))) };
  });
  return planProposalSchema.parse({ goalText: profile.goalText, weeklyTarget: profile.weeklyTarget, sessionMinutes: profile.sessionMinutes,
    scheduleOriginalText: profile.scheduleOriginalText, templates,
    reasons: [profile.goalText, profile.scheduleOriginalText, profile.equipment.join(' / ') || profile.place] });
}
function localDate(timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-');
}
export function createV8Workflow(repo: Repository) {
  const db = repo.db;
  async function snapshot() {
    return db.transaction('r', db.tables, async () => {
      const metadata = await repo.readMetadata(), state = await db.v8State.get('v8');
      const plan = state?.currentPlanId ? await db.v8Plans.get(state.currentPlanId) : undefined;
      const version = plan ? await db.v8PlanVersions.get(plan.currentVersionId) : undefined;
      const workouts = await db.v8Workouts.toArray();
      return { metadata, state, plan, version, workouts, profile: await db.profiles.toCollection().first(), active: workouts.find(row => row.status === 'in_progress') };
    });
  }
  async function propose(profile: CoachProfile): Promise<LocalCandidate> {
    const proposal = basicProposal(profile);
    if (!proposal) return invalid('BASIC_PLAN_UNAVAILABLE');
    const metadata = await repo.readMetadata();
    return { type: 'plan_proposal', requestId: crypto.randomUUID(), mutationAllowed: false, restoreGeneration: metadata.restoreGeneration ?? 0,
      expectedRevision: metadata.dataRevision, profile: structuredClone(profile), proposal };
  }
  async function adopt(candidate: LocalCandidate) {
    const proposal = planProposalSchema.parse(candidate.proposal), profile = v8CoachProfileSchema.parse(candidate.profile);
    if (!profile.adultConfirmed) return invalid('ADULT_CONFIRMATION_REQUIRED');
    return repo.write(async () => {
      const meta = await repo.readMetadata();
      if ((meta.restoreGeneration ?? 0) !== candidate.restoreGeneration) throw new DomainError('CONFLICT', 'STALE_CANDIDATE');
      if (await db.v8Plans.get(candidate.requestId)) throw new DomainError('CONFLICT', 'ALREADY_SAVED');
      const state = await db.v8State.get('v8'); if (!state) return invalid('PROFILE_REQUIRED');
      const id = crypto.randomUUID();
      const { reasons: _reasons, ...content } = proposal;
      const version = v8PlanVersionSchema.parse({ ...content, id, planId: candidate.requestId, versionNumber: 1, createdAt: new Date().toISOString(),
        origin: 'onboard', changeSummary: [] });
      await db.v8Plans.toCollection().modify({ readOnly: true });
      await db.v8Plans.add({ id: candidate.requestId, currentVersionId: id, readOnly: false, name: proposal.goalText });
      await db.v8PlanVersions.add(version);
      await db.v8State.put({ ...state, currentPlanId: candidate.requestId, coachProfile: profile });
      return version;
    }, candidate.expectedRevision);
  }
  async function start(templateId?: string, manualExerciseId?: string) {
    return repo.write(async () => {
      if (await db.v8Workouts.where('status').equals('in_progress').count() || await db.sessions.where('status').equals('in_progress').count()) throw new DomainError('CONFLICT', 'TRAINING_ALREADY_ACTIVE');
      const state = await db.v8State.get('v8'), profile = await db.profiles.toCollection().first();
      const plan = state?.currentPlanId ? await db.v8Plans.get(state.currentPlanId) : undefined;
      const version = plan ? await db.v8PlanVersions.get(plan.currentVersionId) : undefined;
      const template = version?.templates.find(item => item.id === templateId);
      if (templateId && (!template || plan?.readOnly)) return invalid('TEMPLATE_UNAVAILABLE');
      if (!profile) return invalid('PROFILE_REQUIRED');
      if (!template && !exercises.some(item => item.id === manualExerciseId)) return invalid('SELECT_EXERCISE');
      const items = template?.items ?? [{ exerciseId: manualExerciseId!, sets: 2 }];
      const record = v8WorkoutSchema.parse({ id: crypto.randomUUID(), ...(template ? { planVersionId: version!.id, templateId } : {}),
        startedAt: new Date().toISOString(), localDate: localDate(profile.timeZone), timeZone: profile.timeZone, status: 'in_progress', sets: [],
        plannedSetCount: items.reduce((sum, item) => sum + item.sets, 0),
        plannedExercises: items.map((item, itemIndex) => ({ exerciseId: item.exerciseId, itemIndex, plannedSetCount: item.sets })) });
      await db.v8Workouts.add(record); return record;
    });
  }
  async function recordSet(workoutId: string, itemIndex: number, setIndex: number, values: Omit<SetFact, 'exerciseId' | 'itemIndex' | 'setIndex' | 'completedAt'>) {
    return repo.write(async () => {
      const workout = await db.v8Workouts.get(workoutId);
      if (!workout || workout.status !== 'in_progress') throw new DomainError('SESSION_READ_ONLY', 'TRAINING_ENDED');
      const item = workout.plannedExercises?.find(row => row.itemIndex === itemIndex);
      if (!item || !Number.isInteger(setIndex) || setIndex < 0 || setIndex >= item.plannedSetCount) return invalid('INVALID_SET');
      if (workout.sets.some(set => set.itemIndex === itemIndex && set.setIndex === setIndex)) throw new DomainError('CONFLICT', 'SET_ALREADY_RECORDED');
      const metricType = exercises.find(exercise => exercise.id === item.exerciseId)?.metricType;
      setMetricsSchema.parse({ metricType, ...values });
      const next = v8WorkoutSchema.parse({ ...workout, sets: [...workout.sets, { ...values, exerciseId: item.exerciseId, itemIndex, setIndex, completedAt: new Date().toISOString() }] });
      await db.v8Workouts.put(next); return next;
    });
  }
  async function finish(id: string, feedback: Feedback, abandon = false) {
    return repo.write(async () => {
      const record = await db.v8Workouts.get(id);
      if (!record || record.status !== 'in_progress') throw new DomainError('SESSION_READ_ONLY', 'TRAINING_ENDED');
      const allowed = new Set(record.sets.map(set => set.exerciseId));
      if (feedback.discomfortExerciseIds?.some(id => !allowed.has(id))) return invalid('INVALID_FEEDBACK_EXERCISE');
      const status = abandon ? 'abandoned' : record.sets.length === 0 ? 'not_started' : record.sets.length === record.plannedSetCount ? 'complete' : 'partial';
      const next = v8WorkoutSchema.parse({ ...record, status, endedAt: new Date().toISOString(), feedback });
      await db.v8Workouts.put(next); return next;
    });
  }
  return { snapshot, propose, adopt, start, recordSet, finish };
}
