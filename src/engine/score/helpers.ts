import { type Context, type Satisfaction } from "./types";
import { volume, allocatedVolumeCapacity } from "../dose";
import { mean, intervalSatisfaction } from "./math";
import { type EngineProfile } from "../contracts";
import { Rules } from "../data";
import { runGates } from "../gates";

export const muscles = (c: Context) =>
  c.r.get("dose.muscle_groups").target_groups as string[];

export const exposure = (c: Context, g: string) =>
  c.f.exposures
    ? (c.f.exposures[g] ?? 0)
    : c.f.rt.filter(
        (t) =>
          (volume(
            t.items.filter((i) =>
              ["main", "accessory"].includes(i.prescription?.block ?? ""),
            ),
            c.r,
          )[g] ?? 0) > 0,
      ).length;

export const weekly = (c: Context, lo: number, hi: number) =>
  mean(muscles(c).map((g) => intervalSatisfaction(c.f.sets[g] ?? 0, lo, hi)));

export const capacityCache = new WeakMap<
  EngineProfile,
  {
    rules: Rules;
    signature: string;
    value: ReturnType<typeof allocatedVolumeCapacity>;
  }
>();

export function feasibleWeekly(c: Context): number {
  const signature = JSON.stringify(c.p),
    cached = capacityCache.get(c.p),
    value =
      cached?.rules === c.r && cached.signature === signature
        ? cached.value
        : allocatedVolumeCapacity(c.p, runGates(c.p, c.r), c.r);
  capacityCache.set(c.p, { rules: c.r, signature, value });
  return mean(
    muscles(c).map((group) => {
      const capacity = value.byMuscle[group];
      return intervalSatisfaction(
        c.f.sets[group] ?? 0,
        capacity !== null && capacity > 0
          ? Math.min(c.v.default_min, capacity)
          : c.v.default_min,
        c.v.default_max,
      );
    }),
  );
}

export const older = (c: Context, fn: Satisfaction) =>
  c.p.population.kind === "older_adult" ? fn(c) : null;

export const resistance = (c: Context) =>
  !(c.p.population.kind === "postpartum" && !c.p.population.cleared);

export const direct = (c: Context, patterns: string[]) =>
  c.f.directSets
    ? patterns.reduce((n, pattern) => n + (c.f.directSets![pattern] ?? 0), 0)
    : c.f.items.reduce(
        (n, i) =>
          n +
          (patterns.includes(
            c.r.byExercise.get(i.exerciseId)?.primary_pattern ?? "",
          ) && ["main", "accessory"].includes(i.prescription?.block ?? "")
            ? i.sets
            : 0),
        0,
      );

export const goal: Satisfaction = (c) => {
  if (c.p.goal !== c.v.goal) return null;
  return 0;
};
