import type { EngineCoachProfile } from "./engine-profile";
import { basicItems } from "./rules/basic-items";
import { hasHouseholdSupport } from "../engine/equipment";
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

/** Feature-off compatibility uses only the pre-existing conservative basic subset.
 * It is not a completed medical screen. Any stored engine/health facts remain on the strict path. */
export function replacementCandidateIds(
  profile: EngineProfile | undefined,
  legacy: EngineCoachProfile | undefined,
  engineEnabled: boolean,
  rules = new Rules(),
): string[] {
  if (
    profile ||
    engineEnabled ||
    !legacy ||
    legacy.healthStorageConsent ||
    legacy.screening ||
    legacy.population ||
    legacy.birthYearMonth ||
    legacy.postpartumRisk ||
    legacy.powerOneRm
  )
    return engineReplacementIds(profile, rules);
  const items = Array.from(
    { length: 4 },
    (_, variant) => basicItems(legacy, variant).items,
  ).flat();
  const owned = new Set([
    "none",
    "yoga-mat-optional",
    ...items.map((item) => item.equipment),
    ...(hasHouseholdSupport(legacy)
      ? rules.get("environment.household_support").equipment
      : []),
  ]);
  const spaces = ["mat", "small", "medium", "large"],
    space = legacy.constraints?.space ?? "small";
  return [...new Set(items.map((item) => item.exerciseId))].filter((id) => {
    const e = rules.byExercise.get(id);
    return (
      !!e &&
      e.difficulty <= 2 &&
      e.noise === 0 &&
      !e.flags.some((flag) => ["running", "jumping"].includes(flag)) &&
      spaces.indexOf(e.space) <= spaces.indexOf(space) &&
      e.equipment_required.every(
        (key) =>
          owned.has(key) ||
          (e.equipment_alternatives[key] ?? []).some((key) => owned.has(key)),
      )
    );
  });
}
