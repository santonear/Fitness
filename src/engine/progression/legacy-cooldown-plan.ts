import { EngineProfile } from "../contracts";

import { Rules, stretchHoldRange } from "../data";

import { credit, prescribe, strengthRoles, Item, Template } from "../dose";

import { safety, SafetyState } from "../gates/strength-scoring";

import { hardEligible } from "./legacy-candidates";

import {
  setSeconds,
  blockSeconds,
  estimatedSeconds,
} from "../fit/elapsed-time";

import {
  durationTier,
  timingRow,
  templateTargetMinutes,
} from "./legacy-target";

import { safetyBlockMinimums } from "./legacy-blocks";
import {
  priorityStretchGroups,
  requiredStretchGroups,
  shortStretchSession,
  cooldownCapSeconds,
} from "./legacy-cooldown";

/** Replays the authored priority against an actual finite block budget; caller metadata cannot waive missing work. */
export function plannedCooldown(
  template: Template,
  p: EngineProfile,
  r: Rules,
  s: SafetyState,
): {
  items: Item[];
  omitted: string[];
  missing: string[];
  safetyUnavailable: string[];
  optionalUncovered: string[];
  cap: number;
  shortPriority: boolean;
  priority: string[];
} {
  if (template.targetMinutes !== undefined) {
    const minutes = templateTargetMinutes(template, p, r);
    return plannedCooldown(
      { ...template, targetMinutes: undefined },
      { ...p, sessionMinutes: minutes },
      r,
      s,
    );
  }
  const work = template.items.filter(
      (i) => i.prescription?.block !== "cooldown",
    ),
    result = {
      items: [] as Item[],
      omitted: [] as string[],
      missing: [] as string[],
      safetyUnavailable: [] as string[],
      optionalUncovered: [] as string[],
      cap: cooldownCapSeconds(template, p, r),
      shortPriority: false,
      priority: [] as string[],
    },
    ctx = {
      profile: p,
      rules: r,
      safety: s,
      seed: "source-cooldown",
      trace: [],
      used: new Set<string>(),
      ladders: new Set<string>(),
    };
  const priority = priorityStretchGroups(template, r, p),
    required = requiredStretchGroups(template, r),
    actualShort = shortStretchSession(template, p, r, s),
    primaryOnly = s.cooldownPrimaryOnly && actualShort,
    groups = [...new Set(primaryOnly ? priority : [...priority, ...required])],
    rule = r.get("session.cooldown.stretch"),
    base = r.get("dose.stretch"),
    preferred = s.cooldownHoldSeconds ?? rule.dose.default.hold_s;
  result.shortPriority = !!primaryOnly;
  result.priority = priority;
  const seconds = () =>
      blockSeconds({ ...template, items: result.items }, "cooldown", r),
    held = (group: string) =>
      result.items.some((i) =>
        r.byExercise.get(i.exerciseId)?.stretch_targets?.includes(group),
      );
  const pool = r.data.exercises.filter(
    (e) =>
      e.modality === "mobility" &&
      e.mobility_type === "static" &&
      e.stretch_targets?.length &&
      e.use.includes("cooldown") &&
      e.difficulty <= r.get("select.difficulty.window").warmup_cooldown_max &&
      hardEligible(e, ctx) &&
      !!stretchHoldRange(e, r, s.population),
  );
  const retainPriority = actualShort,
    retainedGroups = retainPriority ? priority : groups,
    previous = template.items.filter(
      (i) => i.prescription?.block === "cooldown",
    ),
    statics = previous.filter((i) => pool.some((e) => e.id === i.exerciseId)),
    staticSets: Record<string, number> = {};
  for (const item of [...work, ...statics])
    for (const group of r.byExercise.get(item.exerciseId)?.stretch_targets ??
      [])
      staticSets[group] = (staticSets[group] ?? 0) + item.sets;
  const validPrevious =
    s.cooldownHoldSeconds === undefined &&
    !s.cooldownPrimaryOnly &&
    previous.length &&
    previous.every((item) => {
      const e = r.byExercise.get(item.exerciseId);
      if (
        !e ||
        !e.use.includes("cooldown") ||
        !hardEligible(e, ctx) ||
        !("durationSeconds" in item.target) ||
        item.target.durationSeconds <= 0 ||
        item.prescription?.structure !== "straight" ||
        item.prescription.groupId ||
        item.prescription.roundRestSeconds !== undefined
      )
        return false;
      if (e.modality === "cardio")
        return (
          item.sets === 1 &&
          (item.prescription.targetRpe?.[1] ?? Infinity) <=
            r.get("aerobic.intensity.rpe_scale").light_max
        );
      const range = stretchHoldRange(e, r, s.population);
      return (
        pool.includes(e) &&
        !!range &&
        Number.isInteger(item.sets) &&
        item.sets >= base.reps_per_muscle[0] &&
        item.sets <= base.reps_per_muscle[1] &&
        item.target.durationSeconds >= range[0] &&
        item.target.durationSeconds <= range[1]
      );
    }) &&
    Object.values(staticSets).every(
      (sets) => sets <= base.reps_per_muscle[1],
    ) &&
    retainedGroups.every((group) =>
      statics.some((i) =>
        r.byExercise.get(i.exerciseId)?.stretch_targets?.includes(group),
      ),
    ) &&
    previous.every(
      (item, n) =>
        ![...work, ...previous.slice(0, n)].some(
          (other) =>
            other.exerciseId === item.exerciseId ||
            (r.byExercise.get(item.exerciseId)?.ladder.id &&
              r.byExercise.get(item.exerciseId)?.ladder.id ===
                r.byExercise.get(other.exerciseId)?.ladder.id),
        ),
    ) &&
    blockSeconds(template, "cooldown", r) <= result.cap;
  if (validPrevious) {
    result.items = structuredClone(previous);
    if (retainPriority) {
      groups.splice(0, groups.length, ...priority);
      result.shortPriority = true;
    }
  }
  for (const group of groups) {
    if (held(group)) continue;
    const options = pool.filter(
      (e) =>
        e.stretch_targets!.includes(group) &&
        ![...work, ...result.items].some(
          (i) =>
            i.exerciseId === e.id ||
            (e.ladder.id &&
              r.byExercise.get(i.exerciseId)?.ladder.id === e.ladder.id),
        ) &&
        e.stretch_targets!.every(
          (target) =>
            [...work, ...result.items]
              .filter(
                (i) =>
                  r.byExercise.get(i.exerciseId)?.mobility_type === "static" &&
                  r.byExercise
                    .get(i.exerciseId)
                    ?.stretch_targets?.includes(target),
              )
              .reduce((sum, i) => sum + i.sets, 0) +
              base.reps_per_muscle[0] <=
            base.reps_per_muscle[1],
        ),
    );
    if (!options.length) {
      if (
        s.population === "pregnant" &&
        r.byId.get("session.cooldown.stretch")?.type === "default" &&
        !pool.some((e) => e.stretch_targets!.includes(group))
      )
        result.safetyUnavailable.push(group);
      else if (retainPriority && !priority.includes(group))
        result.optionalUncovered.push(group);
      else result.missing.push(group);
      continue;
    }
    const choices = options
      .map((e) => {
        const range = stretchHoldRange(e, r, s.population)!,
          item = prescribe(e, p, r, s, "cooldown", base.reps_per_muscle[0]);
        item.sets = base.reps_per_muscle[0];
        item.target = {
          metricType: "duration",
          durationSeconds: Math.max(range[0], Math.min(range[1], preferred)),
        };
        return { e, item, min: range[0] };
      })
      .sort(
        (a, b) =>
          Number(a.e.time.per_side) - Number(b.e.time.per_side) ||
          b.e.stretch_targets!.filter((g) => groups.includes(g) && !held(g))
            .length -
            a.e.stretch_targets!.filter((g) => groups.includes(g) && !held(g))
              .length ||
          a.e.id.localeCompare(b.e.id, "en"),
      );
    let chosen = choices.find(
      ({ item }) =>
        seconds() +
          item.sets * setSeconds(item, r.byExercise.get(item.exerciseId)!, r) <=
        result.cap,
    );
    if (!chosen) {
      for (const choice of choices)
        if ("durationSeconds" in choice.item.target)
          choice.item.target.durationSeconds = choice.min;
      chosen = choices.find(
        ({ item }) =>
          seconds() +
            item.sets *
              setSeconds(item, r.byExercise.get(item.exerciseId)!, r) <=
          result.cap,
      );
    }
    if (!chosen) {
      const shrinkable = [...result.items].reverse().flatMap((item) => {
          const e = r.byExercise.get(item.exerciseId)!,
            range = stretchHoldRange(e, r, s.population);
          return range && "durationSeconds" in item.target
            ? [
                {
                  item,
                  min: range[0],
                  factor:
                    item.sets *
                    (e.time.per_side
                      ? r.get("session.time.model").per_side_multiplier
                      : 1),
                },
              ]
            : [];
        }),
        available = shrinkable.reduce(
          (sum, x) =>
            sum +
            ("durationSeconds" in x.item.target
              ? (x.item.target.durationSeconds - x.min) * x.factor
              : 0),
          0,
        );
      chosen = choices.find(
        ({ item }) =>
          seconds() +
            item.sets *
              setSeconds(item, r.byExercise.get(item.exerciseId)!, r) -
            available <=
          result.cap,
      );
      if (chosen)
        for (const x of shrinkable) {
          const excess =
            seconds() +
            chosen.item.sets * setSeconds(chosen.item, chosen.e, r) -
            result.cap;
          if (excess <= 0) break;
          if ("durationSeconds" in x.item.target)
            x.item.target.durationSeconds = Math.max(
              x.min,
              x.item.target.durationSeconds - Math.ceil(excess / x.factor),
            );
        }
    }
    if (chosen) result.items.push(chosen.item);
    else result.omitted.push(group);
  }
  if (result.shortPriority)
    for (const group of required.filter((group) => !priority.includes(group)))
      if (!held(group) && !result.optionalUncovered.includes(group))
        result.optionalUncovered.push(group);
  const minimum = Math.max(
    timingRow(durationTier(templateTargetMinutes(template, p, r), p, r), r)
      .cooldown * 60,
    safetyBlockMinimums(template, p, r).cooldownSeconds,
  );
  const existingCardio = result.items.find(
    (i) => r.byExercise.get(i.exerciseId)?.modality === "cardio",
  );
  if (
    existingCardio &&
    "durationSeconds" in existingCardio.target &&
    seconds() < minimum
  ) {
    const e = r.byExercise.get(existingCardio.exerciseId)!,
      side =
        existingCardio.prescription?.perSide || e.time.per_side
          ? r.get("session.time.model").per_side_multiplier
          : 1;
    existingCardio.target.durationSeconds += Math.ceil(
      (minimum - seconds()) / (existingCardio.sets * side),
    );
  }
  if (seconds() < minimum) {
    const e = r.data.exercises
      .filter(
        (e) =>
          e.modality === "cardio" &&
          e.use.includes("cooldown") &&
          hardEligible(e, ctx) &&
          ![...work, ...result.items].some(
            (i) =>
              i.exerciseId === e.id ||
              (e.ladder.id &&
                r.byExercise.get(i.exerciseId)?.ladder.id === e.ladder.id),
          ),
      )
      .sort(
        (a, b) => a.difficulty - b.difficulty || a.id.localeCompare(b.id, "en"),
      )[0];
    if (e) {
      const item = prescribe(e, p, r, s, "cooldown", 1),
        side = e.time.per_side
          ? r.get("session.time.model").per_side_multiplier
          : 1,
        overhead = r.get("duration.set.overhead").overhead_s_per_set;
      if (result.cap - seconds() < overhead + side)
        for (const stretch of [...result.items].reverse()) {
          const ex = r.byExercise.get(stretch.exerciseId)!,
            range = stretchHoldRange(ex, r, s.population);
          if (
            !range ||
            !("durationSeconds" in stretch.target) ||
            stretch.target.durationSeconds <= range[0]
          )
            continue;
          const factor =
            stretch.sets *
            (ex.time.per_side
              ? r.get("session.time.model").per_side_multiplier
              : 1);
          stretch.target.durationSeconds = Math.max(
            range[0],
            stretch.target.durationSeconds -
              Math.ceil((overhead + side - (result.cap - seconds())) / factor),
          );
          if (result.cap - seconds() >= overhead + side) break;
        }
      item.target = {
        metricType:
          e.metricType === "duration_distance"
            ? "duration_distance"
            : "duration",
        durationSeconds: Math.max(
          1,
          Math.ceil((minimum - seconds() - overhead) / side),
        ),
      };
      if (seconds() + setSeconds(item, e, r) <= result.cap)
        result.items.push(item);
    }
  }
  return result;
}
