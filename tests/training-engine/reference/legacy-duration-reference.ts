/** Test-only V1 validator calculations. */
import type { EngineProfile } from "../../../src/engine/contracts";
import { Rules, type Exercise } from "../../../src/engine/data";
import type { Item } from "../../../src/engine/dose";
export * from "../../../src/engine/fit/elapsed-time";
export * from "../../../src/engine/progression/legacy-target";
export * from "../../../src/engine/progression/legacy-blocks";
export * from "../../../src/engine/progression/legacy-cooldown";
export * from "../../../src/engine/progression/legacy-warmup";

export function pairAllowed(
  a: Item,
  b: Item,
  p: EngineProfile,
  r: Rules,
): boolean {
  const ea = r.byExercise.get(a.exerciseId),
    eb = r.byExercise.get(b.exerciseId);
  if (!ea || !eb) return false;
  const v = r.get("session.superset.pairing");
  const f = v.forbidden_if;
  if (
    f.both_flag.some(
      (flag: string) => ea.flags.includes(flag) && eb.flags.includes(flag),
    )
  )
    return false;
  if (
    Object.entries(f.both_joint_load_min).some(
      ([j, n]) =>
        ea.joint_load[j] >= (n as number) && eb.joint_load[j] >= (n as number),
    )
  )
    return false;
  if (
    ea.primary_pattern === eb.primary_pattern ||
    (ea.ladder.id && ea.ladder.id === eb.ladder.id)
  )
    return false;
  if (
    ea.time.setup_s >= f.both_setup_s_min &&
    eb.time.setup_s >= f.both_setup_s_min
  )
    return false;
  if (
    f.different_space_large &&
    ea.space !== eb.space &&
    (ea.space === "large" || eb.space === "large")
  )
    return false;
  const corePatterns = v.groups.core ?? [];
  const backLimit = f.core_member_joint_load_min_with_back_loaded_partner?.back;
  if (
    backLimit !== undefined &&
    ((corePatterns.includes(ea.primary_pattern) &&
      ea.joint_load.back >= backLimit &&
      eb.joint_load.back >= backLimit) ||
      (corePatterns.includes(eb.primary_pattern) &&
        eb.joint_load.back >= backLimit &&
        ea.joint_load.back >= backLimit))
  )
    return false;
  if (
    p.goal === "strength" &&
    [...ea.flags, ...eb.flags].some((flag) =>
      f.either_flag_when_goal_strength.includes(flag),
    )
  )
    return false;
  const group = (e: Exercise, key: string) =>
    key === "any_strength"
      ? ["strength", "isometric"].includes(e.modality)
      : (v.groups[key] ?? []).includes(e.primary_pattern);
  return v.allowed_pairs.some(
    ([x, y]: string[]) =>
      (group(ea, x) && group(eb, y)) || (group(ea, y) && group(eb, x)),
  );
}
