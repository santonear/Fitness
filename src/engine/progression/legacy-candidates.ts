import { ownedEquipment } from "../equipment";
import type { Caution, EngineProfile, Pattern, RuleTrace } from "../contracts";
import {
  condition,
  hash,
  Rules,
  stretchHoldRange,
  type Exercise,
  type RuleValue,
} from "../data";
import type { SafetyState } from "../gates/strength-scoring";
const SPACE = ["mat", "small", "medium", "large"];

export interface SelectionContext {
  profile: EngineProfile;
  rules: Rules;
  safety: SafetyState;
  seed: string;
  trace: RuleTrace[];
  used: Set<string>;
  ladders: Set<string>;
  previous?: Set<string>;
  excluded?: Set<string>;
}

export function equipmentAvailable(e: Exercise, p: EngineProfile): boolean {
  const owned = ownedEquipment(p);
  return e.equipment_required.every(
    (required) =>
      owned.has(required) ||
      (e.equipment_alternatives?.[required] ?? []).some((alt) =>
        owned.has(alt),
      ),
  );
}

export function floorBased(e: Exercise, rules: Rules): boolean {
  return condition(rules.get("older.floor.transitions").floor_based_if, e, {});
}

export function hardEligible(e: Exercise, ctx: SelectionContext): boolean {
  if (ctx.excluded?.has(e.id)) return false;
  const cached = ctx.safety.eligibility.get(e.id);
  if (cached !== undefined) return cached;
  const result = computeEligibility(e, ctx);
  ctx.safety.eligibility.set(e.id, result);
  return result;
}

export function mobilityRegions(e: Exercise | undefined, r: Rules): string[] {
  if (!e || e.modality !== "mobility") return [];
  const regions = new Set<string>();
  if (e.mobility_type === "static")
    for (const group of e.stretch_targets ?? []) {
      if (["quads", "glutes", "hamstrings"].includes(group))
        regions.add("lower_body");
      if (["chest", "back", "shoulders"].includes(group))
        regions.add("upper_body");
    }
  if (
    e.mobility_type === "dynamic" &&
    (e.primaryMuscles ?? []).some((m) =>
      ["core", "lower_back"].includes(
        r.get("dose.muscle_groups").catalog_map[m],
      ),
    )
  )
    regions.add("trunk");
  return [...regions];
}

function computeEligibility(e: Exercise, ctx: SelectionContext): boolean {
  const { profile: p, rules: r, safety: s } = ctx;
  const pop = p.population;
  if (e.stretch_hold_s && !stretchHoldRange(e, r, s.population)) return false;
  if (
    p.preferences.excludedExerciseIds.includes(e.id) ||
    ctx.excluded?.has(e.id)
  )
    return false;
  if (
    (e as Exercise & { excluded_cautions?: string[] }).excluded_cautions?.some(
      (c) => p.cautions.includes(c as Caution),
    )
  )
    return false;
  if (
    !equipmentAvailable(e, p) ||
    SPACE.indexOf(e.space) > SPACE.indexOf(p.constraints.space)
  )
    return false;
  if (p.constraints.quiet && e.noise > 0) return false;
  if (
    (p.constraints.noJump || p.preferences.cannotDo.includes("jumping")) &&
    (e.flags.includes("jumping") ||
      e.modality === "plyometric" ||
      e.primary_pattern === "jump_land")
  )
    return false;
  const cannot = p.preferences.cannotDo;
  if (cannot.includes("walking_carry") && e.primary_pattern === "carry")
    return false;
  const floorTransition =
    e.requires_floor_transition ??
    (floorBased(e, r) ||
      e.position.includes("quadruped") ||
      (e.position.includes("plank") &&
        !e.position.some((p) => p === "standing" || p === "seated")));
  if (cannot.includes("floor_work") && floorTransition) return false;
  if (cannot.includes("overhead") && e.flags.includes("overhead_load"))
    return false;
  if (
    cannot.includes("kneeling") &&
    e.position.some((v) => v === "kneeling" || v === "quadruped")
  )
    return false;
  if (
    p.painState?.some(
      (x) => x.pattern === e.primary_pattern && x.remainingSessions > 0,
    )
  )
    return false;
  if (e.difficulty >= 5 || e.use.includes("skill")) return false;
  const week = Math.max(1, Math.floor(p.trainingAgeWeeks) + 1);
  if (p.level === "beginner" && week <= 4) {
    const cap = r.get("progression.new.week_caps");
    const v = week === 1 ? cap.week_1 : week === 2 ? cap.week_2 : cap.week_3_4;
    if (e.difficulty > v.difficulty_max) return false;
    const excluded = r.get("progression.new.exclusions");
    if (
      excluded.exclude_modality.includes(e.modality) ||
      excluded.exclude_flags.some((f: string) => e.flags.includes(f)) ||
      excluded.exclude_use.some((u: string) => e.use.includes(u))
    )
      return false;
  }
  if (s.user.clearance_state === "required") {
    const restricted = r.get("safety.clearance.restricted_mode");
    if (
      restricted.exclude_modality.includes(e.modality) ||
      restricted.exclude_flags.some((f: string) => e.flags.includes(f))
    )
      return false;
  }
  if (
    s.user.hypertension !== "controlled" &&
    r
      .get("safety.hypertension.limits")
      .exclude_flags.some((f: string) => e.flags.includes(f))
  )
    return false;
  for (const joint of new Set([
    ...p.cautions,
    ...(s.user.redflag_cautions ?? []),
  ])) {
    if (joint === "other") continue;
    const level = Math.max(
      s.user.redflag_caution_level ?? 1,
      p.painState?.some((x) => (x.score ?? 0) > 5) ? 2 : 1,
    );
    const v = r.get(`caution.${joint}.filter`)[`level_${level}`];
    if (condition(v.exclude_if, e, s.user)) return false;
  }
  const boundUser = {
    ...s.user,
    exercise: {
      supported_variant_available: e.supported_variant_available === true,
    },
  };
  const applyExclude = (id: string) => {
    const value = r.get(id);
    return (
      (!value.when || condition(value.when, e, boundUser)) &&
      condition(value.exclude_if, e, boundUser)
    );
  };
  if (s.population === "older_adult") {
    if (applyExclude("older.exclude.base")) return false;
    if (
      condition(
        r.get("older.exclude.base").default_low_impact.exclude_if,
        e,
        s.user,
      )
    )
      return false;
    if (
      s.user.balance_cautious &&
      applyExclude("older.exclude.balance_cautious")
    )
      return false;
    if (
      (s.user.balance_cautious || s.user.walking_aid) &&
      (e.requires_floor_transition || floorBased(e, r))
    )
      return false;
    if (
      pop.kind === "older_adult" &&
      pop.boneFlag &&
      condition(r.get("older.bone").until_clearance_exclude_if, e, s.user)
    )
      return false;
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
      if (applyExclude(id)) return false;
  if (s.population === "postpartum" && pop.kind === "postpartum") {
    if (s.phase === 1) {
      if (pop.delivery === "cesarean" && !pop.cleared) {
        if (
          !condition(
            r.get("postpartum.gate.caesarean").allow_only_if,
            e,
            s.user,
          )
        )
          return false;
      } else if (
        !condition(r.get("postpartum.phase1").allow_only_if, e, s.user)
      )
        return false;
    }
    if (s.phase < 3 && applyExclude("postpartum.exclude.pre_phase3"))
      return false;
    if (
      s.phase === 2 &&
      e.modality !== "mobility" &&
      e.difficulty > r.get("postpartum.phase2").strength_limits.difficulty_max
    )
      return false;
    if (
      !pop.readinessChecklistPassed &&
      (e.flags.some((f) => f === "running" || f === "jumping") ||
        e.impact >= 2 ||
        e.modality === "plyometric")
    )
      return false;
  }
  return true;
}
