import { type Satisfaction } from "./types";
import { targetGroup01 } from "./targets-01";
import { targetGroup02 } from "./targets-02";
import { targetGroup03 } from "./targets-03";
import { targetGroup04 } from "./targets-04";
import { targetGroup05 } from "./targets-05";
import { targetGroup06 } from "./targets-06";
import { targetGroup07 } from "./targets-07";
import { targetGroup08 } from "./targets-08";
import { targetGroup09 } from "./targets-09";
import { targetGroup10 } from "./targets-10";
import { resistance, weekly } from "./helpers";
import { intervalSatisfaction, mean, countSatisfaction } from "./math";
import { sessionStrengthRoles, goalStrengthSafety } from "./batch-helpers";
import { goalItemSatisfaction } from "./goal-items";
import { effectiveGoalRole } from "../dose";

/** Each registry entry states applicability through null. History-dependent facts stay unmeasured. */
export const targetSatisfactions: Record<string, Satisfaction> = {
  ...targetGroup01,
  ...targetGroup02,
  ...targetGroup03,
  ...targetGroup04,
  ...targetGroup05,
  ...targetGroup06,
  ...targetGroup07,
  ...targetGroup08,
  ...targetGroup09,
  ...targetGroup10,
};

for (const name of [
  "start_moving",
  "health",
  "fat_loss",
  "muscle",
  "strength",
  "mobility",
])
  targetSatisfactions[`goal.params.${name}`] = (c) => {
    if (c.p.goal !== name || !resistance(c)) return null;
    const goal = c.v,
      work = c.f.items.filter((i) =>
        ["main", "accessory"].includes(i.prescription?.block ?? ""),
      ),
      values = [
        intervalSatisfaction(
          c.f.rt.length,
          goal.rt_sessions_week.min,
          goal.rt_sessions_week.max,
        ),
      ],
      roles =
        name === "strength"
          ? new Map(c.f.rt.flatMap((t) => [...sessionStrengthRoles(c, t)]))
          : undefined,
      strengthSafety = name === "strength" ? goalStrengthSafety(c) : undefined;
    for (const [category, bounds] of Object.entries(goal.time_share)) {
      const [lo, hi] = bounds as number[],
        seconds =
          category === "resistance"
            ? c.f.resistance
            : category === "aerobic"
              ? (c.f.conditioningSeconds ??
                c.f.items
                  .filter(
                    (i) =>
                      i.prescription?.block === "conditioning" &&
                      c.r.byExercise.get(i.exerciseId)?.modality === "cardio",
                  )
                  .reduce(
                    (n, i) =>
                      n +
                      ("durationSeconds" in i.target
                        ? i.sets * i.target.durationSeconds
                        : 0),
                    0,
                  ))
              : c.f.mobility;
      values.push(
        c.f.seconds ? intervalSatisfaction(seconds / c.f.seconds, lo, hi) : 0,
      );
    }
    values.push(
      weekly(c, goal.sets_per_muscle_week.min, goal.sets_per_muscle_week.max),
    );
    values.push(
      mean(
        work.map((i) =>
          goalItemSatisfaction(c, i, name, goal, roles?.get(i), strengthSafety),
        ),
      ),
    );
    const aerobic = goal.aerobic_moderate_equiv_min_week;
    if (aerobic) {
      const source = aerobic.target ?? aerobic.week1;
      values.push(
        countSatisfaction(
          c.f.aerobic,
          Array.isArray(source) ? source[0] : source,
        ),
      );
    }
    if (name === "strength") {
      const main = work.filter(
          (i) => effectiveGoalRole(i, c.p, c.r) === "main",
        ),
        totals: Record<string, number> = {};
      for (const i of main)
        totals[i.exerciseId] = (totals[i.exerciseId] ?? 0) + i.sets;
      values.push(
        mean(
          c.f.rt.map((t) =>
            intervalSatisfaction(
              t.items.filter(
                (i) =>
                  ["main", "accessory"].includes(i.prescription?.block ?? "") &&
                  effectiveGoalRole(i, c.p, c.r) === "main",
              ).length,
              goal.main_lifts_per_session.min,
              goal.main_lifts_per_session.max,
            ),
          ),
        ),
        mean(
          main.map((i) =>
            intervalSatisfaction(
              i.sets,
              goal.main_lift.sets_per_session[0],
              goal.main_lift.sets_per_session[1],
            ),
          ),
        ),
        mean(
          Object.values(totals).map((n) =>
            intervalSatisfaction(
              n,
              0,
              goal.weekly_hard_sets_per_main_lift_useful_max,
            ),
          ),
        ),
      );
    }
    if (name === "health" || name === "mobility") {
      const frequency = goal.mobility_sessions_week ?? goal.mobility_days_week;
      values.push(
        countSatisfaction(
          c.f.sessions.filter((t) =>
            t.items.some(
              (i) =>
                ["mobility", "cooldown"].includes(
                  i.prescription?.block ?? "",
                ) && c.r.byExercise.get(i.exerciseId)?.modality === "mobility",
            ),
          ).length,
          frequency.min,
        ),
      );
    }
    return mean(values);
  };

/** Registration coverage is independent of per-plan applicability and quality denominator. */
export const targetRuleIds = Object.keys(targetSatisfactions);

/** Applicability audit, distinct from the numeric score for a particular plan. */
export const targetRuleAssessments = targetRuleIds.map((ruleId) => ({
  ruleId,
  evaluation:
    ruleId === "variety.rotation" ? "unmeasured-history" : "plan-facts",
  partial:
    ruleId === "select.unilateral.weekly"
      ? "binary integer-count target; no valid partial count at authored minimum 1"
      : ruleId === "variety.rotation"
        ? "unavailable without real prior-plan history"
        : "continuous or multi-component",
  evidence: "tests/unit/engine/d-target-matrix.test.ts",
}));
