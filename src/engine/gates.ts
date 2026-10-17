import type { EngineProfile } from "./contracts";
import { Rules, condition } from "./data";
import { gateState } from "./gates/state";
/** Eligibility is medical only: an empty equipment/space pool is never a health block. */
export function runGates(
  profile: EngineProfile,
  rules = new Rules(),
): import("./contracts").GateOutcome {
  const state = gateState(profile, rules),
    excludeFlags = new Set<string>(),
    excludePositions = new Set<string>();
  if (profile.pregnancySafety?.avoidSupine) excludePositions.add("supine");
  const collect = (expr: Record<string, any>) => {
    if (expr.flag)
      for (const flag of Array.isArray(expr.flag) ? expr.flag : [expr.flag])
        excludeFlags.add(flag);
    if (expr.position)
      for (const position of Array.isArray(expr.position)
        ? expr.position
        : [expr.position])
        excludePositions.add(position);
    for (const item of expr.any ?? []) collect(item);
  };
  const ids =
    state.population === "pregnant"
      ? [
          "pregnancy.exclude.supine",
          "pregnancy.exclude.prone",
          "pregnancy.exclude.valsalva",
        ]
      : state.population === "postpartum" && state.phase < 3
        ? ["postpartum.exclude.pre_phase3"]
        : [];
  for (const id of ids) {
    const value = rules.get(id);
    if (
      !value.when ||
      condition(value.when, rules.data.exercises[0], state.user)
    )
      collect(value.exclude_if);
  }
  if (state.user.clearance_state === "required")
    for (const flag of rules.get("safety.clearance.restricted_mode")
      .exclude_flags)
      excludeFlags.add(flag);
  return {
    status: state.blocked
      ? "blocked"
      : state.gates.some((g) => g.status === "restricted")
        ? "restricted"
        : "ok",
    restrictions: {
      ...state,
      maxIntensity: state.maxRpe,
      allowedBundles: state.phase === 1 ? ["postpartum.phase1"] : [],
      excludeFlags: [...excludeFlags],
      excludePositions: [...excludePositions],
    },
    reasons: state.gates,
    trace: state.trace,
    notices: state.notices,
  };
}
