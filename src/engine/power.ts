import type { EngineProfile, EnginePrescription } from "./contracts";
import type { Rules, Exercise } from "./data";
export function powerBranch(e: Exercise, p: EngineProfile, r: Rules) {
  const rule = r.get("dose.power"),
    branches = rule.load_branches;
  if (e.modality !== "power" && !rule.patterns.includes(e.primary_pattern))
    return;
  if (
    e.equipment_required.length > 0 &&
    e.equipment_required.every((k) =>
      branches.bodyweight.equipment_required_only.includes(k),
    )
  )
    return { kind: "bodyweight" as const };
  const evidence = p.powerOneRm?.[e.id];
  if (evidence && branches.known_1rm.evidence_sources.includes(evidence.source))
    return { kind: "known_1rm" as const, evidence };
  return { kind: "unknown_1rm" as const };
}
export function powerLoad(
  e: Exercise,
  p: EngineProfile,
  r: Rules,
  reps: number,
):
  | {
      target:
        | { metricType: "reps"; reps: number }
        | { metricType: "reps_load"; reps: number; loadGrams: number };
      prescription: Partial<EnginePrescription>;
    }
  | undefined {
  const branch = powerBranch(e, p, r);
  if (!branch) return;
  if (branch.kind === "bodyweight")
    return { target: { metricType: "reps", reps }, prescription: {} };
  if (branch.kind === "known_1rm") {
    const range = r.get("dose.power").load_branches.known_1rm.load_pct_1rm;
    return {
      target: {
        metricType: "reps_load",
        reps,
        loadGrams: Math.round(
          ((branch.evidence.kg * (range[0] + range[1])) / 2) * 10,
        ),
      },
      prescription: {},
    };
  }
  const source = r.get("dose.power").load_branches.unknown_1rm,
    copy = r.data.copy[source.stop_copy],
    load = r.data.copy[`meta.copy.load_${source.default_band}`];
  return {
    target: { metricType: "reps", reps },
    prescription: {
      loadBand: source.default_band,
      loadDescription: { zh: load.zh, en: load.en },
      safetyCue: { zh: copy.zh, en: copy.en },
    },
  };
}
/** Branch 3 is audited independently: no numeric load, approved band/cue, source RIR. */
export function powerLoadIssue(
  e: Exercise,
  item: { target: Record<string, unknown>; prescription?: EnginePrescription },
  p: EngineProfile,
  r: Rules,
): string | undefined {
  const branch = powerBranch(e, p, r);
  if (!branch) return;
  const target = item.target,
    pres = item.prescription,
    rule = r.get("dose.power");
  if (
    e.difficulty >= rule.exclude_difficulty_min ||
    e.flags.some((f) => rule.exclude_flags.includes(f))
  )
    return "power_skill";
  if (branch.kind === "bodyweight")
    return target.metricType !== "reps" ? "power_bodyweight_load" : undefined;
  if (branch.kind === "known_1rm") {
    const percent = Number(target.loadGrams) / 10 / branch.evidence.kg,
      range = rule.load_branches.known_1rm.load_pct_1rm;
    return target.metricType !== "reps_load" ||
      !Number.isFinite(percent) ||
      percent < range[0] ||
      percent > range[1]
      ? "power_load_percent"
      : undefined;
  }
  const source = rule.load_branches.unknown_1rm,
    copy = r.data.copy[source.stop_copy];
  if (
    target.metricType !== "reps" ||
    "loadGrams" in target ||
    !pres ||
    !source.load_bands.includes(pres.loadBand) ||
    pres.rir[0] < source.rir_min ||
    pres.rir[1] < source.rir_min ||
    pres.safetyCue?.zh !== copy.zh ||
    pres.safetyCue?.en !== copy.en
  )
    return "power_unknown_load";
}
