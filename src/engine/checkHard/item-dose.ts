import {
  pregnancyBalanceSupport,
  pregnancyStandingCap,
} from "../pregnancy-limits";
import { powerLoadIssue } from "../power";

import { stretchHoldRange } from "../data";

import type { ItemCheckContext } from "./item-context";
export function checkItemDose({
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
  const support = pregnancyBalanceSupport(e, p, r);
  if (
    support.required &&
    (!support.available.includes(item.equipment) ||
      pres?.safetyCue?.zh !== support.copy?.zh ||
      pres?.safetyCue?.en !== support.copy?.en)
  )
    add(
      "pregnancy_balance_support",
      "pregnancy.exclude.fall_risk",
      "required physical support or cue missing",
      t.id,
      index,
    );
  const standingCap = pregnancyStandingCap(e, p, r);
  if (
    standingCap !== undefined &&
    "durationSeconds" in item.target &&
    item.target.durationSeconds *
      (pres?.perSide || e.time.per_side
        ? r.get("session.time.model").per_side_multiplier
        : 1) >
      standingCap
  )
    add(
      "pregnancy_static_standing",
      "pregnancy.intensity",
      "static standing hold exceeds pregnancy per-set cap",
      t.id,
      index,
    );
  if (e.modality === "isometric" && work) {
    const source = r.get("dose.isometric"),
      range = source[p.level].hold_s;
    if (
      item.target.metricType !== "duration" ||
      !Number.isFinite(item.target.durationSeconds) ||
      item.target.durationSeconds < range[0] ||
      item.target.durationSeconds > Math.min(range[1], source.hold_s_max)
    )
      add(
        "isometric_hold_bounds",
        "dose.isometric",
        "working hold outside source duration range",
        t.id,
        index,
      );
  }
  if (e.mobility_type === "static") {
    const source = r.get("dose.stretch"),
      range = stretchHoldRange(e, r, g.restrictions.population);
    if (
      item.target.metricType !== "duration" ||
      !Number.isFinite(item.target.durationSeconds) ||
      !range ||
      item.target.durationSeconds < range[0] ||
      item.target.durationSeconds > range[1] ||
      item.sets > source.reps_per_muscle[1]
    )
      add(
        "stretch_dose_bounds",
        "dose.stretch",
        "selected static stretch outside source execution bounds",
        t.id,
        index,
      );
    if (
      range &&
      "durationSeconds" in item.target &&
      item.target.durationSeconds > range[1]
    )
      add(
        "stretch_hold_cap",
        "dose.stretch",
        "static hold exceeds population source cap",
        t.id,
        index,
      );
    if (
      e.stretch_hold_s &&
      "durationSeconds" in item.target &&
      (item.target.durationSeconds < e.stretch_hold_s[0] ||
        item.target.durationSeconds > e.stretch_hold_s[1])
    )
      add(
        "stretch_source_hold_bounds",
        "dose.stretch",
        "selected hold outside verified action source range",
        t.id,
        index,
      );
  }
  if (
    "durationSeconds" in item.target &&
    (!Number.isFinite(item.target.durationSeconds) ||
      item.target.durationSeconds <= 0)
  )
    add(
      "invalid_duration",
      "duration.fit.bounds",
      "duration must be positive",
      t.id,
      index,
    );
  if (
    pres?.targetRpe &&
    g.restrictions.user.hypertension !== "controlled" &&
    pres.targetRpe[1] > r.get("safety.hypertension.limits").max_rpe_0_10
  )
    add(
      "hypertension_rpe",
      "safety.hypertension.limits",
      "RPE above blood-pressure limit",
      t.id,
      index,
    );
  if (
    pres &&
    g.restrictions.user.clearance_state === "required" &&
    ((pres.targetRpe &&
      pres.targetRpe[1] >
        r.get("safety.clearance.restricted_mode").max_rpe_0_10) ||
      pres.rir[0] === 0)
  )
    add(
      "clearance_effort",
      "safety.clearance.restricted_mode",
      "effort exceeds restricted-clearance limit",
      t.id,
      index,
    );
  if (
    pres &&
    (pres.rir[0] < g.restrictions.rirMin ||
      pres.rir[1] < pres.rir[0] ||
      (pres.targetRpe && pres.targetRpe[1] > g.restrictions.maxIntensity))
  )
    add(
      "intensity_cap",
      g.reasons.find((x) => x.status === "restricted")?.ruleId ??
        "safety.unlock.vigorous",
      "prescription exceeds gate intensity",
      t.id,
      index,
    );
  if (
    e.modality === "power" ||
    r.get("dose.power").patterns.includes(e.primary_pattern)
  ) {
    const v = r.get("dose.power");
    const loadIssue = powerLoadIssue(e, item, p, r);
    if (loadIssue)
      add(
        loadIssue,
        "dose.power",
        "power load branch fails source requirements",
        t.id,
        index,
      );
    if (
      p.level === v.beginner ||
      (p.level === "beginner" && v.beginner === "excluded") ||
      !("reps" in item.target) ||
      item.sets < v.sets[0] ||
      item.sets > v.sets[1] ||
      ("reps" in item.target &&
        (item.target.reps < v.reps[0] ||
          item.target.reps > v.reps[1] ||
          item.target.reps * item.sets > v.total_reps_per_exercise_max))
    )
      add(
        "power_dose",
        "dose.power",
        "power dose or beginner eligibility fails source limits",
        t.id,
        index,
      );
    const rest = r.get("dose.rest.table")[v.rest_ref.split(".").at(-1)].bounds;
    if (
      !pres ||
      pres.rir[0] < v.rir[0] ||
      pres.rir[1] > v.rir[1] ||
      pres.restSeconds < rest[0] ||
      pres.restSeconds > rest[1]
    )
      add(
        "power_effort_rest",
        "dose.power",
        "power RIR or rest outside source limits",
        t.id,
        index,
      );
  }
  if (
    g.restrictions.population === "older_adult" &&
    work &&
    (item.sets > r.get("older.strength.dose").sets_per_exercise.max ||
      (pres && pres.rir[0] < r.get("older.strength.dose").rir_min))
  )
    add(
      "older_dose",
      "older.strength.dose",
      "older-adult dose exceeds source limits",
      t.id,
      index,
    );
  if (
    g.restrictions.population === "older_adult" &&
    work &&
    "reps" in item.target
  ) {
    const dose = r.get("older.strength.dose"),
      range =
        p.trainingAgeWeeks <
        r.get("older.strength.progression").intro_phase_weeks.default
          ? dose.reps_phase_intro
          : dose.reps_phase_strength;
    if (item.target.reps < range.min || item.target.reps > range.max)
      add(
        "older_reps",
        "older.strength.dose",
        "reps outside source phase range",
        t.id,
        index,
      );
  }
  if (
    g.restrictions.population === "pregnant" &&
    pres?.targetRpe &&
    pres.targetRpe[1] > r.get("pregnancy.intensity").rpe_0_10.max
  )
    add(
      "pregnancy_rpe",
      "pregnancy.intensity",
      "pregnancy RPE exceeds source cap",
      t.id,
      index,
    );
  if (
    g.restrictions.population === "postpartum" &&
    g.restrictions.phase === 2 &&
    work &&
    pres &&
    pres.rir[0] < r.get("postpartum.phase2").strength_limits.rir_min
  )
    add(
      "postpartum_phase2_effort",
      "postpartum.phase2",
      "phase two strength RIR below source minimum",
      t.id,
      index,
    );
  if (
    g.restrictions.population === "pregnant" &&
    work &&
    pres &&
    pres.rir[0] < r.get("pregnancy.intensity").strength_rir_min
  )
    add(
      "pregnancy_intensity",
      "pregnancy.intensity",
      "pregnancy strength RIR below minimum",
      t.id,
      index,
    );
}
