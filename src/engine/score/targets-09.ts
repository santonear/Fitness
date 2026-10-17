import { older, muscles } from "./helpers";
import { countSatisfaction, mean } from "./math";
import { type Satisfaction } from "./types";
export const targetGroup09: Record<string, Satisfaction> = {
  "older.week.multicomponent": (c) =>
    older(c, (x) =>
      countSatisfaction(
        x.f.balanceDays,
        Math.min(x.p.daysPerWeek, x.v.balance_functional_days_per_week.min),
      ),
    ),
  "older.week.flexibility": (c) =>
    older(c, (x) =>
      mean(
        muscles(x).map((g) =>
          countSatisfaction(
            x.f.sessions.filter(
              (t) =>
                t.items
                  .filter(
                    (i) =>
                      i.prescription?.block === "cooldown" &&
                      x.r.byExercise.get(i.exerciseId)?.mobility_type ===
                        "static" &&
                      x.r.byExercise
                        .get(i.exerciseId)
                        ?.stretch_targets?.includes(g),
                  )
                  .reduce(
                    (n, i) =>
                      n +
                      ("durationSeconds" in i.target
                        ? i.sets * i.target.durationSeconds
                        : 0),
                    0,
                  ) >= x.v.seconds_per_muscle_group_total,
            ).length,
            x.v.days_per_week.min,
          ),
        ),
      ),
    ),
  "older.template.balance_required": (c) =>
    older(c, (x) =>
      countSatisfaction(
        x.f.balanceDays,
        Math.min(x.p.daysPerWeek, x.v.hard_balance_days_min),
      ),
    ),
  "pregnancy.week.target": (c) =>
    c.p.population.kind === "pregnant"
      ? mean([
          countSatisfaction(c.f.aerobic, c.v.moderate_min_week_min),
          countSatisfaction(c.f.sessions.length, c.v.days_per_week_min),
          countSatisfaction(c.f.rt.length, c.v.strength_days_per_week_default),
        ])
      : null,
};
