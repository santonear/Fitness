// Plan setup: engine settings, snapshot, local proposal and adoption.
import { requestedPostpartumPhase, needsPostpartumReferralCheck } from "../postpartum-referral";
import { hasHouseholdSupport } from "../../engine/equipment";
import { applicableEnginePlan } from "../../engine/environment";
import { type EngineCoachProfile, toEngineProfile } from "../engine-profile";
import { pendingPainReviews, historyDangerReview } from "../pain-events";
import { PLAN_RETENTION_MS } from "../plan-lifecycle";
import { DomainError } from "../../domain/errors";
import { v8CoachProfileSchema, v8PlanVersionSchema } from "../../domain/schemas";
import type { CoachProfile } from "../../domain/v8/contracts";
import { planProposalSchema } from "../../coach/contracts";
import { estimatePlannedMinutes } from "../../domain/duration-estimate";
import { basicItems } from "../rules/basic-items";
import basicZh from "../../i18n/features/onboarding/basic.zh.json";
import basicEn from "../../i18n/features/onboarding/basic.en.json";
import { enginePlanProposal } from "../engine-plan";
import type { EnginePlan } from "../../engine/contracts";
import { isFeatureEnabled } from "../feature-flags";
import { stableString, DATA } from "../../engine/data";
import { EnginePlanUnavailableError } from "../engine-error";
import { timePattern, validTrainingDates } from "../training-dates";
import { unresolvedReview } from "../training-pain";
import { type LocalCandidate, carriedBudget, carriedSchedule, invalid, localDate } from "./shared";
import type { WorkflowContext } from "./context";

/** Basic rules are local and conservative; no model call or inferred medical suitability. */
export function basicProposal(profile: CoachProfile, locale = "zh") {
  v8CoachProfileSchema.parse(profile);
  if (!profile.adultConfirmed) return undefined;
  const copy = locale === "en" ? basicEn : basicZh;
  const selection = [basicItems(profile, 0), basicItems(profile, 1)];
  const selectedTemplates = selection
    .filter((s, index, all) => {
      if (!s.items.length) return false;
      if (profile.weeklyTarget >= 3) return true;
      const content = (items: typeof s.items) => {
        const rows = items.map((item) => JSON.stringify(item));
        return JSON.stringify(items.length < 4 ? rows.sort() : rows);
      };
      return !all
        .slice(0, index)
        .some((previous) => content(previous.items) === content(s.items));
    })
    .map(({ items }, index) => ({
      id: `basic-${index}`,
      name: String.fromCharCode(65 + index),
      items,
      estimatedMinutes: estimatePlannedMinutes(
        items,
        profile.sessionMinutes < 15 ? 10 : 15,
      ),
    }));
  const missing = [...new Set(selection.flatMap((s) => s.missing))]
    .map((f) => copy.families[f as keyof typeof copy.families])
    .join(" / ");
  const shorter = selectedTemplates.find(
    (template) => template.estimatedMinutes < profile.sessionMinutes,
  );
  return {
    goalText: profile.goalText,
    weeklyTarget: profile.weeklyTarget,
    preferredDays: profile.preferredDays,
    sessionMinutes: profile.sessionMinutes,
    scheduleOriginalText: profile.scheduleOriginalText,
    templates: selectedTemplates,
    reasons: [
      locale === "en"
        ? `Start with ${profile.weeklyTarget} sessions a week, up to 4 sets per exercise; use the estimated duration shown for each session.`
        : `每周安排 ${profile.weeklyTarget} 次，每个动作最多 4 组，以训练单显示的估算时长为准。`,
      [
        profile.cautions.length ? copy.adapted : copy.basicReason,
        shorter
          ? copy.shorter.replace("{minutes}", String(shorter.estimatedMinutes))
          : "",
      ]
        .filter(Boolean)
        .join(" "),
      !selectedTemplates.length
        ? copy.empty
        : missing
          ? copy.missing.replace("{types}", missing)
          : locale === "en"
            ? `Uses your stated equipment: ${profile.equipment.join(" / ")}. ${/瘦|减脂|减重|lose weight|fat loss|weight loss/i.test(profile.goalText) ? "Combines strength work with walking where your selected cautions allow." : "Alternates basic strength movements across sessions."}`
            : `使用你说明的器械：${profile.equipment.join(" / ")}。${/瘦|减脂|减重|lose weight|fat loss|weight loss/i.test(profile.goalText) ? "在已选注意部位允许的范围内，结合力量动作和步行。" : "两份训练单交替安排基础力量动作。"}`,
    ] as [string, string, string],
  };
}

export function createPlanSetup(ctx: WorkflowContext) {
  const { repo, db, postpartum, assertHealthItems, checkedEnginePlan, mappedEngineProfile } = ctx;
  async function saveEngineSettings(
    profile: EngineCoachProfile,
    expectedRevision: number,
    requestedAt?: string,
  ) {
    return repo.write(async () => {
      const state = await db.v8State.get("v8");
      if (!state?.coachProfile) return invalid("PROFILE_REQUIRED");
      const {
        powerOneRm: unconsentedPower,
        postpartumRisk: unconsentedRisk,
        ...withoutPower
      } = profile;
      const parsed = v8CoachProfileSchema.parse(
          profile.healthStorageConsent ? profile : withoutPower,
        ),
        prior = state.coachProfile;
      if (
        stableString([...prior.cautions].sort()) !==
        stableString([...parsed.cautions].sort())
      )
        return invalid("CAUTION_REVIEW_REQUIRED");
      if (
        prior.population?.kind === "pregnant" &&
        parsed.healthStorageConsent &&
        parsed.population?.kind !== "pregnant"
      )
        return invalid("PREGNANCY_BIRTH_REPORT_REQUIRED");
      if (parsed.population?.kind === "postpartum") {
        const beforePhase =
            requestedPostpartumPhase(prior.population ?? { kind: "general" }) ??
            1,
          afterPhase = requestedPostpartumPhase(parsed.population)!,
          local = await db.profiles.toCollection().first(),
          timeZone = local?.timeZone ?? "Asia/Shanghai",
          input = { asOfDate: localDate(timeZone), timeZone, requestedAt };
        if (
          afterPhase > beforePhase &&
          needsPostpartumReferralCheck(
            state.postpartumReferralChecks,
            "each_phase_transition",
            { ...input, phase: afterPhase },
          )
        )
          return invalid("POSTPARTUM_REFERRAL_CHECK_REQUIRED");
        if (
          parsed.population.readinessChecklistPassed &&
          !(
            prior.population?.kind === "postpartum" &&
            prior.population.readinessChecklistPassed
          ) &&
          needsPostpartumReferralCheck(
            state.postpartumReferralChecks,
            "running_readiness_check",
            input,
          )
        )
          return invalid("POSTPARTUM_REFERRAL_CHECK_REQUIRED");
      }
      const environment = (p: EngineCoachProfile) => [
        p.place,
        p.equipment,
        hasHouseholdSupport(p),
        p.constraints?.space ?? "small",
      ];
      const changed =
        stableString(environment(prior)) !== stableString(environment(parsed));
      const populationChanged =
        prior.population?.kind !== parsed.population?.kind &&
        (parsed.population?.kind === "pregnant" ||
          parsed.population?.kind === "postpartum");
      const populationRescreenCompleted =
        (parsed.population?.kind === "pregnant" || parsed.population?.kind === "postpartum") &&
        prior.screening?.rescreenRequired === true &&
        parsed.screening?.rescreenRequired !== true && !!parsed.screening?.completedAt;
      const populationUpdated=populationChanged||populationRescreenCompleted;
      const plan = state.currentPlanId
          ? await db.v8Plans.get(state.currentPlanId)
          : undefined,
        version = plan
          ? await db.v8PlanVersions.get(plan.currentVersionId)
          : undefined;
      let nextVersion;
      if (
        (changed || populationUpdated) &&
        isFeatureEnabled("trainingEngine") &&
        plan &&
        !plan.readOnly &&
        !plan.deletedAt &&
        version &&
        (populationUpdated ||
          version?.enginePlan?.quality?.basis === "environment_constraint")
      ) {
        const mapped = await mappedEngineProfile(parsed);
        if (!mapped) return invalid("ENGINE_SCREENING_REQUIRED");
        const generated = enginePlanProposal(parsed, mapped);
        if (!generated.proposal)
          throw new EnginePlanUnavailableError(generated.plan);
        const { reasons: _, ...content } = generated.proposal;
        nextVersion = v8PlanVersionSchema.parse({
          ...content,
          id: crypto.randomUUID(),
          planId: plan.id,
          versionNumber: version.versionNumber + 1,
          createdAt: new Date().toISOString(),
          origin: "manual",
          source: "local",
          basedOnVersionId: version.id,
          changeSummary: [],
          enginePlan: generated.plan,
          ...carriedSchedule(version),
          ...carriedBudget(version),
        });
        await db.v8PlanVersions.add(nextVersion);
        await db.v8Plans.put({ ...plan, currentVersionId: nextVersion.id });
      }
      const retained = nextVersion
        ? (({ nextWorkoutOverride: _, ...rest }) => rest)(state)
        : state;
      const symptomKeys = DATA.rules.find(
        (row) => row.id === "safety.screen.cmr_symptoms",
      )!.value!.symptoms as string[];
      const completeSymptoms = symptomKeys.every(
        (key) => typeof parsed.screening?.cmrSymptoms?.[key] === "boolean",
      );
      const newScreening =
        completeSymptoms &&
        parsed.healthStorageConsent &&
        parsed.screening?.completedAt &&
        parsed.screening.completedAt !== prior.screening?.completedAt &&
        typeof parsed.screening.symptoms === "boolean";
      if (!parsed.healthStorageConsent)
        retained.postpartumReferralChecks = undefined;
      if (
        Object.values(parsed.screening?.redFlagReview?.answers ?? {}).some(
          Boolean,
        )
      )
        retained.trainingPause = retained.trainingPause ?? {
          requiredAt: new Date().toISOString(),
        };
      retained.screeningEvidenceEvents = parsed.healthStorageConsent
        ? [
            ...(state.screeningEvidenceEvents ?? []),
            ...(newScreening
              ? [
                  {
                    answeredAt: new Date().toISOString(),
                    symptoms:
                      parsed.screening!.symptoms === true ||
                      symptomKeys.some(
                        (key) => parsed.screening!.cmrSymptoms?.[key] === true,
                      ),
                  },
                ]
              : []),
          ]
        : undefined;
      await db.v8State.put({ ...retained, coachProfile: parsed });
      if (!parsed.healthStorageConsent) {
        await db.trainingCheckins.clear();
        for (const record of await db.v8Workouts.toArray())
          if (record.postpartumSymptoms) {
            const { postpartumSymptoms: _, ...facts } = record;
            await db.v8Workouts.put(facts);
          }
        if (state.postpartumSafety?.regression)
          await db.v8State.put({
            ...retained,
            coachProfile: parsed,
            postpartumSafety: {
              ...state.postpartumSafety,
              regression: {
                ...state.postpartumSafety.regression,
                symptomFreeDates: [],
              },
            },
          });
      }
      return nextVersion;
    }, expectedRevision);
  }
  async function snapshot() {
    return db.transaction("r", db.tables, async () => {
      const metadata = await repo.readMetadata(),
        state = await db.v8State.get("v8");
      const allPlans = await db.v8Plans.toArray();
      const plans = allPlans.filter((p) => !p.deletedAt),
        deletedPlans = allPlans.filter(
          (p) =>
            p.deletedAt &&
            Date.now() - Date.parse(p.deletedAt) < PLAN_RETENTION_MS,
        );
      const plan = plans.find((p) => p.id === state?.currentPlanId);
      const historyVersions = await db.v8PlanVersions.toArray();
      const version = plan
        ? historyVersions.find((v) => v.id === plan.currentVersionId)
        : undefined;
      const workouts = await db.v8Workouts.toArray();
      const profile = await db.profiles.toCollection().first();
      const hasFutureLegacyDates =
        !!state?.legacyPlanIds.length &&
        (await db.scheduledWorkouts.toArray()).some(
          (row) =>
            !row.hiddenAt &&
            row.status === "pending" &&
            !row.completedSessionId &&
            row.scheduledDate >=
              localDate(profile?.timeZone ?? "Asia/Shanghai"),
        );
      return {
        metadata,
        state,
        plan,
        version,
        plans,
        deletedPlans,
        planReferences: await db.v8PlanReferences.toArray(),
        workouts,
        hasFutureLegacyDates,
        historyVersions,
        versions: historyVersions.filter((v) =>
          plans.some((p) => p.id === v.planId),
        ),
        activities: await db.v8Activities.toArray(),
        profile,
        active: workouts.find((row) => row.status === "in_progress"),
      };
    });
  }
  async function propose(
    profile: CoachProfile,
    localeOverride?: "zh" | "en",
    options?: { trainingEngine?: boolean },
  ): Promise<LocalCandidate> {
    const painHistory = await db.v8Workouts.toArray();
    const painState = await db.v8State.get("v8");
    if (painState?.cardiacPause) return invalid("CARDIAC_CLEARANCE_REQUIRED");
    if (painState?.olderSafety?.reviewRequiredAt)
      return invalid("FALL_PROFESSIONAL_REQUIRED");
    if (painState?.postpartumSafety?.urgentAt)
      return invalid("POSTPARTUM_PROFESSIONAL_REQUIRED");
    if (
      painState?.trainingPause ||
      pendingPainReviews(painHistory).length ||
      unresolvedReview(
        historyDangerReview(
          painHistory,
          painState?.coachProfile?.screening?.redFlagReview,
        ),
      )
    )
      return invalid("PAIN_REVIEW_REQUIRED");
    const local = await db.profiles.toCollection().first(),
      locale = localeOverride ?? local?.locale;
    if (
      local?.bodyDetails?.values.age !== undefined &&
      local.bodyDetails.values.age < 18
    )
      return invalid("ADULT_CONFIRMATION_REQUIRED");
    let enginePlan: EnginePlan | undefined;
    let proposal: LocalCandidate["proposal"] | undefined =
      options?.trainingEngine ? undefined : basicProposal(profile, locale);
    if (options?.trainingEngine) {
      const history = await db.v8Workouts.toArray(),
        notes = await db.aiMemoryNotes.toArray();
      const mapped = toEngineProfile(profile, {
        cautionLevels: painState?.cautionLevels,
        painFollowupRestrictions: painState?.painFollowupRestrictions,
        pregnancySafety: painState?.pregnancySafety,
        screeningEvidenceEvents: painState?.screeningEvidenceEvents,
        olderSafety: painState?.olderSafety,
        postpartumSafety: painState?.postpartumSafety,
        asOfDate: localDate(local?.timeZone ?? "Asia/Shanghai"),
        timeZone: local?.timeZone,
        locale,
        history,
        notes,
        ageYears: local?.bodyDetails?.values.age,
        bodyWeightKg: local?.bodyDetails?.values.weightKg,
      });
      if (!mapped) return invalid("ENGINE_SCREENING_REQUIRED");
      const result = enginePlanProposal(profile, mapped, history);
      enginePlan = result.plan;
      proposal = result.proposal;
      if (!proposal) throw new EnginePlanUnavailableError(result.plan);
    }
    if (!proposal) return invalid("BASIC_PLAN_UNAVAILABLE");
    await assertHealthItems(
      proposal.templates.flatMap((t) => t.items),
      painState,
    );
    const metadata = await repo.readMetadata();
    return {
      type: "plan_proposal",
      requestId: crypto.randomUUID(),
      mutationAllowed: false,
      restoreGeneration: metadata.restoreGeneration ?? 0,
      source: "local",
      expectedRevision: metadata.dataRevision,
      profile: structuredClone(profile),
      proposal,
      ...(enginePlan ? { enginePlan } : {}),
    };
  }
  async function adopt(candidate: LocalCandidate) {
    const proposal = planProposalSchema.parse(candidate.proposal),
      profile = v8CoachProfileSchema.parse(candidate.profile);
    if (!profile.adultConfirmed) return invalid("ADULT_CONFIRMATION_REQUIRED");
    return repo.write(async () => {
      const meta = await repo.readMetadata();
      const acceptedEnginePlan = checkedEnginePlan(
        candidate.enginePlan,
        proposal,
      );
      if (acceptedEnginePlan) {
        const mapped = await mappedEngineProfile(profile);
        if (!mapped || !applicableEnginePlan(acceptedEnginePlan, mapped))
          return invalid("ENGINE_PLAN_UNAVAILABLE");
      }
      if ((meta.restoreGeneration ?? 0) !== candidate.restoreGeneration)
        throw new DomainError("CONFLICT", "STALE_CANDIDATE");
      if (await db.v8Plans.get(candidate.requestId))
        throw new DomainError("CONFLICT", "ALREADY_SAVED");
      const state = await db.v8State.get("v8");
      if (!state) return invalid("PROFILE_REQUIRED");
      if (
        profile.population?.kind === "pregnant" &&
        profile.screening?.activityStatus === "inactive" &&
        !profile.population.inactiveRampStartedAt
      )
        profile.population = {
          ...profile.population,
          inactiveRampStartedAt: new Date().toISOString(),
        };
      if (state.cardiacPause) return invalid("CARDIAC_CLEARANCE_REQUIRED");
      if (state.olderSafety?.reviewRequiredAt)
        return invalid("FALL_PROFESSIONAL_REQUIRED");
      await assertHealthItems(
        proposal.templates.flatMap((t) => t.items),
        state,
      );
      if (candidate.trainingDates && !validTrainingDates(candidate.trainingDates))
        return invalid("INVALID_TRAINING_DATES");
      if (candidate.startTime && !timePattern.test(candidate.startTime))
        return invalid("INVALID_START_TIME");
      const id = crypto.randomUUID();
      const { reasons: _reasons, ...content } = proposal;
      const version = v8PlanVersionSchema.parse({
        ...content,
        id,
        planId: candidate.requestId,
        versionNumber: 1,
        createdAt: new Date().toISOString(),
        origin: "onboard",
        source: candidate.source ?? "local",
        changeSummary: [],
        ...(acceptedEnginePlan ? { enginePlan: acceptedEnginePlan } : {}),
        ...(candidate.trainingDates?.length
          ? { startDate: candidate.trainingDates[0], trainingDates: candidate.trainingDates }
          : candidate.startDate ? { startDate: candidate.startDate } : {}),
        ...(candidate.startTime ? { startTime: candidate.startTime } : {}),
      });
      await db.v8Plans.toCollection().modify({ readOnly: true });
      await db.v8Plans.add({
        id: candidate.requestId,
        currentVersionId: id,
        readOnly: false,
        name: proposal.goalText,
      });
      await db.v8PlanVersions.add(version);
      const { nextWorkoutOverride: _previousOverride, ...retained } = state;
      await db.v8State.put({
        ...retained,
        currentPlanId: candidate.requestId,
        coachProfile: profile,
      });
      return version;
    }, candidate.expectedRevision);
  }
  return { saveEngineSettings, snapshot, propose, adopt };
}
