import { EngineProfile } from "../contracts";
import { Rules } from "../data";
import { newWeek, prescribe, prescribedRepRange, Template } from "../dose";
import { safety, SafetyState } from "../gates/strength-scoring";
import { hardEligible, mobilityRegions } from "./legacy-candidates";
import { estimatedSeconds } from "../fit/elapsed-time";
import { ensureSafetyBlocks } from "./legacy-blocks";

export function durationTier(
  minutes: number,
  p: EngineProfile,
  r: Rules,
): number {
  const v = r.get("session.durations.allowed");
  const result =
    v.minutes.filter((n: number) => n <= minutes).at(-1) ?? v.minutes[0];
  return p.level === "beginner" && result === 90
    ? v.min90_beginner_fallback
    : result;
}

export function timingRow(minutes: number, r: Rules) {
  return r
    .get("duration.block.warmup_cooldown")
    .by_session_min.filter((v: { session: number }) => v.session <= minutes)
    .at(-1);
}

export function sourceMobilityTarget(
  template: Template,
  p: EngineProfile,
  r: Rules,
): boolean {
  const target = template.targetMinutes,
    day = r.get("week.day.mobility");
  if (
    p.goal !== "mobility" ||
    target === undefined ||
    !Number.isInteger(target) ||
    target < day.minutes[0] ||
    target > day.minutes[1] ||
    target > p.sessionMinutes
  )
    return false;
  if (
    template.items.some(
      (i) =>
        ["main", "accessory"].includes(i.prescription?.block ?? "") ||
        (i.prescription?.block !== "balance" &&
          ["strength", "isometric"].includes(
            r.byExercise.get(i.exerciseId)?.modality ?? "",
          )),
    )
  )
    return false;
  return day.slots
    .filter((slot: { target?: string }) => slot.target)
    .every(
      (slot: { target: string }) =>
        template.items
          .filter((i) => {
            const e = r.byExercise.get(i.exerciseId);
            return (
              i.prescription?.block === "mobility" &&
              !!e &&
              mobilityRegions(e, r).includes(slot.target)
            );
          })
          .reduce(
            (sum, i) =>
              sum +
              ("durationSeconds" in i.target
                ? i.sets *
                  i.target.durationSeconds *
                  (i.prescription?.perSide ||
                  r.byExercise.get(i.exerciseId)?.time.per_side
                    ? r.get("session.time.model").per_side_multiplier
                    : 1)
                : 0),
            0,
          ) >= day.seconds_per_region_min,
    );
}

export function startMovingAllocation(
  p: EngineProfile,
  r: Rules,
  state?: SafetyState,
) {
  const goal = r.get("goal.params.start_moving"),
    week = newWeek(p, r),
    s = state ?? safety(p, r);
  let rtDays = Math.min(
    goal.rt_sessions_week.default,
    p.daysPerWeek,
    goal.rt_sessions_week.max,
    week?.rt_sessions_max ?? week?.rt_sessions?.[0] ?? p.daysPerWeek,
  );
  if (s.population === "older_adult")
    rtDays = Math.min(rtDays, r.get("older.week.strength").days_per_week.max);
  if (s.population === "postpartum")
    rtDays =
      s.phase === 1
        ? 0
        : Math.min(rtDays, r.get("postpartum.phase2").strength_days_per_week);
  const otherDays = p.daysPerWeek - rtDays,
    aerobicDays = otherDays || p.daysPerWeek;
  return {
    rtDays,
    aerobicDays,
    otherDays,
    seconds: Math.ceil(
      (Math.max(
        goal.aerobic_moderate_equiv_min_week.week1[0],
        r.get("aerobic.progression.ramp").week1_floor_min,
      ) *
        60) /
        aerobicDays,
    ),
  };
}

export function startMovingAerobicSeconds(
  p: EngineProfile,
  r: Rules,
  resistanceDay = false,
): number {
  const allocation = startMovingAllocation(p, r);
  return resistanceDay && allocation.otherDays ? 0 : allocation.seconds;
}

/** Rebuilds a new source dose before fitting; neither actual estimated time nor caller target is an input. */
export function readLegacySourceTarget(
  template: Template,
  p: EngineProfile,
  r: Rules,
): number | undefined {
  if (p.goal !== "start_moving") return undefined;
  const s = safety(p, r);
  if (s.phase === 1) return undefined;
  const goal = r.get("goal.params.start_moving"),
    bounds = r.get("session.durations.allowed").minutes;
  const ctx = {
      profile: p,
      rules: r,
      safety: s,
      seed: "source-target",
      trace: [],
      used: new Set<string>(),
      ladders: new Set<string>(),
    },
    seconds = startMovingAerobicSeconds(
      p,
      r,
      template.items.some((i) =>
        ["main", "accessory"].includes(i.prescription?.block ?? ""),
      ),
    ),
    existing = template.items.find(
      (i) =>
        i.prescription?.block === "conditioning" &&
        r.byExercise.get(i.exerciseId)?.modality === "cardio",
    ),
    aerobic = existing
      ? r.byExercise.get(existing.exerciseId)
      : r.data.exercises
          .filter(
            (e) =>
              e.modality === "cardio" &&
              e.use.includes("conditioning") &&
              hardEligible(e, ctx),
          )
          .sort(
            (a, b) =>
              Number(a.use.includes("cooldown")) -
                Number(b.use.includes("cooldown")) ||
              a.id.localeCompare(b.id, "en"),
          )[0];
  if (seconds && !aerobic) return undefined;
  const base = template.items
    .filter((i) =>
      ["main", "accessory", "balance"].includes(i.prescription?.block ?? ""),
    )
    .flatMap((item) => {
      const e = r.byExercise.get(item.exerciseId);
      if (!e) return [];
      const normalized = prescribe(
        e,
        p,
        r,
        s,
        item.prescription!.block,
        Math.max(
          goal.sets_per_exercise.min,
          Math.min(goal.sets_per_exercise.max, item.sets),
        ),
      );
      normalized.sets = Math.max(
        goal.sets_per_exercise.min,
        Math.min(goal.sets_per_exercise.max, item.sets),
      );
      if ("reps" in item.target && "reps" in normalized.target) {
        const range = prescribedRepRange(e, p, r, s, item.prescription!.block);
        normalized.target.reps = Math.max(
          range[0],
          Math.min(range[1], item.target.reps),
        );
      } else if (
        e.modality === "isometric" &&
        "durationSeconds" in item.target &&
        "durationSeconds" in normalized.target
      ) {
        const range = r.get("dose.isometric")[p.level].hold_s;
        normalized.target.durationSeconds = Math.max(
          range[0],
          Math.min(range[1], item.target.durationSeconds),
        );
      }
      for (const key of [
        "structure",
        "groupId",
        "roundRestSeconds",
        "sourcePosition",
      ] as const)
        if (item.prescription?.[key] !== undefined)
          Object.assign(normalized.prescription!, {
            [key]: item.prescription[key],
          });
      return [normalized];
    });
  const dynamics = template.items
    .filter(
      (i) =>
        i.prescription?.block === "warmup" &&
        r.byExercise.get(i.exerciseId)?.mobility_type === "dynamic",
    )
    .map((item) => {
      const e = r.byExercise.get(item.exerciseId)!,
        normalized = prescribe(e, p, r, s, "warmup", 1),
        side = e.time.per_side
          ? r.get("session.time.model").per_side_multiplier
          : 1;
      normalized.target = {
        metricType: "duration",
        durationSeconds: Math.ceil(
          r.get("session.warmup.dynamic").seconds[0] / side,
        ),
      };
      return normalized;
    });
  let target = p.sessionMinutes;
  for (let pass = 0; pass <= bounds.length; pass++) {
    const profile = { ...p, sessionMinutes: target },
      day: Template = {
        id: template.id,
        name: template.name,
        estimatedMinutes: target,
        items: structuredClone([...dynamics, ...base]),
      };
    if (seconds && aerobic) {
      const item = prescribe(aerobic, profile, r, s, "conditioning", 1),
        side = aerobic.time.per_side
          ? r.get("session.time.model").per_side_multiplier
          : 1;
      item.target = {
        metricType:
          aerobic.metricType === "duration_distance"
            ? "duration_distance"
            : "duration",
        durationSeconds: Math.ceil(seconds / side),
      };
      day.items.push(item);
    }
    ensureSafetyBlocks(day, profile, r, s);
    const next = Math.min(
      p.sessionMinutes,
      Math.max(bounds[0], Math.ceil(estimatedSeconds(day, r) / 60)),
    );
    if (next === target) return next;
    target = next;
  }
  return target;
}

export function templateTargetMinutes(
  template: Template,
  p: EngineProfile,
  r: Rules,
): number {
  return sourceMobilityTarget(template, p, r) ||
    (template.targetMinutes !== undefined &&
      p.goal === "start_moving" &&
      template.targetMinutes === readLegacySourceTarget(template, p, r))
    ? template.targetMinutes!
    : p.sessionMinutes;
}

export function sourceConditioningSlot(
  template: Template,
  p: EngineProfile,
  r: Rules,
):
  | { minutes: number | number[]; pattern: string[]; use: string[] }
  | undefined {
  if (
    !template.items.some((i) =>
      ["main", "accessory"].includes(i.prescription?.block ?? ""),
    )
  )
    return undefined;
  // A source-dosed new starter draft uses its exact weekly allocation, not the generic time-table default.
  if (
    p.goal === "start_moving" &&
    template.targetMinutes !== undefined &&
    template.targetMinutes === readLegacySourceTarget(template, p, r)
  )
    return {
      minutes: startMovingAerobicSeconds(p, r, true) / 60,
      pattern: ["cardio_cyclic"],
      use: ["conditioning"],
    };
  return r
    .get(
      `session.template.min${durationTier(templateTargetMinutes(template, p, r), p, r)}`,
    )
    .slots.find(
      (slot: { block: string; minutes?: number | number[] }) =>
        slot.block === "conditioning" && slot.minutes !== undefined,
    );
}

export function sourcePhase(p: EngineProfile, r: Rules) {
  return safety(p, r).phase;
}

export function circuitBudgetConflict(
  p: EngineProfile,
  r: Rules,
  s: SafetyState,
): boolean {
  if (s.phase === 1) return false;
  const recipe = r.get(
      `session.template.min${durationTier(p.sessionMinutes, p, r)}`,
    ),
    safety = r.get("safety.session.warmup_cooldown");
  return (
    safety.applies_to_session_types.includes("circuit") &&
    recipe.slots.some(
      (slot: { structure?: string }) => slot.structure === "circuit",
    ) &&
    p.sessionMinutes <= safety.warmup_min_minutes + safety.cooldown_min_minutes
  );
}
