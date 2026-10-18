import { ownedEquipment } from "./equipment";
import type { EngineProfile } from "./contracts";
import { Rules, condition, type Exercise } from "./data";

/** Approved pregnancy ramp limits the available time, never invents activity evidence. */
export function pregnancyRampMinutes(
  p: EngineProfile,
  r = new Rules(),
): number | undefined {
  const source = r.get("pregnancy.week.target").previously_inactive;
  if (
    p.population.kind !== "pregnant" ||
    p.screening.activityStatus !== source.when.activity_status
  )
    return;
  return Math.min(
    source.first_week_minutes +
      Math.floor(p.trainingAgeWeeks) * source.weekly_increment_minutes,
    source.max_minutes,
  );
}

export function pregnancyTargetMinutes(
  p: EngineProfile,
  r = new Rules(),
): number | undefined {
  const limit = pregnancyRampMinutes(p, r);
  return limit === undefined ? undefined : Math.min(p.sessionMinutes, limit);
}

export function pregnancyStandingCap(
  e: Exercise,
  p: EngineProfile,
  r = new Rules(),
): number | undefined {
  const source = r.get("pregnancy.intensity").static_standing;
  if (p.population.kind === "pregnant" && condition(source.match, e, {}))
    return source.per_set_seconds_max;
}

/** Source-declared support options are facts, not an inference from lower RPE. */
export function pregnancyBalanceSupport(
  e: Exercise,
  p: EngineProfile,
  r = new Rules(),
) {
  if (p.population.kind !== "pregnant")
    return { required: false, available: [] as string[], copy: undefined };
  const source = r
    .get("pregnancy.exclude.fall_risk")
    .modify.find((row: { cue: string }) => row.cue === "hold_wall_or_chair");
  const required =
    p.population.kind === "pregnant" &&
    condition(source.when, e, { gestation_week: p.population.week });
  if (!required)
    return { required: false, available: [] as string[], copy: undefined };
  const supported =
    e.supported_variant_available === true ||
    source.supported_exercise_ids.includes(e.id);
  const owned = ownedEquipment(p);
  const available: string[] =
    required && supported
      ? source.support_equipment.filter((key: string) => owned.has(key))
      : [];
  return {
    required,
    available,
    copy: required
      ? r.text("pregnancy.exclude.fall_risk.support_copy")
      : undefined,
  };
}
