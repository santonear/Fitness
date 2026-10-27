// Services and guards every workflow module shares; created once per repository.
import { createCautionSafety } from '../caution-safety';
import { createPostpartumReferral } from '../postpartum-referral';
import { createBirthReport } from '../birth-report';
import { createPregnancySafety, assertPregnancyItems } from '../pregnancy-safety';
import { createTrainingStop } from '../training-stop';
import { createPostpartumSafety, assertPostpartumItems } from '../postpartum-safety';
import {
  historyPainState,
  type PainFollowupRestriction,
  type EngineCoachProfile,
  toEngineProfile,
} from '../engine-profile';
import { createPlanLifecycle } from '../plan-lifecycle';
import { pendingPainReviews, historyDangerReview } from '../pain-events';
import { unresolvedReview } from '../training-pain';
import type { Repository } from '../../persistence/repository';
import type { V8Library } from '../../persistence/v8-migration';
import { DomainError } from '../../domain/errors';
import type { CoachProfile } from '../../domain/v8/contracts';
import { createTrainingCheckin } from '../training-checkin';
import { enginePlanSchema, type EnginePlan } from '../../engine/contracts';
import { isFeatureEnabled } from '../feature-flags';
import { stableString, exerciseById } from '../../engine/data';
import { type LocalCandidate, invalid, localDate } from './shared';
import { DEFAULT_TIME_ZONE } from '../../domain/local-date';

export function createWorkflowContext(repo: Repository) {
  const db = repo.db;
  const postpartum = createPostpartumSafety(repo);
  const caution = createCautionSafety(repo);
  const pregnancy = createPregnancySafety(repo);
  const postpartumReferral = createPostpartumReferral(repo),
    birth = createBirthReport(repo);
  const assertHealthItems = async (
    items: Parameters<typeof assertPostpartumItems>[0],
    state?: {
      postpartumSafety?: Parameters<typeof assertPostpartumItems>[1];
      pregnancySafety?: Parameters<typeof assertPregnancyItems>[1];
      coachProfile?: CoachProfile;
      painFollowupRestrictions?: PainFollowupRestriction[];
    },
  ) => {
    assertPostpartumItems(items, state?.postpartumSafety);
    assertPregnancyItems(items, state?.pregnancySafety, state?.coachProfile);
    if (state?.painFollowupRestrictions?.length) {
      const patterns = new Set(
        historyPainState(await db.v8Workouts.toArray(), [], state.painFollowupRestrictions)
          ?.filter(row => row.remainingSessions > 0)
          .map(row => row.pattern),
      );
      if (
        items.some(item => {
          const pattern = exerciseById.get(item.exerciseId)?.primary_pattern;
          return pattern && patterns.has(pattern);
        })
      )
        return invalid('PAIN_PATTERN_EXCLUDED');
    }
  };
  /** Safety holds that block every new plan or plan version: onboarding, coach change and review suggestion. */
  async function assertPlanChangeAllowed(state: V8Library['state'] | undefined) {
    if (state?.cardiacPause) return invalid('CARDIAC_CLEARANCE_REQUIRED');
    if (state?.olderSafety?.reviewRequiredAt) return invalid('FALL_PROFESSIONAL_REQUIRED');
    if (state?.postpartumSafety?.urgentAt) return invalid('POSTPARTUM_PROFESSIONAL_REQUIRED');
    const history = await db.v8Workouts.toArray();
    if (
      state?.trainingPause ||
      pendingPainReviews(history).length ||
      unresolvedReview(historyDangerReview(history, state?.coachProfile?.screening?.redFlagReview))
    )
      return invalid('PAIN_REVIEW_REQUIRED');
  }
  const cardiac = createTrainingStop(repo);
  const checkins = createTrainingCheckin(repo);
  const lifecycle = createPlanLifecycle(repo);
  function checkedEnginePlan(value: EnginePlan | undefined, proposal: LocalCandidate['proposal']) {
    if (!value) return undefined;
    if (!isFeatureEnabled('trainingEngine')) throw new DomainError('CONFLICT', 'STALE_CANDIDATE');
    const parsed = enginePlanSchema.parse(value);
    if (
      ['weeklyTarget', 'sessionMinutes', 'preferredDays', 'templates'].some(
        key => stableString(parsed[key as keyof EnginePlan]) !== stableString(proposal[key as keyof typeof proposal]),
      )
    )
      throw new DomainError('CONFLICT', 'STALE_CANDIDATE');
    return parsed;
  }
  async function mappedEngineProfile(profile: EngineCoachProfile) {
    const local = await db.profiles.toCollection().first(),
      safety = await db.v8State.get('v8');
    return toEngineProfile(profile, {
      cautionLevels: safety?.cautionLevels,
      painFollowupRestrictions: safety?.painFollowupRestrictions,
      pregnancySafety: safety?.pregnancySafety,
      screeningEvidenceEvents: safety?.screeningEvidenceEvents,
      olderSafety: safety?.olderSafety,
      postpartumSafety: safety?.postpartumSafety,
      asOfDate: localDate(local?.timeZone ?? DEFAULT_TIME_ZONE),
      timeZone: local?.timeZone,
      locale: local?.locale,
      history: await db.v8Workouts.toArray(),
      notes: await db.aiMemoryNotes.toArray(),
      ageYears: local?.bodyDetails?.values.age,
      bodyWeightKg: local?.bodyDetails?.values.weightKg,
    });
  }
  return {
    repo,
    db,
    postpartum,
    caution,
    pregnancy,
    postpartumReferral,
    birth,
    assertHealthItems,
    assertPlanChangeAllowed,
    cardiac,
    checkins,
    lifecycle,
    checkedEnginePlan,
    mappedEngineProfile,
  };
}
export type WorkflowContext = ReturnType<typeof createWorkflowContext>;
