// Plan versions: apply or undo a coach candidate, move the start date.
import { scheduleAfterProposal } from "../picked-schedule";
import { applicableEnginePlan } from "../../engine/environment";
import { DomainError } from "../../domain/errors";
import { v8PlanVersionSchema, v8WorkoutSchema } from "../../domain/schemas";
import type { CoachResponse, CoachRequest } from "../../coach/contracts";
import { adaptCoachResponse } from "../../coach/response-adapter";
import type { EnginePlan } from "../../engine/contracts";
import { isFeatureEnabled } from "../feature-flags";
import { shiftTrainingDates } from "../training-dates";
import { carriedBudget, carriedSchedule, invalid, localDate, START_DATE_WINDOW_DAYS } from "./shared";
import type { WorkflowContext } from "./context";
import type { createPlanSetup } from "./plan-setup";
import { DEFAULT_TIME_ZONE, addDays } from "../../domain/local-date";

export function createPlanVersions(ctx: WorkflowContext, depsIn: { adopt: ReturnType<typeof createPlanSetup>["adopt"] }) {
  const { repo, db, assertHealthItems, checkedEnginePlan, mappedEngineProfile } = ctx;
  const { adopt } = depsIn;
  /** Explicit acceptance only. A response alone never writes any training data. */
  async function applyCoachCandidate({
    request,
    response: raw,
    expectedRevision,
    enginePlan,
  }: {
    request: CoachRequest;
    response: CoachResponse;
    expectedRevision: number;
    enginePlan?: EnginePlan;
  }) {
    if (
      request.trainingEngine &&
      (!isFeatureEnabled("trainingEngine") ||
        ((raw.type === "plan_proposal" || raw.type === "change_proposal") &&
          !enginePlan))
    )
      throw new DomainError("CONFLICT", "STALE_CANDIDATE");
    const response = adaptCoachResponse(request, raw);
    if (request.task === "ONBOARD_PLAN" && response.type === "plan_proposal") {
      const state = await db.v8State.get("v8");
      const picked = request.schedule
        ? scheduleAfterProposal(
            {
              startDate: request.schedule.trainingDates[0],
              trainingDates: [...request.schedule.trainingDates],
              ...(request.schedule.startTime ? { startTime: request.schedule.startTime } : {}),
            },
            request,
            request.profile,
            response.proposal,
          )
        : {};
      return adopt({
        ...response,
        ...picked,
        source: "ai",
        expectedRevision,
        enginePlan,
        profile: {
          ...state?.coachProfile,
          ...request.profile,
          weeklyTarget: response.proposal.weeklyTarget,
          preferredDays: response.proposal.preferredDays,
          sessionMinutes: response.proposal.sessionMinutes,
          confirmedAt: new Date().toISOString(),
        },
      });
    }
    if (!("target" in response) || !("target" in request))
      return invalid("NO_PLAN_CANDIDATE");
    return repo.write(async () => {
      if (request.trainingEngine && !isFeatureEnabled("trainingEngine"))
        throw new DomainError("CONFLICT", "STALE_CANDIDATE");
      const meta = await repo.readMetadata(),
        state = await db.v8State.get("v8");
      if (state?.cardiacPause) return invalid("CARDIAC_CLEARANCE_REQUIRED");
      if (state?.olderSafety?.reviewRequiredAt)
        return invalid("FALL_PROFESSIONAL_REQUIRED");
      if (state?.postpartumSafety?.urgentAt)
        return invalid("POSTPARTUM_PROFESSIONAL_REQUIRED");
      const plan = await db.v8Plans.get(request.target.planId);
      if (
        request.restoreGeneration !== (meta.restoreGeneration ?? 0) ||
        request.target.revision !== expectedRevision ||
        !state ||
        !plan ||
        plan.deletedAt ||
        plan.readOnly ||
        state.currentPlanId !== plan.id ||
        plan.currentVersionId !== request.target.versionId
      )
        throw new DomainError("CONFLICT", "STALE_CANDIDATE");
      const version = await db.v8PlanVersions.get(plan.currentVersionId);
      if (!version) return invalid("PLAN_UNAVAILABLE");
      if (
        response.type === "today_adjustment" &&
        request.task === "ADJUST_TODAY"
      ) {
        await assertHealthItems(response.template.items, state);
        if (!version.templates.some((t) => t.id === request.template.id))
          return invalid("TEMPLATE_UNAVAILABLE");
        if (request.workoutId) {
          const workout = await db.v8Workouts.get(request.workoutId);
          if (
            !workout ||
            workout.status !== "in_progress" ||
            workout.planVersionId !== version.id ||
            workout.templateId !== request.template.id
          )
            throw new DomainError("CONFLICT", "TRAINING_CHANGED");
          const before =
            workout.templateSnapshot ??
            version.templates.find((t) => t.id === workout.templateId)!;
          // Do not reinterpret any completed set or substitution as a different planned movement.
          const locked = new Set([
            ...workout.sets.map((s) => s.itemIndex),
            ...(workout.substitutions ?? []).map((s) => s.itemIndex),
          ]);
          for (const index of locked)
            if (
              JSON.stringify(before.items[index]) !==
              JSON.stringify(response.template.items[index])
            )
              throw new DomainError("CONFLICT", "COMPLETED_ITEM_READ_ONLY");
          await db.v8Workouts.put(
            v8WorkoutSchema.parse({
              ...workout,
              templateSnapshot: response.template,
              plannedSetCount: response.template.items.reduce(
                (sum, item) => sum + item.sets,
                0,
              ),
              plannedExercises: response.template.items.map(
                (item, itemIndex) => ({
                  exerciseId: item.exerciseId,
                  itemIndex,
                  plannedSetCount: item.sets,
                }),
              ),
            }),
          );
        } else {
          if (await db.v8Workouts.where("status").equals("in_progress").count())
            throw new DomainError("CONFLICT", "TRAINING_CHANGED");
          await db.v8State.put({
            ...state,
            nextWorkoutOverride: {
              planVersionId: version.id,
              templateId: request.template.id,
              template: response.template,
              requestId: request.requestId,
            },
          });
        }
        return response.template;
      }
      const proposal =
        response.type === "change_proposal"
          ? response.proposal
          : response.type === "review_summary"
            ? response.suggestion?.proposal
            : undefined;
      if (!proposal) return invalid("NO_PLAN_CANDIDATE");
      if (request.trainingEngine && !enginePlan)
        throw new DomainError("CONFLICT", "STALE_CANDIDATE");
      const acceptedEnginePlan = checkedEnginePlan(enginePlan, proposal);
      if (acceptedEnginePlan) {
        const mapped = state.coachProfile
          ? await mappedEngineProfile({
              ...state.coachProfile,
              weeklyTarget: proposal.weeklyTarget,
              sessionMinutes: proposal.sessionMinutes,
              preferredDays: proposal.preferredDays,
            })
          : undefined;
        if (!mapped || !applicableEnginePlan(acceptedEnginePlan, mapped))
          return invalid("ENGINE_PLAN_UNAVAILABLE");
      }
      const { reasons: _reasons, ...content } = proposal;
      const next = v8PlanVersionSchema.parse({
        ...content,
        scheduleOriginalText: version.scheduleOriginalText,
        id: crypto.randomUUID(),
        planId: plan.id,
        versionNumber: version.versionNumber + 1,
        createdAt: new Date().toISOString(),
        source: "ai",
        origin:
          response.type === "review_summary"
            ? "review_suggestion"
            : "coach_change",
        basedOnVersionId: version.id,
        ...(acceptedEnginePlan ? { enginePlan: acceptedEnginePlan } : {}),
        // Picked calendar days stay unless the user explicitly asked to change days in this conversation.
        ...scheduleAfterProposal(carriedSchedule(version), request, version, proposal),
        ...carriedBudget(version),
        changeSummary:
          response.type === "change_proposal"
            ? response.changes
            : [
                response.type === "review_summary"
                  ? response.suggestion!.summary
                  : "",
              ],
      });
      await db.v8PlanVersions.add(next);
      await db.v8Plans.put({ ...plan, currentVersionId: next.id });
      const { nextWorkoutOverride: _stale, ...rest } = state;
      await db.v8State.put(rest);
      return next;
    }, expectedRevision);
  }
  async function undoAppliedCoachVersion({
    planId,
    appliedVersionId,
    priorVersionId,
    expectedRevision,
  }: {
    planId: string;
    appliedVersionId: string;
    priorVersionId: string;
    expectedRevision: number;
  }) {
    return repo.write(async () => {
      const plan = await db.v8Plans.get(planId),
        applied = await db.v8PlanVersions.get(appliedVersionId),
        prior = await db.v8PlanVersions.get(priorVersionId);
      if (
        !plan ||
        !applied ||
        !prior ||
        plan.deletedAt ||
        plan.currentVersionId !== appliedVersionId ||
        applied.planId !== planId ||
        prior.planId !== planId ||
        applied.basedOnVersionId !== priorVersionId ||
        Date.now() - Date.parse(applied.createdAt) > 10_000
      )
        throw new DomainError("CONFLICT", "UNDO_WINDOW_EXPIRED");
      await db.v8Plans.put({ ...plan, currentVersionId: priorVersionId });
      return prior;
    }, expectedRevision);
  }
  /** Moves the current plan's start date. Plans are never edited in place: this saves a new version. */
  async function changeStartDate({
    startDate,
    expectedRevision,
    summary,
  }: {
    startDate: string;
    expectedRevision: number;
    summary: string;
  }) {
    return repo.write(async () => {
      const local = await db.profiles.toCollection().first();
      const today = localDate(local?.timeZone ?? DEFAULT_TIME_ZONE);
      const latest = addDays(today, START_DATE_WINDOW_DAYS);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || startDate < today || startDate > latest)
        return invalid("INVALID_START_DATE");
      const state = await db.v8State.get("v8");
      const plan = state?.currentPlanId ? await db.v8Plans.get(state.currentPlanId) : undefined;
      const version = plan ? await db.v8PlanVersions.get(plan.currentVersionId) : undefined;
      if (!state || !plan || !version || plan.readOnly || plan.deletedAt) return invalid("PLAN_UNAVAILABLE");
      if (await db.v8Workouts.where("status").equals("in_progress").count())
        throw new DomainError("CONFLICT", "TRAINING_CHANGED");
      if (version.startDate === startDate) return version;
      const next = v8PlanVersionSchema.parse({
        ...version,
        id: crypto.randomUUID(),
        versionNumber: version.versionNumber + 1,
        createdAt: new Date().toISOString(),
        origin: "manual",
        basedOnVersionId: version.id,
        reviewRule: undefined,
        changeSummary: [summary.slice(0, 200)],
        startDate,
        // Chosen training days move with the start date; their rhythm stays the same.
        ...(version.trainingDates?.length ? { trainingDates: shiftTrainingDates(version.trainingDates, startDate) } : {}),
      });
      await db.v8PlanVersions.add(next);
      await db.v8Plans.put({ ...plan, currentVersionId: next.id });
      // A today-only adjustment of the same plan stays attached to the new version.
      if (state.nextWorkoutOverride?.planVersionId === version.id)
        await db.v8State.put({ ...state, nextWorkoutOverride: { ...state.nextWorkoutOverride, planVersionId: next.id } });
      return next;
    }, expectedRevision);
  }
  return { applyCoachCandidate, undoAppliedCoachVersion, changeStartDate };
}
