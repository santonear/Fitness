// Workout session: next-target preview, start, sets, finish and substitution.
import { replacementCandidateIds } from '../engine-replacement-candidates';
import { runGates } from '../../engine/gates';
import { checkHard } from '../../engine/hard-checks';
import { Rules, DATA, condition, type Exercise } from '../../engine/data';
import { applicableEnginePlan } from '../../engine/environment';
import { pendingPainReviews, historyDangerReview } from '../pain-events';
import { painExcludedItemIndexes } from '../pain-restrictions';
import { DomainError } from '../../domain/errors';
import { v8PlanVersionSchema, v8WorkoutSchema, setMetricsSchema } from '../../domain/schemas';
import type { Feedback, SetFact } from '../../domain/v8/contracts';
import { exercises } from '../../catalog/exercises';
import { manualTrainingItems } from '../rules/manual-items';
import { toEngineProfile } from '../engine-profile';
import type { EnginePlan } from '../../engine/contracts';
import { nextTargets, validatePlan } from '../../engine';
import { isFeatureEnabled } from '../feature-flags';
import { activePainReplacement, latestSetFeedback, unresolvedReview } from '../training-pain';
import { type ManualSelection, invalid, localDate } from './shared';
import type { WorkflowContext } from './context';
import type { createPlanSetup } from './plan-setup';
import { DEFAULT_TIME_ZONE } from '../../domain/local-date';

export function createWorkoutSession(
  ctx: WorkflowContext,
  depsIn: { snapshot: ReturnType<typeof createPlanSetup>['snapshot'] },
) {
  const { repo, db, assertHealthItems, checkins, mappedEngineProfile } = ctx;
  const { snapshot } = depsIn;
  async function nextTargetPreview(templateId?: string) {
    const data = await snapshot(),
      version = data.version,
      profile = data.state?.coachProfile;
    const override = data.state?.nextWorkoutOverride;
    const selected =
      override && override.planVersionId === version?.id && override.templateId === templateId
        ? override.template
        : version?.templates.find(item => item.id === templateId);
    const unchanged = {
      template: selected,
      blocked: false,
      suggestions: [] as ReturnType<typeof nextTargets>['suggestions'],
      notices: [] as EnginePlan['notices'],
    };
    if (data.state?.olderSafety?.reviewRequiredAt || data.state?.cardiacPause)
      return { ...unchanged, template: undefined, blocked: true };
    try {
      await assertHealthItems(selected?.items ?? [], data.state);
    } catch {
      return { ...unchanged, template: undefined, blocked: true };
    }
    if (
      data.state?.trainingPause ||
      pendingPainReviews(data.workouts).length ||
      unresolvedReview(historyDangerReview(data.workouts, data.state?.coachProfile?.screening?.redFlagReview))
    )
      return { ...unchanged, template: undefined, blocked: true };
    if (!isFeatureEnabled('trainingEngine') || !selected || !version?.enginePlan) return unchanged;
    if (!profile) return { ...unchanged, template: undefined, blocked: true };
    const mapped = toEngineProfile(profile, {
      cautionLevels: data.state?.cautionLevels,
      painFollowupRestrictions: data.state?.painFollowupRestrictions,
      pregnancySafety: data.state?.pregnancySafety,
      screeningEvidenceEvents: data.state?.screeningEvidenceEvents,
      olderSafety: data.state?.olderSafety,
      postpartumSafety: data.state?.postpartumSafety,
      asOfDate: localDate(data.profile?.timeZone ?? DEFAULT_TIME_ZONE),
      timeZone: data.profile?.timeZone,
      locale: data.profile?.locale,
      history: data.workouts,
      notes: await db.aiMemoryNotes.toArray(),
      ageYears: data.profile?.bodyDetails?.values.age,
      bodyWeightKg: data.profile?.bodyDetails?.values.weightKg,
    });
    if (!mapped) return { ...unchanged, template: undefined, blocked: true };
    if (mapped.population.kind === 'pregnant' && mapped.population.prenatalCareConfirmed === undefined) {
      const rules = new Rules(),
        gate = runGates(mapped, rules, { allowLegacyPrenatalCare: true });
      // Grandfather the applied course, not a new proposal or progression. All other current safety checks remain.
      const actual = {
        ...version.enginePlan,
        templates: version.enginePlan.templates.map(row => (row.id === templateId ? selected : row)),
      };
      const issues = checkHard(actual, mapped, gate, rules).filter(
        issue => issue.severity === 'error' && issue.code !== 'pregnancy_inactive_ramp',
      );
      if (gate.status === 'blocked' || issues.length)
        return {
          ...unchanged,
          template: undefined,
          blocked: true,
          notices: gate.notices,
        };
      await checkins.assertSafeItems(selected.items);
      return { ...unchanged, notices: gate.notices };
    }
    const checkinContext = await checkins.context(data.workouts);
    const result = nextTargets(checkinContext.history, version.enginePlan, mapped, {
      checkin: checkinContext.checkin,
      templateId,
    });
    const previewIssues = validatePlan(result.value, mapped, {
        progression: {
          baseline: version.enginePlan,
          history: checkinContext.history,
          checkin: checkinContext.checkin,
          templateId,
        },
      }),
      environmentCodes = new Set(
        result.value.quality?.basis === 'environment_constraint'
          ? result.value.quality.environmentConstraints?.flatMap(claim => claim.issueCodes)
          : [],
      );
    if (
      !applicableEnginePlan(result.value, mapped) ||
      previewIssues.some(issue => issue.severity === 'error' && !environmentCodes.has(issue.code))
    )
      return {
        ...unchanged,
        template: undefined,
        blocked: true,
        notices: result.notices,
      };
    if (override && selected === override.template) {
      // Do not validate baseline A and then start an unadjusted override B.
      if (
        result.suggestions.some(
          item => item.ruleId === 'deload.dose.prescription' || item.ruleId.startsWith('progression.return.'),
        )
      )
        return {
          ...unchanged,
          template: undefined,
          blocked: true,
          notices: result.notices,
        };
      await checkins.assertSafeItems(selected.items);
      return { ...unchanged, notices: result.notices };
    }
    await checkins.assertSafeItems((result.value.templates.find(item => item.id === templateId) ?? selected).items);
    return {
      template: result.value.templates.find(item => item.id === templateId) ?? selected,
      blocked: false,
      suggestions: result.suggestions.filter(item => item.templateId === templateId),
      notices: result.notices,
    };
  }
  async function start(
    templateId?: string,
    manualExerciseId?: string,
    manualExerciseIds?: string[],
    manualSelection?: ManualSelection,
  ) {
    return repo.write(async () => {
      const metadata = await repo.readMetadata();
      if (
        manualSelection &&
        (templateId ||
          metadata.dataRevision !== manualSelection.expectedRevision ||
          (metadata.restoreGeneration ?? 0) !== manualSelection.restoreGeneration)
      )
        throw new DomainError('CONFLICT', 'STALE_CANDIDATE');
      if (
        (await db.v8Workouts.where('status').equals('in_progress').count()) ||
        (await db.sessions.where('status').equals('in_progress').count())
      )
        throw new DomainError('CONFLICT', 'TRAINING_ALREADY_ACTIVE');
      if (pendingPainReviews(await db.v8Workouts.toArray()).length) return invalid('PAIN_REVIEW_REQUIRED');
      const state = await db.v8State.get('v8'),
        profile = await db.profiles.toCollection().first();
      if (state?.cardiacPause) return invalid('CARDIAC_CLEARANCE_REQUIRED');
      if (state?.olderSafety?.reviewRequiredAt) return invalid('FALL_PROFESSIONAL_REQUIRED');
      if (
        state?.trainingPause ||
        unresolvedReview(
          historyDangerReview(await db.v8Workouts.toArray(), state?.coachProfile?.screening?.redFlagReview),
        )
      )
        return invalid('PAIN_REVIEW_REQUIRED');
      const plan = state?.currentPlanId ? await db.v8Plans.get(state.currentPlanId) : undefined;
      const version = plan ? await db.v8PlanVersions.get(plan.currentVersionId) : undefined;
      const override = state?.nextWorkoutOverride;
      const preview = templateId ? await nextTargetPreview(templateId) : undefined;
      if (preview?.blocked) return invalid('ENGINE_SCREENING_REQUIRED');
      const template = preview?.template;
      if (templateId && (!template || plan?.readOnly || plan?.deletedAt)) return invalid('TEMPLATE_UNAVAILABLE');
      if (!profile) return invalid('PROFILE_REQUIRED');
      const manualTemplate = manualSelection
        ? v8PlanVersionSchema.shape.templates.element.parse(manualSelection.template)
        : undefined;
      if (manualTemplate && (manualSelection?.adultConfirmed !== true || state?.coachProfile?.adultConfirmed === false))
        return invalid('ADULT_CONFIRMATION_REQUIRED');
      const manualIds = [...new Set(manualExerciseIds ?? (manualExerciseId ? [manualExerciseId] : []))];
      if (
        manualTemplate &&
        (new Set(manualTemplate.items.map(item => item.exerciseId)).size !== manualIds.length ||
          manualTemplate.items.some(
            item =>
              !manualIds.includes(item.exerciseId) ||
              exercises.find(e => e.id === item.exerciseId)?.metricType !== item.target.metricType,
          ))
      )
        return invalid('INVALID_MANUAL_SELECTION');
      if (!template && (!manualIds.length || manualIds.some(id => !exercises.some(item => item.id === id))))
        return invalid('SELECT_EXERCISE');
      const items = template?.items ?? manualTemplate?.items ?? manualTrainingItems(manualIds);
      await assertHealthItems(items, state);
      await checkins.assertSafeItems(items);
      const record = v8WorkoutSchema.parse({
        id: crypto.randomUUID(),
        ...(template ? { planVersionId: version!.id, templateId } : {}),
        startedAt: new Date().toISOString(),
        localDate: localDate(profile.timeZone),
        timeZone: profile.timeZone,
        status: 'in_progress',
        sets: [],
        ...(template || manualTemplate ? { templateSnapshot: template ?? manualTemplate } : {}),
        plannedSetCount: items.reduce((sum, item) => sum + item.sets, 0),
        plannedExercises: items.map((item, itemIndex) => ({
          exerciseId: item.exerciseId,
          itemIndex,
          plannedSetCount: item.sets,
        })),
      });
      await db.v8Workouts.add(record);
      await checkins.consume(record.id);
      if (override && override.planVersionId === version?.id && override.templateId === templateId && state) {
        const { nextWorkoutOverride: _used, ...rest } = state;
        await db.v8State.put(rest);
      }
      return record;
    });
  }
  async function recordSet(
    workoutId: string,
    itemIndex: number,
    setIndex: number,
    values: Omit<SetFact, 'exerciseId' | 'itemIndex' | 'setIndex' | 'completedAt'>,
  ) {
    return repo.write(async () => {
      const workout = await db.v8Workouts.get(workoutId);
      if (!workout || workout.status !== 'in_progress') throw new DomainError('SESSION_READ_ONLY', 'TRAINING_ENDED');
      const painHistory = await db.v8Workouts.toArray(),
        painState = await db.v8State.get('v8'),
        painProfile = painState?.coachProfile;
      if (painState?.cardiacPause) return invalid('CARDIAC_CLEARANCE_REQUIRED');
      if (painState?.olderSafety?.reviewRequiredAt) return invalid('FALL_PROFESSIONAL_REQUIRED');
      if (painState?.postpartumSafety?.urgentAt) return invalid('POSTPARTUM_PROFESSIONAL_REQUIRED');
      if (painState?.trainingPause) return invalid('PAIN_REVIEW_REQUIRED');
      {
        const processed = new Set(workout.painActions?.map(action => action.eventId));
        const rule = DATA.rules.find(row => row.id === 'pain.rule')!.value!;
        const pending = latestSetFeedback(workout).some(
          event =>
            event.effort === 'discomfort' &&
            !processed.has(event.id) &&
            rule.bands.some(
              (band: { when: unknown; action: string }) =>
                band.action !== 'continue' &&
                condition(band.when, {} as Exercise, {
                  pain: { current: event.painScore },
                }),
            ),
        );
        const globalReview = historyDangerReview(painHistory, painProfile?.screening?.redFlagReview);
        if (
          pendingPainReviews(painHistory).length ||
          unresolvedReview(globalReview) ||
          workout.painReviewRequired ||
          pending ||
          workout.painActions?.some(action => action.excludedItemIndexes?.includes(itemIndex))
        )
          return invalid('PAIN_REVIEW_REQUIRED');
      }
      if (
        painExcludedItemIndexes(
          workout,
          painHistory,
          painProfile?.painState,
          painState?.painFollowupRestrictions,
        ).includes(itemIndex)
      )
        return invalid('PAIN_PATTERN_EXCLUDED');
      const item = workout.plannedExercises?.find(row => row.itemIndex === itemIndex);
      if (!item || !Number.isInteger(setIndex) || setIndex < 0 || setIndex >= item.plannedSetCount)
        return invalid('INVALID_SET');
      if (workout.sets.some(set => set.itemIndex === itemIndex && set.setIndex === setIndex))
        throw new DomainError('CONFLICT', 'SET_ALREADY_RECORDED');
      const substitution = workout.substitutions?.filter(s => s.itemIndex === itemIndex).at(-1);
      const exerciseId = substitution?.toExerciseId ?? item.exerciseId;
      const painReplacement = activePainReplacement(workout, itemIndex);
      const actualExerciseId = painReplacement?.exerciseId ?? exerciseId;
      await assertHealthItems([{ exerciseId: actualExerciseId }], painState);
      await checkins.assertSafeItems([{ exerciseId: actualExerciseId }], workoutId);
      const planned = workout.templateSnapshot?.items[itemIndex],
        relativePower =
          planned?.exerciseId === actualExerciseId &&
          planned.prescription?.safetyCue &&
          planned.target.metricType === 'reps';
      const metricType = relativePower
        ? 'reps'
        : exercises.find(exercise => exercise.id === actualExerciseId)?.metricType;
      setMetricsSchema.parse({ metricType, ...values });
      const next = v8WorkoutSchema.parse({
        ...workout,
        sets: [
          ...workout.sets,
          {
            ...values,
            exerciseId: actualExerciseId,
            ...(substitution || painReplacement ? { substitutedFrom: item.exerciseId } : {}),
            itemIndex,
            setIndex,
            completedAt: new Date().toISOString(),
          },
        ],
      });
      await db.v8Workouts.put(next);
      return next;
    });
  }
  async function finish(id: string, feedback: Feedback, abandon = false, endedAt = new Date().toISOString()) {
    return repo.write(async () => {
      const record = await db.v8Workouts.get(id);
      if (!record || record.status !== 'in_progress') throw new DomainError('SESSION_READ_ONLY', 'TRAINING_ENDED');
      const allowed = new Set(record.sets.map(set => set.exerciseId));
      if (feedback.discomfortExerciseIds?.some(id => !allowed.has(id))) return invalid('INVALID_FEEDBACK_EXERCISE');
      const status = abandon
        ? 'abandoned'
        : record.sets.length === 0
          ? 'not_started'
          : record.sets.length === record.plannedSetCount
            ? 'complete'
            : 'partial';
      if (
        !Number.isFinite(Date.parse(endedAt)) ||
        Date.parse(endedAt) > Date.now() ||
        Date.parse(endedAt) < Date.parse(record.startedAt)
      )
        return invalid('INVALID_END_TIME');
      const next = v8WorkoutSchema.parse({
        ...record,
        status,
        endedAt,
        feedback,
      });
      await db.v8Workouts.put(next);
      return next;
    });
  }
  async function replacementCandidates() {
    const state = await db.v8State.get('v8');
    return replacementCandidateIds(
      state?.coachProfile ? await mappedEngineProfile(state.coachProfile) : undefined,
      state?.coachProfile,
      isFeatureEnabled('trainingEngine'),
    );
  }
  async function substitute(id: string, itemIndex: number, exerciseId: string, reason: 'discomfort' | 'other') {
    return repo.write(async () => {
      const record = await db.v8Workouts.get(id);
      if (!record || record.status !== 'in_progress') throw new DomainError('SESSION_READ_ONLY', 'TRAINING_ENDED');
      const item = record.plannedExercises?.find(p => p.itemIndex === itemIndex);
      if (!item || !exercises.some(e => e.id === exerciseId)) return invalid('INVALID_EXERCISE');
      const safetyState = await db.v8State.get('v8');
      if (safetyState?.cardiacPause) return invalid('CARDIAC_CLEARANCE_REQUIRED');
      if (safetyState?.olderSafety?.reviewRequiredAt) return invalid('FALL_PROFESSIONAL_REQUIRED');
      await assertHealthItems([{ exerciseId }], safetyState);
      const previous =
        record.substitutions?.filter(s => s.itemIndex === itemIndex).at(-1)?.toExerciseId ?? item.exerciseId;
      if (previous === exerciseId) return;
      // Past sets and original target snapshots remain immutable; only future sets use the replacement.
      if (!(await replacementCandidates()).includes(exerciseId)) return invalid('INVALID_EXERCISE');
      await db.v8Workouts.put(
        v8WorkoutSchema.parse({
          ...record,
          substitutions: [
            ...(record.substitutions ?? []),
            {
              fromExerciseId: previous,
              toExerciseId: exerciseId,
              itemIndex,
              reason,
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      );
    });
  }
  return { nextTargetPreview, start, recordSet, finish, replacementCandidates, substitute };
}
