import { ownedEquipment } from "../equipment";
import { sourceFallbackRestriction } from "../candidates";

import type { EngineProfile, GateOutcome } from "../contracts";

import { Rules, condition, balanceStageEligible, type Exercise } from "../data";

import { newWeek } from "../dose";
/** Pure eligibility inspection, also used to verify the complete environment-limited pool. */
export function exclusions(
  e: Exercise,
  p: EngineProfile,
  g: GateOutcome,
  r: Rules,
): string[] {
  const ids: string[] = [],
    s = g.restrictions,
    user = {
      ...s.user,
      exercise: {
        supported_variant_available: e.supported_variant_available === true,
      },
    },
    owned = ownedEquipment(p);
  const fallback = sourceFallbackRestriction(e, p, s, r);
  if (fallback) ids.push(fallback);
  if (
    !e.equipment_required.every(
      (req) =>
        owned.has(req) ||
        (e.equipment_alternatives[req] ?? []).some((alt) => owned.has(alt)),
    )
  )
    ids.push("select.pipeline");
  if (
    p.preferences.excludedExerciseIds.includes(e.id) ||
    e.excluded_cautions?.some((c) =>
      p.cautions.includes(c as EngineProfile["cautions"][number]),
    )
  )
    ids.push("select.pipeline");
  if (
    ["mat", "small", "medium", "large"].indexOf(e.space) >
      ["mat", "small", "medium", "large"].indexOf(p.constraints.space) ||
    (p.constraints.quiet && e.noise > 0)
  )
    ids.push("select.pipeline");
  const cannot = p.preferences.cannotDo;
  if (
    ((p.constraints.noJump || cannot.includes("jumping")) &&
      (e.flags.includes("jumping") ||
        e.modality === "plyometric" ||
        e.primary_pattern === "jump_land")) ||
    (cannot.includes("walking_carry") && e.primary_pattern === "carry") ||
    (cannot.includes("floor_work") &&
      (e.requires_floor_transition ??
        (condition(r.get("older.floor.transitions").floor_based_if, e, {}) ||
          e.position.includes("quadruped") ||
          (e.position.includes("plank") &&
            !e.position.some((x) => ["standing", "seated"].includes(x)))))) ||
    (cannot.includes("overhead") && e.flags.includes("overhead_load")) ||
    (cannot.includes("kneeling") &&
      e.position.some((x) => ["kneeling", "quadruped"].includes(x)))
  )
    ids.push("select.pipeline");
  if (e.stretch_hold_s) {
    const bounds = r.get("dose.stretch").hold_s,
      global =
        s.population === "older_adult" ? bounds.older_adult : bounds.range;
    if (
      Math.max(global[0], e.stretch_hold_s[0]) >
      Math.min(global[1], e.stretch_hold_s[1])
    )
      ids.push("select.pipeline");
  }
  if (
    p.painState?.some(
      (x) => x.remainingSessions > 0 && x.pattern === e.primary_pattern,
    )
  )
    ids.push("select.pipeline");
  if (
    e.difficulty >= 5 ||
    e.use.includes("skill") ||
    e.flags.some((x) => r.get("ladder.gate.barbell").gated_flags.includes(x))
  )
    ids.push("ladder.gate.barbell");
  const intro = newWeek(p, r);
  if (intro && e.difficulty > intro.difficulty_max)
    ids.push("progression.new.week_caps");
  if (intro) {
    const v = r.get("progression.new.exclusions");
    if (
      v.exclude_modality.includes(e.modality) ||
      v.exclude_flags.some((f: string) => e.flags.includes(f)) ||
      v.exclude_use.some((u: string) => e.use.includes(u))
    )
      ids.push("progression.new.exclusions");
  }
  for (const joint of new Set([
    ...p.cautions,
    ...(s.user.redflag_cautions ?? []),
  ])) {
    if (joint === "other") continue;
    const level = Math.max(
        p.cautionLevels?.[joint as "knee" | "back" | "shoulder" | "wrist"] ?? 1,
        s.user.redflag_caution_level ?? 1,
        p.painState?.some(
          (x) => (x.score ?? 0) > 5 || (x.cautionLevelDelta ?? 0) > 0,
        )
          ? 2
          : 1,
      ),
      id = `caution.${joint}.filter`;
    if (condition(r.get(id)[`level_${level}`]?.exclude_if, e, user))
      ids.push(id);
  }
  const apply = (id: string, field = "exclude_if") => {
    const v = r.get(id);
    if ((!v.when || condition(v.when, e, user)) && condition(v[field], e, user))
      ids.push(id);
  };
  if (s.user.clearance_state === "required") {
    const v = r.get("safety.clearance.restricted_mode");
    if (
      v.exclude_modality.includes(e.modality) ||
      v.exclude_flags.some((f: string) => e.flags.includes(f))
    )
      ids.push("safety.clearance.restricted_mode");
  }
  if (
    s.user.hypertension !== "controlled" &&
    r
      .get("safety.hypertension.limits")
      .exclude_flags.some((f: string) => e.flags.includes(f))
  )
    ids.push("safety.hypertension.limits");
  if (
    (s.population === "older_adult" ||
      p.olderSafety?.balanceStage !== undefined) &&
    !balanceStageEligible(
      e,
      s.user.balance_stage ??
        r.get("older.balance.progression").stages[0].stage,
      r,
    )
  )
    ids.push("older.balance.progression");
  if (s.population === "older_adult") {
    apply("older.exclude.base");
    if (
      condition(
        r.get("older.exclude.base").default_low_impact.exclude_if,
        e,
        user,
      )
    )
      ids.push("older.exclude.base");
    if (s.user.balance_cautious) apply("older.exclude.balance_cautious");
    if (
      (s.user.balance_cautious || s.user.walking_aid) &&
      (e.requires_floor_transition ||
        condition(r.get("older.floor.transitions").floor_based_if, e, user))
    )
      ids.push("older.floor.transitions");
    if (
      p.population.kind === "older_adult" &&
      p.population.boneFlag &&
      condition(r.get("older.bone").until_clearance_exclude_if, e, user)
    )
      ids.push("older.bone");
    apply("older.hypertension");
  }
  if (s.population === "pregnant")
    for (const id of [
      "pregnancy.exclude.supine",
      "pregnancy.exclude.prone",
      "pregnancy.exclude.impact",
      "pregnancy.exclude.fall_risk",
      "pregnancy.exclude.valsalva",
      "pregnancy.exclude.abdominal_flexion",
    ])
      apply(id);
  if (s.population === "postpartum" && p.population.kind === "postpartum") {
    apply("postpartum.doming");
    const regression = r.get("postpartum.symptom_regression");
    if (
      condition(regression.when, e, user) &&
      regression.action.some(
        (a: unknown) =>
          typeof a === "object" &&
          a !== null &&
          condition((a as { exclude_if: unknown }).exclude_if, e, user),
      )
    )
      ids.push("postpartum.symptom_regression");
    const pop = p.population;
    if (s.phase === 1) {
      const id =
        pop.delivery === "cesarean" && !pop.cleared
          ? "postpartum.gate.caesarean"
          : "postpartum.phase1";
      if (!condition(r.get(id).allow_only_if, e, user)) ids.push(id);
    }
    if (s.phase < 3) apply("postpartum.exclude.pre_phase3");
    if (
      s.phase === 2 &&
      e.modality !== "mobility" &&
      e.difficulty > r.get("postpartum.phase2").strength_limits.difficulty_max
    )
      ids.push("postpartum.phase2");
    if (
      !pop.readinessChecklistPassed &&
      (e.flags.some((f) => ["running", "jumping"].includes(f)) ||
        e.impact >= 2 ||
        e.modality === "plyometric")
    )
      ids.push("postpartum.running.readiness");
  }
  if (
    e.flags.some((f) => s.excludeFlags.includes(f)) ||
    e.position.some((pos) => s.excludePositions.includes(pos))
  )
    ids.push(
      ...g.reasons
        .filter((x) => x.status === "restricted")
        .map((x) => x.ruleId),
    );
  return [...new Set(ids)];
}
