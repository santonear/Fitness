import type { EngineProfile } from "../engine/contracts";
import { Rules } from "../engine/data";
import { runGates } from "../engine/gates";
import { isHardEligible } from "../engine/candidates";
/** Use the full hard pool, never catalog search labels, as the selection boundary. */
export function engineReplacementIds(
  profile: EngineProfile | undefined,
  rules = new Rules(),
): string[] {
  if (!profile) return [];
  const gate = runGates(profile, rules);
  return rules.data.exercises
    .filter((exercise) => isHardEligible(exercise, profile, gate, { rules }))
    .map((exercise) => exercise.id);
}
