import type {
  Candidate,
  EngineProfile,
  GateOutcome,
  PipelineContext,
  Slot,
} from "./contracts";
import {
  restrictedAdjacentIds,
  stableString,
  type Rules,
  type Exercise,
} from "./data";
import { isHardEligible } from "./candidates/eligibility";
export {
  equipmentAvailable,
  floorBased,
  isHardEligible,
  sourceFallbackRestriction,
} from "./candidates/eligibility";
// Rules identity denotes one compiled rule/catalog snapshot. Gate keys bound cache lifetime.
const eligiblePools = new WeakMap<
  GateOutcome,
  WeakMap<Rules, { fingerprint: string; pool: Exercise[] }>
>();
function eligiblePool(
  profile: EngineProfile,
  gate: GateOutcome,
  context: PipelineContext,
): Exercise[] {
  const s = gate.restrictions,
    fingerprint = stableString([
      profile,
      gate.status,
      s.user,
      s.population,
      s.phase,
      s.rirMin,
      s.excludeFlags,
      s.excludePositions,
    ]);
  let byRules = eligiblePools.get(gate);
  if (!byRules) {
    byRules = new WeakMap();
    eligiblePools.set(gate, byRules);
  }
  const cached = byRules.get(context.rules);
  if (cached?.fingerprint === fingerprint) return cached.pool;
  const pool = context.rules.data.exercises.filter((e) =>
    isHardEligible(e, profile, gate, context),
  );
  byRules.set(context.rules, { fingerprint, pool });
  return pool;
}
/** Verified source metadata defines formal regions; names never supply missing annotations. */
function matchesRegion(
  e: Exercise,
  region: Slot["region"],
  rules: Rules,
): boolean {
  if (!region) return true;
  if (e.modality !== "mobility") return false;
  if (region === "trunk")
    return (
      e.mobility_type === "dynamic" &&
      (e.primaryMuscles ?? []).some((m) =>
        ["core", "lower_back"].includes(
          rules.get("dose.muscle_groups").catalog_map[m],
        ),
      )
    );
  const groups =
    region === "lower_body"
      ? ["quads", "glutes", "hamstrings"]
      : ["chest", "back", "shoulders"];
  return (
    e.mobility_type === "static" &&
    (e.stretch_targets ?? []).some((group) => groups.includes(group))
  );
}
/** Relax slot preferences only; the complete fallback pool remains hard eligible. */
export function candidatesFor(
  slot: Slot,
  profile: EngineProfile,
  gate: GateOutcome,
  context: PipelineContext,
): Candidate[] {
  if (gate.status === "blocked") return [];
  const adjacent = restrictedAdjacentIds(
    context.plan?.templates ?? [],
    context.currentWeekday,
    context.rules,
  );
  const safe = eligiblePool(profile, gate, context).filter(
    (e) =>
      !adjacent.has(e.id) &&
      !context.usedIds.has(e.id) &&
      (!e.ladder.id || !context.usedLadders.has(e.ladder.id)) &&
      matchesRegion(e, slot.region, context.rules),
  );
  if (slot.region && !safe.length) {
    context.trace.push({
      ruleId: "week.day.mobility",
      reason: "no verified hard eligible candidate for source region",
      step: "candidates",
      note: `${slot.id}:${slot.region}`,
    });
    return [];
  }
  const match = context.rules.get("select.use_tag.slot_match");
  const uses =
    slot.role === "main"
      ? match.main_slot_requires.use
      : slot.role === "warmup"
        ? match.warmup_slot_requires.use
        : slot.role === "cooldown" || slot.role === "mobility"
          ? match.cooldown_slot_requires.use
          : slot.role === "conditioning"
            ? match.conditioning_slot_requires.use
            : match.accessory_slot_requires.use;
  const role = safe.filter((e) => e.use.some((u) => uses.includes(u)));
  const exact = role.filter((e) => slot.patterns.includes(e.primary_pattern));
  const secondary = ["accessory", "core"].includes(slot.role)
    ? role.filter((e) =>
        e.secondary_patterns.some((p) => slot.patterns.includes(p)),
      )
    : [];
  const pool = exact.length
    ? exact
    : secondary.length
      ? secondary
      : role.length
        ? role
        : safe;
  context.trace.push({
    ruleId: exact.length ? "select.pipeline" : "select.fallback.chain",
    reason: pool.length
      ? "hard eligible candidate pool"
      : "complete hard candidate pool empty",
    step: "candidates",
    note: `${slot.id}:${pool.length}`,
  });
  return pool.sort((a, b) => a.id.localeCompare(b.id, "en"));
}
