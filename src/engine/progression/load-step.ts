import {
  derivePostpartumRisk,
  postpartumLoadStepCap,
} from "../postpartum-risk";
import { type EngineProfile } from "../contracts";

import { Rules, type Exercise } from "../data";
import { newWeek } from "../dose";
import { prescribedRepRange } from "../dose";

import { runGates } from "../gates";

export function minimumLoadStep(
  e: Exercise,
  p: EngineProfile,
  r: Rules,
  old: number,
  pct: number,
): number {
  const v = r.get("progression.load.increment");
  const lower =
    v.lower_compound.match.primary_pattern.includes(e.primary_pattern) &&
    e.nsca_class === v.lower_compound.match.nsca_class;
  const upper =
    v.upper_compound.match.primary_pattern.includes(e.primary_pattern) &&
    e.nsca_class === v.upper_compound.match.nsca_class;
  const min = lower
    ? v.lower_compound.min_kg
    : upper
      ? v.upper_compound.min_kg
      : 0;
  const max =
    p.population.kind === "older_adult"
      ? r.get("older.strength.progression").load_step_pct_max.default
      : v.max_step_pct;
  const change = Math.min(
    (old * max) / 100,
    Math.max((old * pct) / 100, min * 1000),
  );
  const risk = derivePostpartumRisk(p, r).applies;
  const bounded =
    pct > 0 && risk
      ? Math.min(change, (old * postpartumLoadStepCap(e, r)) / 100)
      : change;
  const desired = Math.max(
    0,
    Math.floor(old + (pct > 0 ? bounded : (old * pct) / 100)),
  );
  const available = (
    p as EngineProfile & { availableLoadsKg?: Record<string, number[]> }
  ).availableLoadsKg;
  const steps = (
    available?.[e.id] ??
    e.equipment_required.flatMap((k) => available?.[k] ?? [])
  )
    .map((kg) => Math.round(kg * 1000))
    .sort((a, b) => a - b);
  if (!steps.length) return old;
  const eligible = steps.filter((n) => n <= desired && n > 0);
  const rounded =
    pct > 0 && (newWeek(p, r) || risk)
      ? eligible.find((n) => n > old)
      : eligible.at(-1);
  return rounded !== undefined && (pct > 0 ? rounded > old : rounded < old)
    ? rounded
    : old;
}
export function repBounds(
  e: Exercise,
  p: EngineProfile,
  r: Rules,
  role?: string,
): number[] {
  return prescribedRepRange(
    e,
    p,
    r,
    runGates(p, r).restrictions,
    role === "accessory" ? "accessory" : "main",
  );
}
