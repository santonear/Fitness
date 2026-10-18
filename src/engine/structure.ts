import type {
  DayPlan,
  EngineProfile,
  GateOutcome,
  WeekSkeleton,
  Weekday,
} from "./contracts";
import { hash, Rules, type RuleValue } from "./data";
/** Source rotations determine strength days; remaining chosen dates retain goal-specific activity. */
export function buildWeek(
  profile: EngineProfile,
  gate: GateOutcome,
  rules = new Rules(),
  identitySeed?: string,
): WeekSkeleton {
  const trace: WeekSkeleton["trace"] = [];
  if (gate.status === "blocked") return { days: [], trace };
  const p = profile,
    g = gate.restrictions,
    allocation = rules.get("week.days.allocation");
  let cap = rules.get("goal.params." + p.goal).rt_sessions_week.max;
  const newCaps = rules.get("progression.new.week_caps");
  const stage = Object.entries(newCaps).find(
    ([key]) =>
      key.startsWith("week_") &&
      p.trainingAgeWeeks < Math.max(...key.split("_").slice(1).map(Number)),
  );
  if (p.level === "beginner" && stage) {
    const value = stage[1] as RuleValue;
    cap = Math.min(cap, value.rt_sessions_max ?? value.rt_sessions[0]);
  }
  if (g.population === "older_adult")
    cap = Math.min(cap, rules.get("older.week.strength").days_per_week.max);
  if (
    g.population === "pregnant" &&
    !allocation.distribute_strength_across_available_days
  )
    cap = Math.min(
      cap,
      rules.get("pregnancy.week.target").strength_days_per_week_default,
    );
  if (g.population === "postpartum" && g.phase === 2)
    cap = rules.get("postpartum.phase2").strength_days_per_week;
  const rtDays = Math.min(p.daysPerWeek, cap),
    ruleId = "week.template.rt" + rtDays;
  const template = rules.get(ruleId);
  let variant: RuleValue = template;
  if (template.variants)
    variant =
      template.variants.find(
        (v: RuleValue) =>
          !v.when ||
          ((v.when.session_minutes_min === undefined ||
            p.sessionMinutes >= v.when.session_minutes_min) &&
            (v.when.session_minutes_max === undefined ||
              p.sessionMinutes <= v.when.session_minutes_max)),
      ) ?? template.variants[0];
  let rotation: string[] = (variant.rotation ?? template.rotation)[0];
  if (
    template.fallback_if_short_sessions &&
    p.sessionMinutes < template.session_minutes_min
  )
    rotation = template.fallback_if_short_sessions.rotation[0];
  const weekdays: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const preferred = [...new Set(p.preferredDays ?? [])];
  const defaults: Weekday[] =
    variant.weekday_default ?? template.weekday_default;
  const chosen = [
    ...preferred,
    ...defaults.filter((d) => !preferred.includes(d)),
    ...weekdays.filter((d) => !preferred.includes(d) && !defaults.includes(d)),
  ].slice(0, p.daysPerWeek);
  // Maximize minimum circular gap among strength dates, with weekday as the stable tie break.
  const sorted = [...chosen].sort(
    (a, b) => weekdays.indexOf(a) - weekdays.indexOf(b),
  );
  const selected: Weekday[] = [];
  while (selected.length < rtDays) {
    const next = sorted
      .filter((d) => !selected.includes(d))
      .sort((a, b) => {
        const distance = (d: Weekday) =>
          selected.length
            ? Math.min(
                ...selected.map((s) => {
                  const gap = Math.abs(
                    weekdays.indexOf(d) - weekdays.indexOf(s),
                  );
                  return Math.min(gap, weekdays.length - gap);
                }),
              )
            : 0;
        return (
          distance(b) - distance(a) || weekdays.indexOf(a) - weekdays.indexOf(b)
        );
      })[0];
    selected.push(next);
  }
  selected.sort((a, b) => weekdays.indexOf(a) - weekdays.indexOf(b));
  const balanceMin = rules.get("older.week.multicomponent")
    .balance_functional_days_per_week.min;
  const other = allocation.other_days_type[p.goal];
  let otherIndex = 0;
  const days = chosen.map((weekday, index) => {
    const strengthIndex = selected.indexOf(weekday);
    let source =
      strengthIndex >= 0
        ? rotation[strengthIndex]
        : Array.isArray(other)
          ? other[otherIndex++ % other.length]
          : other;
    if (g.population === "postpartum" && g.phase === 1)
      source = "early_postpartum";
    const kind: DayPlan["kind"] =
      source === "early_postpartum"
        ? "early_postpartum"
        : source.startsWith("u")
          ? "upper"
          : source.startsWith("l")
            ? "lower"
            : source === "aerobic" || source === "mobility"
              ? source
              : "full";
    return {
      id: "day-" + hash([identitySeed ?? profile, index]),
      index,
      kind,
      minutes: p.sessionMinutes,
      weekday,
      balanceRequired:
        g.population === "older_adult" &&
        (p.daysPerWeek < balanceMin || index < balanceMin),
      sourceDayRuleId:
        source === "early_postpartum"
          ? "postpartum.phase1"
          : "week.day." + source,
    };
  });
  rules.trace(
    trace,
    "week.days.allocation",
    "source_rotation_and_goal_allocation",
    { rtDays },
  );
  rules.trace(trace, ruleId, "source_week_template");
  if (preferred.length)
    rules.trace(trace, "week.schedule.user_days", "preferred_dates_preserved");
  if (g.population === "older_adult")
    rules.trace(
      trace,
      "older.week.multicomponent",
      p.daysPerWeek >= balanceMin
        ? "weekly_balance_hard"
        : "each_session_balance_target",
    );
  if (g.population === "pregnant")
    rules.trace(
      trace,
      "pregnancy.week.target",
      "pregnancy_strength_aerobic_allocation",
    );
  if (g.population === "postpartum")
    rules.trace(
      trace,
      "postpartum.phase" + g.phase,
      "postpartum_stage_structure",
    );
  return { days, trace };
}
