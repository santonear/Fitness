/** V1 compatibility test reference only; not a V2 independent safety proof. */
import type {
  EnginePlan,
  EngineProfile,
  Pattern,
  ValidationIssue,
} from "../../../src/engine/contracts";
import { Rules, stableString } from "../../../src/engine/data";
import {
  credit,
  mobilityTempo,
  effectiveGoalRole,
  patterns,
  prescribe,
  prescribedRepRange,
  strengthRoles,
  volume,
  volumeLimits,
  weeklyVolume,
  newWeek,
  type Template,
} from "../../../src/engine/dose";
import {
  actualWarmupSeconds,
  hasResistanceWarmupContext,
  sourceWarmupRamps,
  sourceConditioningSlot,
  blockSeconds,
  circuitBudgetConflict,
  cooldownCapSeconds,
  readLegacySourceTarget,
  estimatedSeconds,
  pairAllowed,
  plannedCooldown,
  requiredStretchGroups,
  safetyBlockMinimums,
  shortStretchSession,
  sourceMobilityTarget,
  startMovingAllocation,
  weeklyElapsedAllocation,
} from "./legacy-duration-reference";
import {
  hardEligible,
  mobilityRegions,
} from "../../../src/engine/progression/legacy-candidates";
import type { SelectionContext } from "../../../src/engine/progression/legacy-candidates";
const makeContext = (
  profile: EngineProfile,
  rules: Rules,
  safety: SafetyState,
  seed: string,
  trace: EnginePlan["trace"],
): SelectionContext => ({
  profile,
  rules,
  safety,
  seed,
  trace,
  used: new Set<string>(),
  ladders: new Set<string>(),
});
import {
  safety,
  type SafetyState,
} from "../../../src/engine/gates/strength-scoring";

/** Feasibility failures stay visible. Validation never relaxes safety to make a quality score pass. */
export function validate(
  plan: EnginePlan,
  p: EngineProfile,
  r: Rules,
  state?: SafetyState,
  strictDefaultShares = false,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const issue = (
    code: string,
    ruleId: string,
    reason: string,
    templateId?: string,
    itemIndex?: number,
    severity: ValidationIssue["severity"] = "error",
  ) =>
    issues.push({
      code,
      ruleId,
      severity,
      reason,
      ...(templateId ? { templateId } : {}),
      ...(itemIndex !== undefined ? { itemIndex } : {}),
    });
  if (!r.data.rules.length) {
    issue(
      "data_unavailable",
      "meta.manual.version",
      "compiled_data_unavailable",
    );
    return issues;
  }
  const s = state ?? safety(p, r);
  if (s.blocked) {
    if (plan.templates.length)
      issue(
        "blocked_has_templates",
        "safety.screen.parq",
        "blocked_profile_must_not_generate_templates",
      );
    return issues;
  }
  if (!plan.templates.length) {
    issue(
      "empty_plan",
      "select.pipeline",
      "nonblocked profile has no templates",
    );
    return issues;
  }
  const ctx = makeContext(p, r, s, plan.meta.seed, []);
  const postPhase1 = s.population === "postpartum" && s.phase === 1;
  const allPatterns = patterns(
    plan.templates.flatMap((t) => t.items),
    r,
    true,
  );
  const rt = plan.templates.filter((t) =>
    t.items.some((i) => i.prescription?.block === "main"),
  );
  if (
    p.goal === "start_moving" &&
    !postPhase1 &&
    plan.templates.some((t) => t.targetMinutes !== undefined)
  ) {
    const allocation = startMovingAllocation(p, r, s),
      work = (t: Template) =>
        t.items.some((i) =>
          ["main", "accessory"].includes(i.prescription?.block ?? ""),
        ),
      actualRt = plan.templates.filter(work).length,
      actualAerobic = plan.templates.filter(
        (t) => !allocation.otherDays || !work(t),
      );
    if (
      plan.templates.length !== p.daysPerWeek ||
      actualRt !== allocation.rtDays ||
      actualAerobic.length !== allocation.aerobicDays ||
      plan.templates.some((t) => {
        const seconds = t.items
          .filter(
            (i) =>
              i.prescription?.block === "conditioning" &&
              r.byExercise.get(i.exerciseId)?.modality === "cardio",
          )
          .reduce(
            (sum, i) =>
              sum +
              ("durationSeconds" in i.target
                ? i.sets *
                  i.target.durationSeconds *
                  (i.prescription?.perSide ||
                  r.byExercise.get(i.exerciseId)?.time.per_side
                    ? r.get("session.time.model").per_side_multiplier
                    : 1)
                : 0),
            0,
          );
        return (
          seconds !== (allocation.otherDays && work(t) ? 0 : allocation.seconds)
        );
      })
    )
      issue(
        "start_moving_allocation",
        "goal.params.start_moving",
        "source_target_requires_default_capped_rt_and_dedicated_aerobic_day_quota",
      );
  }
  for (const t of plan.templates) {
    const seen = new Set<string>(),
      ladders = new Set<string>();
    const roles =
      p.goal === "strength" ? strengthRoles(t.items, p, r) : undefined;
    if (roles?.size) {
      const count = t.items.filter(
          (i) => roles.has(i) && effectiveGoalRole(i, p, r) === "main",
        ).length,
        bounds = r.get("goal.params.strength").main_lifts_per_session;
      if (count < bounds.min || count > bounds.max)
        issue(
          "strength_main_count",
          "goal.params.strength",
          "actual_main_lifts_outside_goal_range",
          t.id,
        );
    }
    const validTarget =
        t.targetMinutes !== undefined &&
        (sourceMobilityTarget(t, p, r) ||
          (p.goal === "start_moving" &&
            t.targetMinutes === readLegacySourceTarget(t, p, r))),
      minutes = validTarget ? t.targetMinutes! : p.sessionMinutes,
      timed = { ...t, targetMinutes: undefined },
      timingProfile = { ...p, sessionMinutes: minutes };
    const conditioningSlot = sourceConditioningSlot(
      validTarget && p.goal === "start_moving" ? t : timed,
      validTarget && p.goal === "start_moving" ? p : timingProfile,
      r,
    );
    if (conditioningSlot) {
      const items = t.items.filter(
          (i) => i.prescription?.block === "conditioning",
        ),
        range = Array.isArray(conditioningSlot.minutes)
          ? conditioningSlot.minutes
          : [conditioningSlot.minutes, conditioningSlot.minutes];
      if (
        items.length &&
        (items.length !== 1 ||
          items.some((i) => {
            const e = r.byExercise.get(i.exerciseId),
              seconds =
                "durationSeconds" in i.target
                  ? i.target.durationSeconds *
                    (i.prescription?.perSide || e?.time.per_side
                      ? r.get("session.time.model").per_side_multiplier
                      : 1)
                  : 0;
            return (
              !e ||
              !conditioningSlot.pattern.includes(e.primary_pattern) ||
              !conditioningSlot.use.some((use) => e.use.includes(use)) ||
              i.sets !== 1 ||
              i.prescription?.structure !== "straight" ||
              !!i.prescription.groupId ||
              seconds < range[0] * 60 ||
              seconds > range[1] * 60
            );
          }))
      )
        issue(
          "conditioning_slot_dose",
          validTarget && p.goal === "start_moving"
            ? "goal.params.start_moving"
            : `session.template.min${minutes >= 90 ? 90 : minutes}`,
          "authored_continuous_conditioning_requires_one_source_duration_block",
          t.id,
        );
    }
    if (t.targetMinutes !== undefined && !validTarget)
      issue(
        "duration_target_scope",
        p.goal === "start_moving"
          ? "goal.params.start_moving"
          : "week.day.mobility",
        "target_requires_replayed_source_dose_and_duration",
        t.id,
      );
    if (t.durationScope === "untargeted" && !postPhase1)
      issue(
        "duration_scope",
        "postpartum.phase1",
        "untargeted_scope_requires_source_postpartum_phase1",
        t.id,
      );
    if (!postPhase1) {
      const warm = t.items.filter((i) => i.prescription?.block === "warmup"),
        general = r.get("session.warmup.general"),
        dynamic = r.get("session.warmup.dynamic");
      const canonical = plannedCooldown(timed, timingProfile, r, {
        ...s,
        cooldownPrimaryOnly: shortStretchSession(timed, timingProfile, r, s),
      });
      if (
        blockSeconds(t, "cooldown", r) >
        cooldownCapSeconds(timed, timingProfile, r)
      )
        issue(
          "cooldown_block_cap",
          "duration.block.mobility",
          "actual_cooldown_above_source_block_cap",
          t.id,
        );
      for (const group of new Set([
        ...requiredStretchGroups(t, r),
        ...canonical.priority,
      ])) {
        const held = t.items
          .filter(
            (i) =>
              i.prescription?.block === "cooldown" &&
              r.byExercise.get(i.exerciseId)?.mobility_type === "static" &&
              r.byExercise.get(i.exerciseId)?.stretch_targets?.includes(group),
          )
          .reduce(
            (sum, i) =>
              sum +
              ("durationSeconds" in i.target
                ? i.sets * i.target.durationSeconds
                : 0),
            0,
          );
        if (!held && canonical.safetyUnavailable.includes(group))
          issue(
            "cooldown_stretch_safety_unavailable",
            "session.cooldown.stretch",
            `no_safe_default_stretch_candidate:${group}`,
            t.id,
            undefined,
            "warning",
          );
        else if (
          !held &&
          !canonical.omitted.includes(group) &&
          !canonical.optionalUncovered.includes(group)
        )
          issue(
            "cooldown_stretch_missing",
            "session.cooldown.stretch",
            `no_verified_static_stretch:${group}`,
            t.id,
          );
        else if (
          held < r.get("session.cooldown.stretch").total_s_per_muscle_target
        )
          issue(
            "cooldown_stretch_target",
            "session.cooldown.stretch",
            `short_session_stretch_below_default_target:${group}:${held}`,
            t.id,
            undefined,
            "warning",
          );
      }
      if (
        minutes >= general.include_when.session_minutes_min &&
        !warm.some((i) => {
          const e = r.byExercise.get(i.exerciseId);
          return (
            e?.modality === "cardio" &&
            e.primary_pattern === "cardio_cyclic" &&
            !general.exclude_flags.some((flag: string) =>
              e.flags.includes(flag),
            )
          );
        })
      )
        issue(
          "general_warmup_missing",
          "session.warmup.general",
          "no_eligible_general_warmup",
          t.id,
        );
      const resistance = hasResistanceWarmupContext(t, r),
        workSeconds = (items: typeof warm) =>
          items.reduce(
            (sum, i) =>
              sum +
              ("durationSeconds" in i.target
                ? i.sets *
                  i.target.durationSeconds *
                  (i.prescription?.perSide ||
                  r.byExercise.get(i.exerciseId)?.time.per_side
                    ? r.get("session.time.model").per_side_multiplier
                    : 1)
                : 0),
            0,
          ),
        cardio = warm.filter(
          (i) => r.byExercise.get(i.exerciseId)?.modality === "cardio",
        ),
        movements = warm.filter(
          (i) => r.byExercise.get(i.exerciseId)?.mobility_type === "dynamic",
        ),
        range =
          general.seconds_by_duration[
            String(
              r
                .get("session.durations.allowed")
                .minutes.filter((value: number) => value <= minutes)
                .at(-1) ?? r.get("session.durations.allowed").minutes[0],
            )
          ];
      const safetyWarmup = safetyBlockMinimums(timed, timingProfile, r),
        actualWarm = actualWarmupSeconds(timed, timingProfile, r),
        generalItem = cardio.length === 1 ? cardio[0] : undefined;
      const minimalIntegerFill = (() => {
        if (!generalItem || !("durationSeconds" in generalItem.target))
          return false;
        const e = r.byExercise.get(generalItem.exerciseId)!,
          factor =
            generalItem.sets *
            (generalItem.prescription?.perSide || e.time.per_side
              ? r.get("session.time.model").per_side_multiplier
              : 1),
          overhead =
            generalItem.sets *
            r.get("duration.set.overhead").overhead_s_per_set,
          other =
            actualWarm - generalItem.target.durationSeconds * factor - overhead,
          needed = Math.max(
            1,
            Math.ceil((safetyWarmup.warmupSeconds - other - overhead) / factor),
          );
        return (
          generalItem.target.durationSeconds === needed &&
          actualWarm >= safetyWarmup.warmupSeconds &&
          actualWarm < safetyWarmup.warmupSeconds + factor
        );
      })();
      const exactSafetyFill =
        safetyWarmup.applies &&
        (actualWarm === safetyWarmup.warmupSeconds || minimalIntegerFill);
      if (
        resistance &&
        cardio.length &&
        (!Array.isArray(range)
          ? !exactSafetyFill
          : workSeconds(cardio) < range[0] ||
            (workSeconds(cardio) > range[1] && !exactSafetyFill))
      )
        issue(
          "warmup_general_bounds",
          "session.warmup.general",
          "general_aerobic_work_outside_source_duration_range",
          t.id,
        );
      if (
        cardio.some(
          (i) =>
            !i.prescription?.targetRpe ||
            i.prescription.targetRpe[1] > general.intensity_rpe[1],
        )
      )
        issue(
          "warmup_intensity",
          "session.warmup.general",
          "aerobic_warmup_requires_explicit_source_low_intensity",
          t.id,
        );
      if (resistance && !movements.length)
        issue(
          "dynamic_warmup_missing",
          "session.warmup.dynamic",
          "no_eligible_verified_dynamic_content",
          t.id,
        );
      if (
        movements.length &&
        (movements.length < dynamic.exercises[0] ||
          movements.length > dynamic.exercises[1] ||
          workSeconds(movements) < dynamic.seconds[0] ||
          workSeconds(movements) > dynamic.seconds[1])
      )
        issue(
          "warmup_dynamic_bounds",
          "session.warmup.dynamic",
          "total_dynamic_work_or_exercise_count_outside_source_range",
          t.id,
        );
      const workItems = t.items.filter((i) =>
          ["main", "accessory"].includes(i.prescription?.block ?? ""),
        ),
        parts = new Set(
          workItems
            .map((i) => r.byExercise.get(i.exerciseId)?.bodyPart)
            .filter(Boolean),
        ),
        muscles = new Set(
          workItems.flatMap(
            (i) => r.byExercise.get(i.exerciseId)?.primaryMuscles ?? [],
          ),
        );
      if (
        resistance &&
        movements.some((i) => {
          const e = r.byExercise.get(i.exerciseId)!;
          return (
            !(e.bodyPart && parts.has(e.bodyPart)) &&
            !(e.primaryMuscles ?? []).some((m) => muscles.has(m))
          );
        })
      )
        issue(
          "warmup_dynamic_match",
          "session.warmup.dynamic",
          "prefer_dynamic_content_matching_actual_work",
          t.id,
          undefined,
          "warning",
        );
      if (
        warm.some((i) => {
          const e = r.byExercise.get(i.exerciseId);
          return (
            e?.modality === "mobility" &&
            (!["dynamic", "static"].includes(e.mobility_type ?? "") ||
              (e.mobility_type === "static" && !e.stretch_targets?.length))
          );
        })
      )
        issue(
          "warmup_content_unknown",
          "session.warmup.dynamic",
          "warmup_mobility_requires_verified_type_and_target",
          t.id,
        );
      const statics = warm.filter(
          (i) => r.byExercise.get(i.exerciseId)?.mobility_type === "static",
        ),
        staticRule = r.get("session.warmup.no_long_static"),
        held: Record<string, number> = {};
      for (const item of statics) {
        if (
          "durationSeconds" in item.target &&
          item.target.durationSeconds > staticRule.short_static_allowed_s_max
        )
          issue(
            "warmup_static_hold",
            "session.warmup.no_long_static",
            "pretraining_static_hold_exceeds_short_source_range",
            t.id,
          );
        for (const group of r.byExercise.get(item.exerciseId)
          ?.stretch_targets ?? [])
          held[group] =
            (held[group] ?? 0) +
            ("durationSeconds" in item.target
              ? item.sets * item.target.durationSeconds
              : 0);
        if (
          !warm
            .slice(warm.indexOf(item) + 1)
            .some(
              (i) =>
                r.byExercise.get(i.exerciseId)?.mobility_type === "dynamic",
            )
        )
          issue(
            "warmup_static_sequence",
            "session.warmup.no_long_static",
            "short_static_requires_following_dynamic_work",
            t.id,
          );
      }
      if (
        Object.values(held).some(
          (seconds) =>
            seconds > staticRule.pre_training_static_hold_s_per_muscle_max,
        )
      )
        issue(
          "warmup_static_hold",
          "session.warmup.no_long_static",
          "pretraining_static_total_exceeds_source_range",
          t.id,
        );
      const ramps = new Map(
        sourceWarmupRamps(timed, timingProfile, r).map((entry) => [
          entry.itemIndex,
          entry.seconds,
        ]),
      );
      for (const [index, item] of t.items.entries())
        if (
          item.prescription?.warmupSeconds !== ramps.get(index) &&
          (item.prescription?.warmupSeconds !== undefined || ramps.has(index))
        )
          issue(
            "warmup_ramp_source",
            "session.warmup.ramp_sets",
            "specific_warmup_must_match_source_identity_and_scheme",
            t.id,
            index,
          );
    }
    const minimum = safetyBlockMinimums(timed, timingProfile, r);
    if (minimum.applies) {
      if (actualWarmupSeconds(timed, timingProfile, r) < minimum.warmupSeconds)
        issue(
          "safety_warmup_min",
          "safety.session.warmup_cooldown",
          "actual_warmup_below_source_minimum",
          t.id,
        );
      if (blockSeconds(t, "cooldown", r) < minimum.cooldownSeconds)
        issue(
          "safety_cooldown_min",
          "safety.session.warmup_cooldown",
          "actual_cooldown_below_source_minimum",
          t.id,
        );
    }
    const otherTypes = r.get("week.days.allocation").other_days_type[p.goal],
      offset = plan.templates.indexOf(t) - rt.length,
      sourceOther = Array.isArray(otherTypes)
        ? otherTypes[Math.max(0, offset) % otherTypes.length]
        : otherTypes;
    if (
      !postPhase1 &&
      (t.items.some((i) => i.prescription?.block === "mobility") ||
        (offset >= 0 &&
          sourceOther === "mobility" &&
          !t.items.some((i) => i.prescription?.block === "main")))
    )
      for (const slot of r
        .get("week.day.mobility")
        .slots.filter((slot: { target?: string }) => slot.target)) {
        const seconds = t.items
          .filter(
            (i) =>
              i.prescription?.block === "mobility" &&
              mobilityRegions(r.byExercise.get(i.exerciseId)!, r).includes(
                slot.target,
              ),
          )
          .reduce(
            (sum, i) =>
              sum +
              ("durationSeconds" in i.target
                ? i.sets *
                  i.target.durationSeconds *
                  (i.prescription?.perSide
                    ? r.get("session.time.model").per_side_multiplier
                    : 1)
                : 0),
            0,
          );
        if (seconds < r.get("week.day.mobility").seconds_per_region_min)
          issue(
            "mobility_region_missing",
            "week.day.mobility",
            `verified_region_work_below_source_minimum:${slot.target}`,
            t.id,
          );
      }
    for (const [n, i] of t.items.entries()) {
      const e = r.byExercise.get(i.exerciseId);
      if (!e) {
        issue(
          "unknown_exercise",
          "select.pipeline",
          "unknown_exercise",
          t.id,
          n,
        );
        continue;
      }
      if (
        ["main", "accessory"].includes(i.prescription?.block ?? "") &&
        ["strength", "isometric"].includes(e.modality) &&
        (!e.primaryMuscles?.length ||
          e.primaryMuscles.some(
            (m) => r.get("dose.muscle_groups").catalog_map[m] === undefined,
          ))
      )
        issue(
          "stretch_primary_unknown",
          "session.cooldown.stretch",
          "registered_primary_muscles_unavailable",
          t.id,
          n,
          "warning",
        );
      if (!hardEligible(e, ctx))
        issue(
          "excluded_exercise",
          "select.pipeline",
          "exercise_fails_hard_filter",
          t.id,
          n,
        );
      if (seen.has(i.exerciseId))
        issue(
          "duplicate_exercise",
          "variety.no_repeat",
          "duplicate_exercise_id",
          t.id,
          n,
        );
      seen.add(i.exerciseId);
      if (e.ladder.id && ladders.has(e.ladder.id))
        issue(
          "duplicate_ladder",
          "variety.no_repeat",
          "duplicate_ladder",
          t.id,
          n,
        );
      if (e.ladder.id) ladders.add(e.ladder.id);
      if (i.prescription?.excludedPreviousIds?.includes(i.exerciseId))
        issue(
          "substitution_bounce",
          "variety.no_repeat",
          "replacement_reuses_excluded_previous",
          t.id,
          n,
        );
      if (
        i.target.metricType === "reps_load" &&
        !i.target.loadGrams &&
        !i.prescription?.loadDescription
      )
        issue(
          "missing_load",
          "dose.load.initial_selection",
          "loadable_exercise_needs_weight_or_relative_description",
          t.id,
          n,
        );
      if (
        e.modality === "isometric" &&
        ["main", "accessory"].includes(i.prescription?.block ?? "")
      ) {
        const range = r.get("dose.isometric")[p.level].hold_s;
        if (
          !("durationSeconds" in i.target) ||
          i.target.durationSeconds < range[0] ||
          i.target.durationSeconds > range[1]
        )
          issue(
            "isometric_hold_bounds",
            "dose.isometric",
            "working_hold_outside_source_range",
            t.id,
            n,
          );
      }
      if (
        e.stretch_hold_s &&
        "durationSeconds" in i.target &&
        (i.target.durationSeconds < e.stretch_hold_s[0] ||
          i.target.durationSeconds > e.stretch_hold_s[1])
      )
        issue(
          "stretch_source_hold_bounds",
          "dose.stretch",
          "selected_hold_outside_verified_action_source_range",
          t.id,
          n,
        );
      if (
        e.stretch_hold_s &&
        "durationSeconds" in i.target &&
        !["cooldown", "mobility"].includes(i.prescription?.block ?? "")
      ) {
        const hold = r.get("dose.stretch").hold_s,
          range =
            s.population === "older_adult" ? hold.older_adult : hold.range;
        if (
          i.target.durationSeconds < range[0] ||
          i.target.durationSeconds > range[1]
        )
          issue(
            "stretch_dose_bounds",
            "dose.stretch",
            "selected_hold_outside_population_range",
            t.id,
            n,
          );
      }
      const tempo = mobilityTempo(
        e,
        p,
        r,
        i.prescription?.block ?? "main",
        i.target,
      );
      if (
        tempo &&
        (i.prescription?.secondsPerRep !== tempo.secondsPerRep ||
          stableString(i.prescription?.tempo) !== stableString(tempo.tempo))
      )
        issue(
          "mobility_tempo_source",
          "goal.params.mobility",
          "fixed_goal_cadence_must_match_source",
          t.id,
          n,
        );
      const setBounds = r.get("dose.sets_exercise");
      if (roles?.has(i)) {
        const role = roles.get(i)!,
          expected = prescribe(e, p, r, s, role, i.sets);
        if (effectiveGoalRole(i, p, r) !== role)
          issue(
            "strength_role",
            "goal.params.strength",
            "actual_role_disagrees_with_authored_position_and_goal",
            t.id,
            n,
          );
        if (
          role === "main" &&
          i.sets > r.get("goal.params.strength").main_lift.sets_per_session[1]
        )
          issue(
            "strength_main_set_cap",
            "goal.params.strength",
            "actual_main_sets_above_goal_cap",
            t.id,
            n,
          );
        if (
          i.prescription &&
          (i.prescription.rir[0] < expected.prescription!.rir[0] ||
            i.prescription.rir[1] < i.prescription.rir[0])
        )
          issue(
            "strength_role_rir",
            "goal.params.strength",
            "rir_below_source_role_or_inverted",
            t.id,
            n,
          );
        if (
          i.prescription?.structure === "straight" &&
          e.modality !== "isometric"
        ) {
          const bounds =
            r.get("dose.rest.table")[
              e.nsca_class === "isolation" ? "isolation" : "other_compound"
            ].bounds;
          if (
            i.prescription.restSeconds < bounds[0] ||
            i.prescription.restSeconds > bounds[1] ||
            (role === "main" &&
              p.level === "intermediate" &&
              i.prescription.restSeconds <
                r.get("dose.rest.table").intermediate_strength_main.min)
          )
            issue(
              "strength_role_rest",
              "dose.rest.table",
              "rest_outside_source_role_range",
              t.id,
              n,
            );
        }
        if ("reps" in i.target) {
          const bounds = prescribedRepRange(e, p, r, s, role);
          if (
            "reps" in expected.target &&
            (i.target.reps < bounds[0] || i.target.reps > bounds[1])
          )
            issue(
              role === "main"
                ? "strength_main_reps"
                : "strength_accessory_reps",
              "goal.params.strength",
              role + "_reps_outside_goal_source_range",
              t.id,
              n,
            );
        }
      }
      if (
        p.goal === "start_moving" &&
        ["main", "accessory"].includes(i.prescription?.block ?? "") &&
        i.sets > r.get("goal.params.start_moving").sets_per_exercise.max
      )
        issue(
          "goal_exercise_set_cap",
          "goal.params.start_moving",
          "working_sets_above_source_goal_cap",
          t.id,
          n,
        );
      if (
        p.goal === "start_moving" &&
        ["main", "accessory"].includes(i.prescription?.block ?? "")
      ) {
        if ("reps" in i.target) {
          const range = prescribedRepRange(e, p, r, s, i.prescription!.block);
          if (i.target.reps < range[0] || i.target.reps > range[1])
            issue(
              "start_moving_work_reps",
              "goal.params.start_moving",
              "working_reps_outside_source_range",
              t.id,
              n,
            );
        } else if (
          e.modality === "isometric" &&
          "durationSeconds" in i.target
        ) {
          const range = r.get("dose.isometric")[p.level].hold_s;
          if (
            i.target.durationSeconds < range[0] ||
            i.target.durationSeconds > range[1]
          )
            issue(
              "start_moving_work_hold",
              "dose.isometric",
              "working_hold_outside_source_range",
              t.id,
              n,
            );
        }
      }
      if (
        !["warmup", "cooldown", "conditioning", "balance"].includes(
          i.prescription?.block ?? "",
        ) &&
        i.sets > setBounds.max[p.level]
      )
        issue(
          "exercise_set_cap",
          "dose.sets_exercise",
          "sets_above_level_cap",
          t.id,
          n,
        );
      const shoulderReduction =
        p.cautions.includes("shoulder") &&
        ["push_horizontal", "push_vertical"].includes(e.primary_pattern)
          ? r.get("caution.shoulder.filter").level_1.modify[0]
          : undefined;
      const setFloor = shoulderReduction
        ? Math.max(
            shoulderReduction.sets_min,
            setBounds.min + shoulderReduction.sets_delta,
          )
        : setBounds.min;
      if (
        i.prescription?.block === "main" &&
        !newWeek(p, r) &&
        p.goal !== "start_moving" &&
        p.sessionMinutes > 10 &&
        s.population !== "older_adult" &&
        i.sets < setFloor
      )
        issue(
          "exercise_set_floor",
          "dose.sets_exercise",
          "sets_below_main_minimum",
          t.id,
          n,
        );
      if (
        p.goal === "strength" &&
        p.population.kind === "general" &&
        i.prescription?.block === "accessory" &&
        !newWeek(p, r) &&
        p.sessionMinutes > 10 &&
        p.daysPerWeek >=
          r.get("goal.floor.all").applies_when.days_available_min &&
        i.sets < setFloor
      )
        issue(
          "exercise_set_floor",
          "goal.floor.all",
          "sets_below_accessory_minimum",
          t.id,
          n,
        );
      if (i.prescription?.block === "mobility") {
        if (
          e.modality !== "mobility" ||
          !e.mobility_type ||
          !mobilityRegions(e, r).length ||
          !("durationSeconds" in i.target)
        )
          issue(
            "mobility_work_type",
            "week.day.mobility",
            "formal_mobility_requires_verified_region_content",
            t.id,
            n,
          );
        if (!e.use.includes("cooldown"))
          issue(
            "mobility_work_use",
            "select.use_tag.slot_match",
            "formal_mobility_requires_source_use",
            t.id,
            n,
          );
        if (
          i.prescription.structure !== "straight" ||
          i.prescription.groupId ||
          i.prescription.restSeconds !==
            r.get("duration.block.mobility").rest_between_s
        )
          issue(
            "mobility_work_structure",
            "duration.block.mobility",
            "formal_mobility_requires_actual_source_work_timing",
            t.id,
            n,
          );
      }
      if (
        e.modality === "mobility" &&
        ["cooldown", "mobility"].includes(i.prescription?.block ?? "") &&
        "durationSeconds" in i.target
      ) {
        const stretch = r.get("dose.stretch").hold_s;
        const range =
          s.population === "older_adult" ? stretch.older_adult : stretch.range;
        if (i.target.durationSeconds > range[1])
          issue(
            "stretch_hold_cap",
            "dose.stretch",
            "static_hold_exceeds_rule",
            t.id,
            n,
          );
        if (
          e.mobility_type === "static" &&
          (i.target.durationSeconds < range[0] ||
            i.sets < r.get("dose.stretch").reps_per_muscle[0] ||
            i.sets > r.get("dose.stretch").reps_per_muscle[1])
        )
          issue(
            "stretch_dose_bounds",
            "dose.stretch",
            "verified_static_stretch_outside_source_dose_range",
            t.id,
            n,
          );
      }
      if ("reps" in i.target) {
        const bounds = r.get("dose.reps.bounds");
        if (
          i.target.reps > bounds.absolute_max ||
          i.target.reps < bounds.min[p.level]
        )
          issue(
            "reps_bounds",
            "dose.reps.bounds",
            "reps_outside_level_bounds",
            t.id,
            n,
          );
      }
      const week = newWeek(p, r);
      if (week && e.difficulty > week.difficulty_max)
        issue(
          "new_user_difficulty",
          "progression.new.week_caps",
          "difficulty_above_intro_cap",
          t.id,
          n,
        );
      if (
        week &&
        !["warmup", "cooldown", "conditioning", "balance"].includes(
          i.prescription?.block ?? "",
        ) &&
        i.sets >
          (Array.isArray(week.sets_per_exercise)
            ? week.sets_per_exercise[1]
            : week.sets_per_exercise)
      )
        issue(
          "new_user_set_cap",
          "progression.new.week_caps",
          "sets_above_intro_cap",
          t.id,
          n,
        );
      if (i.prescription && i.prescription.rir[0] < s.rirMin)
        issue(
          "intensity_cap",
          "meta.conflict.precedence",
          "rir_below_safety_bound",
          t.id,
          n,
        );
      if (i.prescription?.roundRestSeconds !== undefined) {
        const group = t.items.filter(
            (member) =>
              member.prescription?.groupId === i.prescription?.groupId,
          ),
          v = r.get("duration.rest.block").superset,
          rest = i.prescription.roundRestSeconds;
        if (
          i.prescription.structure !== "superset" ||
          !i.prescription.groupId ||
          group.length < 2 ||
          group.some((member) => member.prescription?.structure !== "superset")
        )
          issue(
            "round_rest_structure",
            "duration.rest.block",
            "explicit_round_rest_requires_actual_superset",
            t.id,
            n,
          );
        else if (
          !Number.isInteger(rest) ||
          rest < v.after_round_range_s[0] ||
          rest > v.after_round_range_s[1]
        )
          issue(
            "round_rest_bounds",
            "duration.rest.block",
            "explicit_round_rest_outside_source_range",
            t.id,
            n,
          );
        else if (
          group.some((member) => member.prescription?.roundRestSeconds !== rest)
        )
          issue(
            "round_rest_mismatch",
            "duration.rest.block",
            "superset_members_have_inconsistent_round_rest",
            t.id,
            n,
          );
      }
      if (i.prescription?.structure === "superset" && i.prescription.groupId) {
        const member = t.items.find(
          (x) => x !== i && x.prescription?.groupId === i.prescription!.groupId,
        );
        if (member && !pairAllowed(i, member, p, r))
          issue(
            "invalid_pair",
            "session.superset.pairing",
            "competing_superset",
            t.id,
            n,
          );
      }
    }
    const staticSets: Record<string, number> = {};
    for (const item of t.items) {
      const e = r.byExercise.get(item.exerciseId);
      if (e?.mobility_type === "static")
        for (const group of e.stretch_targets ?? [])
          staticSets[group] = (staticSets[group] ?? 0) + item.sets;
    }
    for (const [group, sets] of Object.entries(staticSets))
      if (sets > r.get("dose.stretch").reps_per_muscle[1])
        issue(
          "stretch_group_set_cap",
          "dose.stretch",
          `${group}:${sets}>${r.get("dose.stretch").reps_per_muscle[1]}`,
          t.id,
        );
    const strength = t.items.some((i) =>
      ["main", "accessory"].includes(i.prescription?.block ?? ""),
    );
    const intro = newWeek(p, r);
    if (
      intro?.exercises_per_session &&
      t.items.filter((i) =>
        ["main", "accessory"].includes(i.prescription?.block ?? ""),
      ).length > intro.exercises_per_session[1]
    )
      issue(
        "new_user_exercise_cap",
        "progression.new.week_caps",
        "working_exercises_above_intro_cap",
        t.id,
      );
    if (
      !postPhase1 &&
      strength &&
      patterns(t.items, r).size < (p.sessionMinutes <= 10 ? 2 : 3)
    )
      issue(
        "pattern_count",
        "week.coverage.patterns",
        "too_few_actual_patterns",
        t.id,
      );
    const totals = volume(t.items, r);
    const cap = r.get("dose.sets_session.cap").per_muscle_fractional_sets_max[
      p.level
    ];
    for (const [muscle, total] of Object.entries(totals))
      if (total > cap)
        issue(
          "session_volume_cap",
          "dose.sets_session.cap",
          `${muscle}:${total}>${cap}`,
          t.id,
        );
    if (!postPhase1) {
      const seconds = estimatedSeconds(t as Template, r);
      const tolerance = r.get("duration.fit.tolerance").band;
      const target = minutes * 60;
      if (seconds < target * tolerance[0] || seconds > target * tolerance[1])
        issue(
          "duration_tolerance",
          "duration.fit.tolerance",
          "estimated_duration_outside_tolerance",
          t.id,
        );
      const precise = (t as Template).estimatedSeconds;
      if (
        (precise !== undefined &&
          Math.abs(precise - seconds) > Number.EPSILON) ||
        t.estimatedMinutes !== Math.ceil(seconds / 60)
      )
        issue(
          "duration_metadata",
          "duration.session.total",
          "estimated_minutes_disagree_with_model",
          t.id,
        );
    }
  }
  if (!postPhase1) {
    const goal = r.get(`goal.params.${p.goal}`);
    if (
      s.population === "general" &&
      !newWeek(p, r) &&
      rt.length < goal.rt_sessions_week.min
    )
      issue(
        "goal_frequency_min",
        `goal.params.${p.goal}`,
        `rt_days:${rt.length}<${goal.rt_sessions_week.min}`,
      );
    if (
      p.goal === "start_moving" &&
      plan.templates.some((t) => t.targetMinutes !== undefined)
    ) {
      const moderate = r.get("aerobic.intensity.rpe_scale").moderate[0],
        actual = plan.templates
          .flatMap((t) => t.items)
          .reduce((sum, i) => {
            const e = r.byExercise.get(i.exerciseId);
            return (
              sum +
              (e?.modality === "cardio" &&
              (i.prescription?.targetRpe?.[0] ?? 0) >= moderate &&
              "durationSeconds" in i.target
                ? i.sets *
                  i.target.durationSeconds *
                  (i.prescription?.perSide || e.time.per_side
                    ? r.get("session.time.model").per_side_multiplier
                    : 1)
                : 0)
            );
          }, 0),
        minimum =
          Math.max(
            goal.aerobic_moderate_equiv_min_week.week1[0],
            r.get("aerobic.progression.ramp").week1_floor_min,
          ) * 60;
      if (actual < minimum)
        issue(
          "start_moving_aerobic_floor",
          "goal.params.start_moving",
          `new_planned_moderate_seconds:${actual}<${minimum}`,
        );
    }
    const elapsed = weeklyElapsedAllocation(plan.templates, r),
      shares = goal.time_share as Partial<
        Record<"resistance" | "aerobic" | "mobility", [number, number]>
      >;
    let requiredUnallocated = 0;
    for (const category of ["resistance", "aerobic", "mobility"] as const) {
      const range = shares[category];
      if (!range || !elapsed.total) continue;
      const lower = elapsed[category] / elapsed.total,
        upper = (elapsed[category] + elapsed.unallocated) / elapsed.total;
      requiredUnallocated += Math.max(
        0,
        range[0] * elapsed.total - elapsed[category],
      );
      const details = `${category}:elapsed_seconds:${elapsed[category]};weekly_total_seconds:${elapsed.total};unallocated_seconds:${elapsed.unallocated};share_bounds:${lower},${upper};required:${range[0]},${range[1]}`;
      if (
        upper + Number.EPSILON < range[0] ||
        lower - Number.EPSILON > range[1]
      )
        issue("goal_time_share", `goal.params.${p.goal}`, details);
      else if (
        lower + Number.EPSILON < range[0] ||
        upper - Number.EPSILON > range[1]
      )
        issue(
          "goal_time_share_ambiguous",
          `goal.params.${p.goal}`,
          details,
          undefined,
          undefined,
          "warning",
        );
    }
    if (
      requiredUnallocated >
      elapsed.unallocated + Number.EPSILON * Math.max(1, elapsed.total)
    )
      issue(
        "goal_time_share_joint",
        `goal.params.${p.goal}`,
        `minimum_share_deficit_seconds:${requiredUnallocated}>unallocated_seconds:${elapsed.unallocated};weekly_total_seconds:${elapsed.total}`,
      );
    const limits = volumeLimits(p, r),
      weekly = weeklyVolume(plan, r);
    for (const group of r.get("dose.muscle_groups").target_groups) {
      const n = weekly[group] ?? 0;
      if (n < limits.min)
        issue(
          "weekly_volume_floor",
          "dose.sets_week.goal_matrix",
          `${group}:${n}<${limits.min}`,
        );
      if (n > limits.max)
        issue(
          "weekly_volume_cap",
          "dose.sets_week.goal_matrix",
          `${group}:${n}>${limits.max}`,
        );
    }
    const floor = r.get("goal.floor.all");
    if (p.daysPerWeek >= floor.applies_when.days_available_min)
      for (const group of r.get("dose.muscle_groups").target_groups) {
        const days = rt.filter((t) =>
          t.items.some(
            (i) =>
              ["main", "accessory"].includes(i.prescription?.block ?? "") &&
              (credit(i, r)[group] ?? 0) > 0,
          ),
        ).length;
        if (days < floor.all_major_muscles_per_week_min)
          issue(
            "weekly_muscle_exposure_gap",
            "goal.floor.all",
            `${group}:${days}<${floor.all_major_muscles_per_week_min}`,
          );
      }
    for (const group of r.get("dose.muscle_groups").cap_only_groups)
      if ((weekly[group] ?? 0) > limits.max)
        issue(
          "weekly_volume_cap",
          "dose.sets_week.goal_matrix",
          `${group}:${weekly[group]}>${limits.max}`,
        );
    if (rt.length >= r.get("week.coverage.patterns").applies_when.rt_days_min) {
      const coverage = r.get("week.coverage.patterns").weekly_min_exposures;
      for (const pattern of coverage.each_once)
        if (!allPatterns.has(pattern))
          issue("weekly_pattern_gap", "week.coverage.patterns", pattern);
      for (const key of ["knee_dominant", "hip_dominant", "push", "pull"]) {
        const entry = coverage[key];
        const count = rt.filter((t) =>
          [...patterns(t.items, r)].some((pattern) =>
            entry.patterns.includes(pattern),
          ),
        ).length;
        if (count < entry.min)
          issue("weekly_exposure_gap", "week.coverage.patterns", key);
      }
    }
    const core = r.get("balance.week.core_three");
    const coreRule = rt.length >= 3 ? core.rt_days_min_3 : core.rt_days_1_2;
    for (const pattern of coreRule.required_each ?? coreRule.required ?? [])
      if (!allPatterns.has(pattern))
        issue("core_gap", "balance.week.core_three", pattern);
    if (
      coreRule.required_one_of &&
      !coreRule.required_one_of.some((pattern: Pattern) =>
        allPatterns.has(pattern),
      )
    )
      issue(
        "core_gap",
        "balance.week.core_three",
        "anti_rotation_or_anti_lateral_flexion",
      );
    if (
      rt.length >=
        r.get("balance.week.carry_ground").applies_when.rt_days_min &&
      !r
        .get("balance.week.carry_ground")
        .patterns.some((pattern: Pattern) => allPatterns.has(pattern))
    )
      issue(
        "carry_ground_gap",
        "balance.week.carry_ground",
        "no_actual_carry_or_ground_locomotion",
      );
    const direct = (ps: string[]) =>
      rt
        .flatMap((t) => t.items)
        .reduce(
          (n, i) =>
            n +
            (ps.includes(r.byExercise.get(i.exerciseId)?.primary_pattern ?? "")
              ? i.sets
              : 0),
          0,
        );
    const pullPush = r.get("balance.week.pull_push"),
      pull = direct(pullPush.pull_patterns),
      push = direct(pullPush.push_patterns);
    const pullPossible = r.data.exercises.some(
      (e) =>
        pullPush.pull_patterns.includes(e.primary_pattern) &&
        hardEligible(e, ctx),
    );
    if (
      pullPossible &&
      push &&
      (pull / push < pullPush.min || pull / push > pullPush.max)
    )
      issue(
        "pull_push_balance",
        "balance.week.pull_push",
        "pull_push_ratio_outside_range",
        undefined,
        undefined,
        "warning",
      );
    const knee = direct(["squat", "lunge"]),
      hinge = direct(["hinge"]),
      ratio = r.get("balance.week.hinge_knee");
    if (knee && (hinge / knee < ratio.min || hinge / knee > ratio.max))
      issue(
        "hinge_knee_balance",
        "balance.week.hinge_knee",
        "hinge_knee_ratio_outside_range",
        undefined,
        undefined,
        "warning",
      );
  }
  if (s.population === "older_adult") {
    const warm = r.get("session.warmup.balance_older"),
      side = r.get("session.time.model").per_side_multiplier;
    const days = plan.templates.filter((t) =>
      t.items.some((item) => {
        const e = r.byExercise.get(item.exerciseId),
          block = item.prescription?.block;
        if (e?.primary_pattern !== "balance") return false;
        if (block !== "warmup") return block !== "cooldown";
        if (
          !warm.counts_toward_balance_days ||
          warm.add_slot.block !== "warmup" ||
          !warm.add_slot.pattern.includes(e.primary_pattern) ||
          !warm.add_slot.use.some((use: string) => e.use.includes(use)) ||
          Math.min(p.sessionMinutes, t.targetMinutes ?? p.sessionMinutes) <
            warm.min_session_minutes ||
          !hardEligible(e, ctx) ||
          !("durationSeconds" in item.target)
        )
          return false;
        const actual =
          item.sets *
          item.target.durationSeconds *
          (item.prescription?.perSide || e.time.per_side ? side : 1);
        return (
          actual >= warm.add_slot.seconds[0] &&
          actual <= warm.add_slot.seconds[1]
        );
      }),
    ).length;
    if (
      days <
      r.get("older.week.multicomponent").balance_functional_days_per_week.min
    )
      issue(
        "balance_days",
        "older.template.balance_required",
        "fewer_than_required_balance_days",
      );
  }
  for (const notice of plan.notices) {
    const copies = Object.values(r.data.copy).filter(
      (c) => c.sourceRuleId === notice.ruleId,
    );
    if (
      !copies.some((c) => {
        const match = (source: string, text: string) => {
          const parts = source.split(/\{[^}]+\}/);
          return parts.every((part) => text.includes(part));
        };
        return match(c.zh, notice.message.zh) && match(c.en, notice.message.en);
      })
    )
      issue(
        "unapproved_copy",
        notice.ruleId,
        "notice_does_not_match_compiled_copy",
      );
  }
  if (stableString(plan).includes("NaN"))
    issue("non_finite", "meta.manual.version", "non_finite_output");
  const shareCodes = ["goal_time_share", "goal_time_share_joint"];
  const shortHealthDefault =
    !strictDefaultShares &&
    p.goal === "health" &&
    p.daysPerWeek === 2 &&
    p.sessionMinutes === 20 &&
    plan.weeklyTarget === 2 &&
    plan.sessionMinutes === 20 &&
    plan.templates.length === 2 &&
    r.byId.get("goal.params.health")?.type === "default";
  if (
    shortHealthDefault &&
    !issues.some((i) => i.severity === "error" && !shareCodes.includes(i.code))
  )
    return issues.map((i) =>
      shareCodes.includes(i.code) ? { ...i, severity: "warning" as const } : i,
    );
  return issues;
}
