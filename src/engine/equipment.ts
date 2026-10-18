import type { EngineProfile } from "./contracts";
import { Rules } from "./data";
const rules = new Rules();
/** An explicit answer wins. A support surface is independent of available floor area. */
export function hasHouseholdSupport(profile: {
  place: string;
  householdSupport?: boolean;
}): boolean {
  return (
    profile.householdSupport ??
    rules
      .get("environment.household_support")
      .default_places.includes(profile.place)
  );
}
export function ownedEquipment(
  profile: Pick<EngineProfile, "equipment" | "place" | "householdSupport">,
): Set<string> {
  return new Set([
    "none",
    "yoga-mat-optional",
    ...profile.equipment,
    ...(hasHouseholdSupport(profile)
      ? rules.get("environment.household_support").equipment
      : []),
  ]);
}
