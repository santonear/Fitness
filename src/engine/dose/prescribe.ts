import { ownedEquipment } from "../equipment";
import { type Exercise, Rules, midpoint, stretchHoldRange } from "../data";
import { type EngineProfile, type EnginePrescription } from "../contracts";
import { type SafetyState } from "../gates/strength-scoring";
import { type Item } from "./types";
import {
  powerExercise,
  prescribedRepRange,
  straightRestFloor,
  mobilityTempo,
} from "./rep-ranges";
import { newWeek } from "./limits";
import { powerBranch, powerLoad } from "../power";
import { type PlannedItem } from "../../domain/v8/contracts";

export function prescribe(
  e: Exercise,
  p: EngineProfile,
  r: Rules,
  s: SafetyState,
  block: EnginePrescription["block"] = "main",
  setsOverride?: number,
): Item {
  const goal = r.get(`goal.params.${p.goal}`);
  const power = powerExercise(e, r) ? r.get("dose.power") : undefined;
  const defaultDose = e.default_dose[p.level];
  const limits = r.get("dose.sets_exercise");
  const week = newWeek(p, r);
  let sets = setsOverride ?? midpoint(defaultDose?.sets, limits.min);
  sets = Math.min(sets, limits.max[p.level]);
  if (p.goal === "strength" && block === "main")
    sets = Math.min(sets, goal.main_lift.sets_per_session[1]);
  if (p.goal === "start_moving" && ["main", "accessory"].includes(block))
    sets = Math.min(sets, goal.sets_per_exercise.max);
  if (week && ["strength", "isometric", "power"].includes(e.modality))
    sets = Math.min(
      sets,
      Array.isArray(week.sets_per_exercise)
        ? week.sets_per_exercise[1]
        : week.sets_per_exercise,
    );
  if (s.population === "older_adult" && ["main", "accessory"].includes(block)) {
    const dose = r.get("older.strength.dose");
    sets = Math.min(sets, dose.sets_per_exercise.max);
    if (
      s.user.balance_cautious ||
      s.user.walking_aid ||
      s.user.activity_status === "inactive"
    )
      sets = Math.min(sets, r.get("older.strength.low_start").start.sets);
  }
  const range = prescribedRepRange(e, p, r, s, block);
  if (power) sets = Math.max(power.sets[0], Math.min(sets, power.sets[1]));
  let rir: number[] = power
    ? power.rir
    : goal.rir
      ? [goal.rir.min, goal.rir.max]
      : (goal.main_lift?.rir ?? r.get("dose.rir.targets")[p.level]);
  const overrides = r.get("goal.rir.level_override");
  const rirMin = Math.max(
    overrides[p.level].rir_min,
    s.rirMin,
    week?.rir_min ?? week?.rir?.[0] ?? 0,
    e.flags.includes("heavy_axial_load") ? overrides.heavy_compound_rir_min : 0,
  );
  rir = [Math.max(rir[0], rirMin), Math.max(rir[1], rirMin)];
  if (week?.rir) {
    const lower = Math.max(rirMin, week.rir[0]),
      upper = Math.max(lower, week.rir[1]);
    rir = [
      Math.max(lower, Math.min(rir[0], upper)),
      Math.max(lower, Math.min(rir[1], upper)),
    ];
  }
  let rest = midpoint(
    r.get("dose.rest.table")[
      e.nsca_class === "isolation" ? "isolation" : "other_compound"
    ]?.default,
    0,
  );
  if (power && powerBranch(e, p, r)?.kind === "unknown_1rm")
    rir = [
      Math.max(rir[0], power.load_branches.unknown_1rm.rir_min),
      Math.max(rir[1], power.load_branches.unknown_1rm.rir_min),
    ];
  if (power)
    rest = midpoint(
      r.get("dose.rest.table")[power.rest_ref.split(".").at(-1)].default,
      rest,
    );
  if (e.modality === "isometric")
    rest = midpoint(r.get("dose.rest.table").isometric_core.default, rest);
  if (p.goal === "strength" && block === "main" && p.level === "intermediate")
    rest = Math.max(
      rest,
      r.get("dose.rest.table").intermediate_strength_main.min,
    );
  const shortCapacity = r
    .get("duration.capacity.table")
    .sessions.find((row: { ramp_s: number }) => row.ramp_s > 0).minutes;
  const holds = r.get("dose.isometric")[p.level].hold_s;
  let seconds =
    e.modality === "mobility"
      ? r.get("dose.stretch").hold_s.default
      : e.modality === "isometric"
        ? p.sessionMinutes <= shortCapacity
          ? holds[0]
          : midpoint(holds, 0)
        : midpoint(defaultDose?.seconds ?? undefined, 0);
  if (e.stretch_hold_s) {
    const range = stretchHoldRange(e, r, s.population);
    if (range) seconds = Math.max(range[0], Math.min(range[1], seconds));
  }
  const model = r.get("duration.capacity.table").model_params;
  const singleLeg =
    e.time.per_side &&
    ["squat", "lunge", "hinge", "isolation_lower"].includes(e.primary_pattern);
  const modelReps = singleLeg
    ? model.single_leg_reps_per_side
    : e.nsca_class === "isolation"
      ? model.isolation_reps
      : model.compound_reps;
  const reps = power
    ? Math.min(
        midpoint(range, range[0]),
        Math.floor(power.total_reps_per_exercise_max / sets),
      )
    : p.goal === "strength" && block === "main"
      ? midpoint(range, range[0])
      : p.sessionMinutes <= shortCapacity
        ? range[0]
        : Math.max(range[0], Math.min(range[1], modelReps));
  let target: PlannedItem["target"];
  if (power)
    target =
      e.metricType === "reps_load"
        ? {
            metricType: "reps_load",
            reps,
            loadGrams: Math.round(
              (p.equipmentLoadsKg?.[e.id] ??
                e.equipment_required
                  .flatMap((k) => [k, ...(e.equipment_alternatives[k] ?? [])])
                  .map((k) => p.equipmentLoadsKg?.[k])
                  .find((v) => v !== undefined) ??
                0) * 1000,
            ),
          }
        : { metricType: "reps", reps };
  else if (
    e.metricType === "duration" ||
    e.metricType === "duration_distance" ||
    e.modality === "mobility" ||
    e.modality === "isometric" ||
    e.modality === "cardio"
  )
    target = {
      metricType:
        e.metricType === "duration_distance" ? "duration_distance" : "duration",
      durationSeconds:
        seconds ||
        r.get("duration.block.cardio").continuous_s?.prescribed_min ||
        60,
    };
  else if (e.metricType === "reps_load")
    target = {
      metricType: "reps_load",
      reps,
      loadGrams: Math.round(
        (p.equipmentLoadsKg?.[e.id] ??
          e.equipment_required
            .flatMap((k) => [k, ...(e.equipment_alternatives[k] ?? [])])
            .map((k) => p.equipmentLoadsKg?.[k])
            .find((v) => v !== undefined) ??
          0) * 1000,
      ),
    };
  else target = { metricType: "reps", reps };
  const prescription: EnginePrescription = {
    pattern: e.primary_pattern,
    block,
    rir: [rir[0], rir[1]],
    restSeconds: rest,
    structure: "straight",
    perSide: e.time.per_side,
    setupSeconds: e.time.setup_s,
    secondsPerRep:
      e.time.s_per_rep ?? r.get("duration.rep.seconds").default_if_unknown,
  };
  if (
    ["main", "accessory"].includes(block) &&
    e.modality === "strength" &&
    sets > 1
  )
    prescription.restSeconds = Math.max(
      prescription.restSeconds,
      straightRestFloor(e, p, r, block),
    );
  const powerDose = powerLoad(e, p, r, reps);
  if (powerDose) {
    target = powerDose.target;
    Object.assign(prescription, powerDose.prescription);
  }
  Object.assign(prescription, mobilityTempo(e, p, r, block, target));
  if (
    e.modality === "cardio" &&
    s.population === "postpartum" &&
    s.phase === 1
  ) {
    const ref = r.get("postpartum.phase1").walking_intensity_ref,
      cap = Math.min(s.maxRpe, r.get(ref.rule_id)[ref.field]);
    prescription.targetRpe = [cap, cap];
  }
  if (e.modality === "cardio" && s.phase !== 1) {
    const intensity = r.get("aerobic.intensity.rpe_scale"),
      maxRpe = Math.min(
        s.maxRpe,
        s.user.clearance_state === "required"
          ? r.get("safety.clearance.restricted_mode").max_rpe_0_10
          : Infinity,
      );
    prescription.targetRpe =
      block === "conditioning"
        ? [
            Math.min(intensity.moderate[0], maxRpe),
            Math.min(intensity.moderate[1], maxRpe),
          ]
        : [
            Math.min(intensity.light_max, maxRpe),
            Math.min(intensity.light_max, maxRpe),
          ];
  }
  if (target.metricType === "reps_load" && target.loadGrams === 0) {
    prescription.loadBand =
      block === "main" && p.level === "intermediate" ? "medium" : "light";
    const key = `meta.copy.load_${prescription.loadBand}`;
    const copy = r.data.copy[key];
    if (copy) prescription.loadDescription = { zh: copy.zh, en: copy.en };
    target = { metricType: "reps", reps: target.reps };
  }
  for (const joint of p.cautions)
    if (
      joint === "shoulder" &&
      ["push_horizontal", "push_vertical"].includes(e.primary_pattern)
    ) {
      const v = r.get("caution.shoulder.filter").level_1.modify[0];
      sets = Math.max(v.sets_min, sets + v.sets_delta);
    }
  if (power) sets = Math.max(power.sets[0], Math.min(sets, power.sets[1]));
  if (!power && (block === "cooldown" || block === "warmup")) sets = 1;
  const owned = ownedEquipment(p),
    required = e.equipment_required[0],
    equipment = !required
      ? "none"
      : owned.has(required) || required === "none"
        ? required
        : ((e.equipment_alternatives[required] ?? []).find((k) =>
            owned.has(k),
          ) ?? required);
  return {
    exerciseId: e.id,
    equipment,
    sets: Math.max(1, sets),
    target,
    prescription,
  };
}
