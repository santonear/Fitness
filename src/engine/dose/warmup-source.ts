import { type Template, effectiveGoalRole } from "../dose";
import { type EngineProfile } from "../contracts";
import { type Rules } from "../data";
import { sourcePosition, durationTier } from "./warmup-identity";

export interface SourceWarmupRamp {
  itemIndex: number;
  exerciseId: string;
  kind: "first_loaded_compound" | "later_barbell_compound" | "bodyweight_main";
  seconds: number;
  scheme: { reps: number; pct_working_load?: number }[];
}

/** These source warmup sets are already counted once by estimatedSeconds. */
export function sourceWarmupRamps(
  template: Template,
  p: EngineProfile,
  r: Rules,
): SourceWarmupRamp[] {
  const result: SourceWarmupRamp[] = [],
    source = r.get("duration.ramp.sets"),
    protocol = r.get("session.warmup.ramp_sets"),
    setup = r.get("duration.transition.setup").setup_s_defaults,
    minutes = Math.min(
      p.sessionMinutes,
      template.targetMinutes ?? p.sessionMinutes,
    ),
    firstTier = r
      .get("duration.capacity.table")
      .sessions.find((row: { ramp_s: number }) => row.ramp_s > 0).minutes;
  const work = template.items.flatMap((item, itemIndex) =>
      ["main", "accessory"].includes(item.prescription?.block ?? "")
        ? [{ item, itemIndex }]
        : [],
    ),
    loaded = work.filter(({ item }) => {
      const e = r.byExercise.get(item.exerciseId);
      return (
        e?.modality === "strength" &&
        e.nsca_class === "compound" &&
        item.target.metricType === "reps_load" &&
        e.time.setup_s >= setup.dumbbell_kettlebell_band
      );
    });
  const mains = work.filter(({ item }) =>
      /^main_[1-9]\d*$/.test(sourcePosition(item, template) ?? ""),
    ),
    uniqueMains =
      new Set(mains.map(({ item }) => sourcePosition(item, template))).size ===
      mains.length,
    goal = r.get(`goal.params.${p.goal}`);
  let days: Rules["data"]["rules"] | undefined;
  const sourceDays = () => {
    if (days) return days;
    const allowedDays = new Set<string>();
    for (const rule of r.data.rules) {
      const match = rule.id.match(/^week\.template\.rt(\d+)$/);
      if (
        !match ||
        Number(match[1]) > Math.min(p.daysPerWeek, goal.rt_sessions_week.max)
      )
        continue;
      const value = rule.value!,
        variants = (value.variants ?? []).filter(
          (variant: {
            when?: {
              session_minutes_min?: number;
              session_minutes_max?: number;
            };
          }) =>
            !variant.when ||
            (variant.when.session_minutes_min !== undefined &&
              minutes >= variant.when.session_minutes_min) ||
            (variant.when.session_minutes_max !== undefined &&
              minutes <= variant.when.session_minutes_max),
        );
      for (const day of [
        value.rotation,
        ...variants.map((variant: { rotation?: unknown }) => variant.rotation),
      ].flat(Infinity))
        if (typeof day === "string") allowedDays.add(day);
    }
    return (days = r.data.rules.filter(
      (rule) =>
        rule.id.startsWith("week.day.") &&
        allowedDays.has(rule.id.slice("week.day.".length)),
    ));
  };
  for (const entry of work) {
    const { item, itemIndex } = entry,
      e = r.byExercise.get(item.exerciseId);
    if (!e || e.modality !== "strength" || e.nsca_class !== "compound")
      continue;
    const base = { itemIndex, exerciseId: item.exerciseId };
    if (minutes >= firstTier && entry === loaded[0]) {
      result.push({
        ...base,
        kind: "first_loaded_compound",
        seconds: source.first_loaded_compound.ramp_s,
        scheme: structuredClone(protocol.first_loaded_compound.scheme),
      });
      continue;
    }
    if (
      minutes >= firstTier &&
      loaded.includes(entry) &&
      e.time.setup_s === setup.barbell
    ) {
      result.push({
        ...base,
        kind: "later_barbell_compound",
        seconds: source.later_barbell_compound.ramp_s,
        scheme: structuredClone(protocol.later_compounds.scheme),
      });
      continue;
    }
    const pos = sourcePosition(item, template),
      recipe = r.get(`session.template.min${durationTier(minutes, p, r)}`),
      container = recipe.slots.find((slot: { from_pos?: string[] }) =>
        slot.from_pos?.includes(pos ?? ""),
      );
    const main =
        !!pos &&
        /^main_\d+$/.test(pos) &&
        container?.block === item.prescription?.block &&
        uniqueMains &&
        sourceDays().some((day) =>
          mains.every(({ item: other }) => {
            const position = sourcePosition(other, template);
            if (!position) return true;
            const slot = day.value?.slots.find(
                (slot: { pos?: string }) => slot.pos === position,
              ),
              exercise = r.byExercise.get(other.exerciseId);
            return (
              !!slot &&
              !!exercise &&
              slot.pattern?.includes(exercise.primary_pattern)
            );
          }),
        ) &&
        (p.goal !== "strength" || effectiveGoalRole(item, p, r) === "main"),
      fraction = protocol.bodyweight_main.target_rep_fraction;
    if (
      !main ||
      !e.equipment_required.every((equipment) => equipment === "none") ||
      !("reps" in item.target) ||
      typeof fraction !== "number"
    )
      continue;
    const cadence =
        item.prescription?.secondsPerRep ??
        e.time.s_per_rep ??
        r.get("duration.rep.seconds").default_if_unknown,
      tempo = r.get("dose.tempo").rep_duration_s;
    if (
      cadence !== e.time.s_per_rep &&
      (cadence < tempo.min || cadence > tempo.max)
    )
      continue;
    const reps = Math.ceil(item.target.reps * fraction),
      side =
        item.prescription?.perSide || e.time.per_side
          ? r.get("session.time.model").per_side_multiplier
          : 1;
    result.push({
      ...base,
      kind: "bodyweight_main",
      seconds:
        protocol.bodyweight_main.sets *
        (reps * cadence * side +
          r.get("duration.set.overhead").overhead_s_per_set),
      scheme: Array.from({ length: protocol.bodyweight_main.sets }, () => ({
        reps,
      })),
    });
  }
  return result;
}

/** Refresh a cloned prescription after dose or exercise changes. */
export function refreshWarmupRamps(
  template: Template,
  p: EngineProfile,
  r: Rules,
): Template {
  const copy = structuredClone(template),
    expected = new Map(
      sourceWarmupRamps(copy, p, r).map((entry) => [
        entry.itemIndex,
        entry.seconds,
      ]),
    );
  for (const [index, item] of copy.items.entries())
    if (["main", "accessory"].includes(item.prescription?.block ?? "")) {
      const seconds = expected.get(index);
      if (seconds !== undefined) item.prescription!.warmupSeconds = seconds;
      else if (item.prescription) delete item.prescription.warmupSeconds;
    }
  return copy;
}
