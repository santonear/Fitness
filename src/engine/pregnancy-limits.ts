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
