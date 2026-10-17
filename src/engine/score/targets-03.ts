import { goal, resistance, muscles, exposure } from "./helpers";
import { mean, intervalSatisfaction, countSatisfaction } from "./math";
import { type Satisfaction } from "./types";
export const targetGroup03: Record<string, Satisfaction> = {
  "goal.params.mobility": goal,
  "goal.interference.guard": (c) =>
    c.f.hardAerobic
      ? mean([
          intervalSatisfaction(
            c.f.hardAerobic,
            0,
            c.v.hard_aerobic_min_week_max,
          ),
          intervalSatisfaction(
            c.f.sessions.filter((t) =>
              t.items.some(
                (i) =>
                  i.prescription?.block === "conditioning" &&
                  (i.prescription.targetRpe?.[0] ?? 0) >=
                    c.r.get("aerobic.intensity.rpe_scale").vigorous[0],
              ),
            ).length,
            0,
            c.v.hard_aerobic_sessions_week_max,
          ),
        ])
      : null,
  "week.coverage.patterns": (c) =>
    !resistance(c) || c.f.rt.length < c.v.applies_when.rt_days_min
      ? null
      : mean(
          Object.values(c.v.weekly_min_exposures).flatMap((entry: any) =>
            Array.isArray(entry)
              ? entry.map((p) =>
                  Number((c.f.primaryPatterns ?? c.f.patterns).has(p)),
                )
              : [
                  countSatisfaction(
                    c.f.sessionPatterns
                      ? c.f.sessionPatterns.filter((ps) =>
                          entry.patterns.some((pattern: string) =>
                            ps.has(pattern),
                          ),
                        ).length
                      : c.f.rt.filter((t) =>
                          t.items.some((i) =>
                            entry.patterns.includes(
                              c.r.byExercise.get(i.exerciseId)?.primary_pattern,
                            ),
                          ),
                        ).length,
                    entry.min,
                  ),
                ],
          ),
        ),
  "week.frequency.per_muscle": (c) =>
    !resistance(c)
      ? null
      : mean(
          muscles(c).map((g) =>
            countSatisfaction(
              exposure(c, g),
              c.p.daysPerWeek <= 1 ? c.v.min : c.v.default_exposures_per_week,
            ),
          ),
        ),
};
