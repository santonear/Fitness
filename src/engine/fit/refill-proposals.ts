import { insertBeforeCooldown } from "./item-order";
import type { EnginePlan, EngineProfile, GateOutcome } from "../contracts";
import { type Rules, stretchHoldRange } from "../data";
import { isHardEligible } from "../candidates";
import { prescribe } from "../dose";
import { estimateSeconds } from "./estimate";
import { cardioWorkCap, cardioWorkSeconds } from "./cardio-cap";
import { cooldownCapSeconds } from "../progression/legacy-cooldown";
import { safetyBlockMinimums } from "../progression/legacy-blocks";
import { timingRow, durationTier } from "../progression/legacy-target";
type Template = EnginePlan["templates"][number];
export type RefillPhase =
  | "existing_sets"
  | "missing_patterns"
  | "low_intensity"
  | "warmup_cooldown";
/** Finite source-bounded proposals only. The caller must check the complete plan. */
export function* refillProposals(
  t: Template,
  p: EngineProfile,
  g: GateOutcome,
  r: Rules,
  phase: RefillPhase,
): Generator<Template> {
  const source = r.get("duration.cardio.cap"),
    target = (t.targetMinutes ?? p.sessionMinutes) * 60;
  const low = (e: (typeof r.data.exercises)[number]) =>
    e.modality === "mobility" ||
    e.primary_pattern === "balance" ||
    e.flags.includes("breathing") ||
    (e.modality === "cardio" &&
      ((source.explicit_low_intensity_slugs ?? []).includes(e.slug) ||
        (e.flags.includes(source.low_intensity.required_flag) &&
          e.impact === source.low_intensity.impact)));
  const withinBlocks = (next: Template) => {
    if (phase !== "warmup_cooldown") return true;
    const row = timingRow(
        durationTier(t.targetMinutes ?? p.sessionMinutes, p, r),
        r,
      ),
      safety = safetyBlockMinimums(t, p, r);
    return (
      estimateSeconds(
        { items: next.items.filter((i) => i.prescription?.block === "warmup") },
        r,
      ) <= Math.max(row.warmup * 60, safety.warmupSeconds) &&
      estimateSeconds(
        {
          items: next.items.filter((i) => i.prescription?.block === "cooldown"),
        },
        r,
      ) <= cooldownCapSeconds(t, p, r)
    );
  };
  for (const [index, item] of t.items.entries()) {
    const e = r.byExercise.get(item.exerciseId);
    if (!e) continue;
    const block = item.prescription?.block,
      boundary = block === "warmup" || block === "cooldown";
    if (
      phase === "missing_patterns" ||
      boundary !== (phase === "warmup_cooldown") ||
      (phase === "low_intensity" && !low(e))
    )
      continue;
    const max =
      e.mobility_type === "static"
        ? r.get("dose.stretch").reps_per_muscle[1]
        : ["main", "accessory"].includes(item.prescription?.block ?? "") &&
            ["strength", "isometric", "power"].includes(e.modality)
          ? r.get("duration.fit.bounds").sets_per_exercise_max[p.level]
          : e.default_dose[p.level]?.sets?.[1];
    if (max && item.sets < max) {
      const next = structuredClone(t);
      next.items[index].sets++;
      if (withinBlocks(next)) yield next;
    }
    if (phase === "existing_sets" || !("durationSeconds" in item.target))
      continue;
    const range =
      e.mobility_type === "static"
        ? stretchHoldRange(e, r, g.restrictions.population)
        : e.default_dose[p.level]?.seconds;
    const side =
      item.prescription?.perSide || e.time.per_side
        ? r.get("session.time.model").per_side_multiplier
        : 1;
    const maxSeconds =
      e.modality === "cardio"
        ? cardioWorkCap(e, p, r, g) / (item.sets * side)
        : range?.[1];
    if (maxSeconds && item.target.durationSeconds < maxSeconds) {
      const next = structuredClone(t),
        row = next.items[index];
      if ("durationSeconds" in row.target)
        row.target.durationSeconds = Math.min(
          maxSeconds,
          row.target.durationSeconds +
            Math.max(
              1,
              Math.floor((target - estimateSeconds(t, r)) / (item.sets * side)),
            ),
        );
      if (withinBlocks(next)) yield next;
    }
  }
  if (!["missing_patterns", "low_intensity"].includes(phase)) return;
  if (
    phase === "missing_patterns" &&
    !t.items.some((i) =>
      ["main", "accessory"].includes(i.prescription?.block ?? ""),
    )
  )
    return;
  const patterns = new Set(
    t.items.map((i) => r.byExercise.get(i.exerciseId)?.primary_pattern),
  );
  const used = new Set(t.items.map((i) => i.exerciseId));
  const pool =
    phase === "low_intensity"
      ? [...r.data.exercises].sort(
          (a, b) =>
            Number(b.modality === "cardio") - Number(a.modality === "cardio"),
        )
      : r.data.exercises;
  for (const e of pool) {
    if (used.has(e.id) || !isHardEligible(e, p, g, { rules: r })) continue;
    if (
      phase === "missing_patterns" &&
      (!["strength", "isometric", "power"].includes(e.modality) ||
        patterns.has(e.primary_pattern))
    )
      continue;
    if (phase === "low_intensity" && !low(e)) continue;
    const role =
      phase === "missing_patterns"
        ? "accessory"
        : e.modality === "cardio"
          ? "conditioning"
          : e.primary_pattern === "balance"
            ? "balance"
            : "mobility";
    const item = prescribe(e, p, r, g.restrictions, role, 1);
    if (e.modality === "cardio" && "durationSeconds" in item.target) {
      item.target.durationSeconds = Math.min(
        item.target.durationSeconds,
        cardioWorkCap(e, p, r, g),
      );
      item.prescription!.targetRpe = [
        Math.min(
          r.get("aerobic.intensity.rpe_scale").light_max,
          g.restrictions.maxRpe,
        ),
        Math.min(
          r.get("aerobic.intensity.rpe_scale").light_max,
          g.restrictions.maxRpe,
        ),
      ];
    }
    const next = structuredClone(t);
    insertBeforeCooldown({ ...next, slots: [] }, item);
    yield next;
  }
}
