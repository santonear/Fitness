import { minimumReps, straightRestFloor, effectiveGoalRole } from "../dose";
import { exclusions } from "../checkHard/eligibility";
import type { ItemCheckContext } from "./item-context";
export function checkItemStructure({
  e,
  p,
  g,
  r,
  t,
  item,
  index,
  pres,
  work,
  sourceRamp,
  ramps,
  seen,
  ladders,
  intro,
  add,
}: ItemCheckContext) {
  if (
    (pres?.warmupSeconds ?? 0) > 0 &&
    pres?.warmupSeconds !== ramps.get(index)
  )
    add(
      "unverified_ramp_time",
      "duration.fit.bounds",
      "declared warmup time has no matching actual source ramp",
      t.id,
      index,
    );
  if (
    g.restrictions.population === "pregnant" &&
    r
      .get("pregnancy.environment")
      .content_blacklist.some(
        (slug: string) => e.slug.replaceAll("-", "_") === slug,
      )
  )
    add(
      "pregnancy_environment",
      "pregnancy.environment",
      "source-blacklisted activity is unavailable during pregnancy",
      t.id,
      index,
    );
  if (
    (pres?.trainingStyle === "hiit" ||
      e.modality === "hiit" ||
      e.flags.includes("hiit")) &&
    !g.restrictions.user.hiit_unlocked
  )
    add(
      "hiit_locked",
      "hiit.gate.unlock",
      "HIIT requires all current source evidence; pregnancy remains locked",
      t.id,
      index,
    );
  if (pres?.roundRestSeconds !== undefined) {
    const members = pres.groupId
        ? t.items.filter(
            (member) => member.prescription?.groupId === pres.groupId,
          )
        : [],
      range = r.get("duration.rest.block").superset.after_round_range_s;
    if (
      pres.structure !== "superset" ||
      members.length < 2 ||
      members.some(
        (member) =>
          member.prescription?.structure !== "superset" ||
          ["warmup", "cooldown", "mobility"].includes(
            member.prescription.block,
          ),
      )
    )
      add(
        "round_rest_structure",
        "duration.rest.block",
        "explicit round rest requires a real working superset",
        t.id,
        index,
      );
    if (
      !Number.isInteger(pres.roundRestSeconds) ||
      pres.roundRestSeconds < range[0] ||
      pres.roundRestSeconds > range[1]
    )
      add(
        "round_rest_bounds",
        "duration.rest.block",
        "round rest outside authored superset bounds",
        t.id,
        index,
      );
    if (
      members.some(
        (member) =>
          member.prescription?.roundRestSeconds !== pres.roundRestSeconds,
      )
    )
      add(
        "round_rest_mismatch",
        "duration.rest.block",
        "superset members require consistent explicit round rest",
        t.id,
        index,
      );
  }
  for (const id of exclusions(e, p, g, r))
    add(
      "excluded_exercise",
      id,
      "exercise fails source eligibility",
      t.id,
      index,
    );
  if (
    (!sourceRamp &&
      (seen.has(e.id) || (e.ladder.id && ladders.has(e.ladder.id)))) ||
    pres?.excludedPreviousIds?.includes(e.id)
  )
    add(
      "duplicate_exercise",
      "variety.no_repeat",
      "duplicate identity, ladder or excluded previous exercise",
      t.id,
      index,
    );
  if (!sourceRamp) {
    seen.add(e.id);
    if (e.ladder.id) ladders.add(e.ladder.id);
  }
  if (!Number.isInteger(item.sets) || item.sets <= 0)
    add(
      "invalid_sets",
      "dose.sets_session.cap",
      "sets must be positive integers",
      t.id,
      index,
    );
  if (
    item.target.metricType === "reps_load" &&
    (!Number.isFinite(item.target.loadGrams) || item.target.loadGrams <= 0)
  )
    add(
      "missing_load",
      "dose.load.initial_selection",
      "positive weight or registered relative band required",
      t.id,
      index,
    );
  if (
    work &&
    e.modality === "strength" &&
    item.sets > 1 &&
    !(
      pres?.structure !== "straight" &&
      pres?.groupId &&
      t.items.filter(
        (member) =>
          member.prescription?.groupId === pres.groupId &&
          member.prescription?.structure === pres.structure &&
          ["main", "accessory"].includes(member.prescription?.block ?? ""),
      ).length > 1
    ) &&
    (!Number.isFinite(pres?.restSeconds) ||
      (pres?.restSeconds ?? -Infinity) <
        straightRestFloor(e, p, r, effectiveGoalRole(item, p, r)))
  )
    add(
      "rest_floor",
      "duration.fit.bounds",
      "working rest is below the source safety floor",
      t.id,
      index,
    );
  if (
    work &&
    item.sets > r.get("duration.fit.bounds").sets_per_exercise_max[p.level]
  )
    add(
      "exercise_set_cap",
      "duration.fit.bounds",
      "sets exceed per-exercise cap",
      t.id,
      index,
    );
  if (
    intro &&
    work &&
    (item.sets >
      (Array.isArray(intro.sets_per_exercise)
        ? intro.sets_per_exercise[1]
        : intro.sets_per_exercise) ||
      (pres && pres.rir[0] < (intro.rir_min ?? intro.rir?.[0])))
  )
    add(
      "intro_dose",
      "progression.new.week_caps",
      "introductory set or effort cap exceeded",
      t.id,
      index,
    );
  if (
    intro &&
    work &&
    pres?.tempo &&
    pres.tempo.eccentricSeconds >
      r.get("progression.new.week_caps").eccentric_s_max
  )
    add(
      "intro_tempo",
      "progression.new.week_caps",
      "eccentric cadence exceeds introductory cap",
      t.id,
      index,
    );
  if (
    p.goal === "strength" &&
    work &&
    effectiveGoalRole(item, p, r) === "main" &&
    item.sets >
      r.get("dose.sets_session.cap").strength_main_lift_direct_sets_max
  )
    add(
      "strength_main_sets",
      "dose.sets_session.cap",
      "main strength exercise exceeds direct set cap",
      t.id,
      index,
    );
  if ("reps" in item.target) {
    const bounds = r.get("dose.reps.bounds");
    if (
      !Number.isInteger(item.target.reps) ||
      item.target.reps <= 0 ||
      (!sourceRamp && item.target.reps < minimumReps(p, r)) ||
      item.target.reps > bounds.absolute_max
    )
      add(
        "reps_bounds",
        "dose.reps.bounds",
        "repetitions outside bounds",
        t.id,
        index,
      );
    if (
      p.goal === "strength" &&
      p.level === "beginner" &&
      p.trainingAgeWeeks <
        r.get("goal.strength.beginner_rep_gate")
          .weeks_trained_before_low_reps &&
      work &&
      effectiveGoalRole(item, p, r) === "main" &&
      item.target.reps <
        r.get("goal.strength.beginner_rep_gate").main_lift_reps_before_gate.min
    )
      add(
        "beginner_strength_reps",
        "goal.strength.beginner_rep_gate",
        "low-repetition strength not unlocked",
        t.id,
        index,
      );
    if (
      pres &&
      g.restrictions.user.hypertension !== "controlled" &&
      work &&
      item.target.reps < r.get("safety.hypertension.limits").min_reps_per_set
    )
      add(
        "hypertension_reps",
        "safety.hypertension.limits",
        "repetitions below blood-pressure minimum",
        t.id,
        index,
      );
  }
}
