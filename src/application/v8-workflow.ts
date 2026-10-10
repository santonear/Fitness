import type { Repository } from '../persistence/repository';
import { DomainError } from '../domain/errors';
import { v8CoachProfileSchema, v8PlanVersionSchema, v8WorkoutSchema, setMetricsSchema } from '../domain/schemas';
import type { CoachProfile, Feedback, SetFact } from '../domain/v8/contracts';
import type { CoachResponse } from '../coach/contracts';
import { planProposalSchema } from '../coach/contracts';
import { exercises } from '../catalog/exercises';
import { estimateTrainingMinutes } from './rules/duration-estimate';
import { basicItems } from './rules/basic-items';
import basicZh from '../i18n/features/onboarding/basic.zh.json';
import basicEn from '../i18n/features/onboarding/basic.en.json';

export type LocalCandidate = Extract<CoachResponse, { type: 'plan_proposal' }> & { expectedRevision: number; profile: CoachProfile };
const invalid = (message: string): never => { throw new DomainError('INVALID', message); };
/** Basic rules are local and conservative; no model call or inferred medical suitability. */
export function basicProposal(profile: CoachProfile, locale = 'zh') {
  v8CoachProfileSchema.parse(profile);
  if (!profile.adultConfirmed) return undefined;
  const copy = locale === 'en' ? basicEn : basicZh;
  const selection = [basicItems(profile, 0), basicItems(profile, 1)];
  const selectedTemplates = selection.filter(s => s.items.length).map(({ items }, index) => ({ id: `basic-${index}`, name: String.fromCharCode(65 + index), items, estimatedMinutes: estimateTrainingMinutes(items.map(item => ({ sets: Array.from({ length: item.sets }, () => 'reps' in item.target ? { reps: item.target.reps } : { durationSeconds: item.target.durationSeconds }) }))) }));
  const missing = [...new Set(selection.flatMap(s => s.missing))].map(f => copy.families[f as keyof typeof copy.families]).join(' / ');
  return { goalText: profile.goalText, weeklyTarget: profile.weeklyTarget, sessionMinutes: profile.sessionMinutes, scheduleOriginalText: profile.scheduleOriginalText, templates: selectedTemplates,
    reasons: [profile.scheduleOriginalText || copy.basicReason, profile.cautions.length ? copy.adapted : copy.basicReason, !selectedTemplates.length ? copy.empty : missing ? copy.missing.replace('{types}', missing) : profile.goalText] as [string, string, string] };
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
    const locale = (await db.profiles.toCollection().first())?.locale;
    const proposal = basicProposal(profile, locale);
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
      const substitution = workout.substitutions?.filter(s => s.itemIndex === itemIndex).at(-1);
      const exerciseId = substitution?.toExerciseId ?? item.exerciseId;
      const metricType = exercises.find(exercise => exercise.id === exerciseId)?.metricType;
      setMetricsSchema.parse({ metricType, ...values });
      const next = v8WorkoutSchema.parse({ ...workout, sets: [...workout.sets, { ...values, exerciseId, ...(substitution ? { substitutedFrom: item.exerciseId } : {}), itemIndex, setIndex, completedAt: new Date().toISOString() }] });
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
  async function substitute(id: string, itemIndex: number, exerciseId: string, reason: 'discomfort' | 'other') {
    return repo.write(async () => {
      const record = await db.v8Workouts.get(id);
      if (!record || record.status !== 'in_progress') throw new DomainError('SESSION_READ_ONLY', 'TRAINING_ENDED');
      const item = record.plannedExercises?.find(p => p.itemIndex === itemIndex);
      if (!item || !exercises.some(e => e.id === exerciseId)) return invalid('INVALID_EXERCISE');
      const previous = record.substitutions?.filter(s => s.itemIndex === itemIndex).at(-1)?.toExerciseId ?? item.exerciseId;
      if (previous === exerciseId) return;
      // Past sets and original target snapshots remain immutable; only future sets use the replacement.
      await db.v8Workouts.put(v8WorkoutSchema.parse({ ...record, substitutions: [...record.substitutions ?? [], { fromExerciseId: previous, toExerciseId: exerciseId, itemIndex, reason, createdAt: new Date().toISOString() }] }));
    });
  }
  return { snapshot, propose, adopt, start, recordSet, finish, substitute };
}
