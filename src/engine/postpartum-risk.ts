import { weeklyVolume } from "./dose";
import type { EngineProfile, EnginePlan } from "./contracts";
import { Rules, addCalendarMonths, type Exercise } from "./data";
type RiskProfile = EngineProfile & { postpartumRisk?: Record<string, boolean> };
/** Unknown modifiers choose the conservative rate without becoming negative health answers. */
export function derivePostpartumRisk(
  profile: RiskProfile,
  rules = new Rules(),
  measurements?: { heightCm?: number },
) {
  const source = rules.get("postpartum.risk_modifiers"),
    keys = source.modifiers as string[],
    known: Record<string, boolean> = {};
  if (profile.population.kind !== "postpartum")
    return {
      applies: false,
      known,
      unknown: [] as string[],
      beforeRunningCopyId: undefined as string | undefined,
    };
  for (const key of keys)
    if (typeof profile.postpartumRisk?.[key] === "boolean")
      known[key] = profile.postpartumRisk[key];
  const pop = profile.population;
  if (
    pop.delivery === "cesarean" ||
    pop.delivery === "assisted_or_tear" ||
    pop.perinealTrauma === true
  )
    known.caesarean_or_perineal_trauma = true;
  else if (pop.perinealTrauma === false)
    known.caesarean_or_perineal_trauma = false;
  const monthsKey = keys.find((key) =>
    /^under_\d+_months_postpartum$/.test(key),
  );
  if (monthsKey && profile.asOfDate) {
    const months = Number(monthsKey.match(/\d+/)![0]),
      today = Date.parse(profile.asOfDate + "T00:00:00Z"),
      week = Math.floor(pop.weeksSinceBirth);
    // A reported completed week gives a date interval, not an exact birth date or month/week conversion.
    const earliest = new Date(today - ((week + 1) * 7 - 1) * 86400000)
        .toISOString()
        .slice(0, 10),
      latest = new Date(today - week * 7 * 86400000).toISOString().slice(0, 10);
    if (profile.asOfDate < addCalendarMonths(earliest, months))
      known[monthsKey] = true;
    else if (
      profile.asOfDate >= addCalendarMonths(latest, months) &&
      known[monthsKey] !== true
    )
      known[monthsKey] = false;
  }
  const bmiKey = keys.find((key) => /^bmi_over_\d+$/.test(key)),
    height = measurements?.heightCm,
    weight = profile.bodyWeightKg;
  if (
    bmiKey &&
    height !== undefined &&
    Number.isFinite(height) &&
    height > 0 &&
    weight !== undefined &&
    Number.isFinite(weight) &&
    weight > 0
  )
    known[bmiKey] =
      known[bmiKey] === true ||
      weight / (height / 100) ** 2 > Number(bmiKey.match(/\d+/)![0]);
  const unknown = keys.filter((key) => known[key] === undefined),
    applies = unknown.length > 0 || Object.values(known).some(Boolean);
  return {
    applies,
    known,
    unknown,
    beforeRunningCopyId: applies
      ? source.when_any.before_running_gate_show
      : undefined,
  };
}
export function postpartumLoadStepCap(e: Exercise, rules: Rules): number {
  const v = rules.get("progression.load.increment");
  for (const entry of [v.lower_compound, v.upper_compound])
    if (
      entry.match.primary_pattern.includes(e.primary_pattern) &&
      entry.match.nsca_class === e.nsca_class
    )
      return Math.min(entry.pct, v.max_step_pct);
  return Math.min(v.isolation_or_loaded_core.pct, v.max_step_pct);
}
export function postpartumVolumeStepCap(rules: Rules): number {
  const v = rules.get("volume.week.increase").increment_sets_per_muscle_week;
  return Math.min(v.beginner, ...(Object.values(v.intermediate) as number[]));
}
export function postpartumMuscleSets(
  plan: EnginePlan,
  rules: Rules,
): Map<string, number> {
  return new Map(Object.entries(weeklyVolume(plan, rules)));
}
