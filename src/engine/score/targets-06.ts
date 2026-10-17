import { resistance, weekly, direct } from "./helpers";
import { volumeLimits } from "../dose";
import { mean, intervalSatisfaction, countSatisfaction } from "./math";
import { Rules } from "../data";
import { type Satisfaction } from "./types";
export const targetGroup06: Record<string, Satisfaction> = {
  "dose.sets_week.goal_matrix": (c) =>
    resistance(c)
      ? weekly(c, volumeLimits(c.p, c.r).min, volumeLimits(c.p, c.r).max)
      : null,
  "dose.sets_exercise": (c) => {
    const items = c.f.items.filter((i) =>
        ["main", "accessory"].includes(i.prescription?.block ?? ""),
      ),
      min =
        c.p.sessionMinutes <= c.r.get("session.durations.allowed").minutes[0] ||
        (c.p.level === "beginner" && Math.floor(c.p.trainingAgeWeeks) === 0) ||
        c.p.goal === "start_moving"
          ? 1
          : c.v.min;
    return items.length
      ? mean(
          items.map((i) =>
            intervalSatisfaction(i.sets, min, c.v.max[c.p.level]),
          ),
        )
      : null;
  },
  "select.unilateral.weekly": (c) =>
    resistance(c)
      ? countSatisfaction(
          c.f.items.filter((i) => {
            const e = c.r.byExercise.get(i.exerciseId);
            return (
              e &&
              (c.v.patterns.includes(e.primary_pattern) ||
                (e.laterality === c.v.or_laterality &&
                  c.r
                    .get("duration.fit.bounds")
                    .lower_patterns.includes(e.primary_pattern)))
            );
          }).length,
          c.v.min_unilateral_lower_exercises_per_week,
        )
      : null,
  "balance.week.pull_push": (c) => {
    const owned = new Set(["none", "yoga-mat-optional", ...c.p.equipment]),
      pullPossible = c.v.pull_patterns.some(
        (pattern: Parameters<Rules["pattern"]>[0]) =>
          c.r
            .pattern(pattern)
            .some((e) =>
              e.equipment_required.every(
                (required) =>
                  owned.has(required) ||
                  (e.equipment_alternatives[required] ?? []).some((alt) =>
                    owned.has(alt),
                  ),
              ),
            ),
      );
    if (!pullPossible) return null;
    const push = direct(c, c.v.push_patterns);
    return push
      ? intervalSatisfaction(
          direct(c, c.v.pull_patterns) / push,
          c.v.min,
          c.v.max,
        )
      : null;
  },
};
