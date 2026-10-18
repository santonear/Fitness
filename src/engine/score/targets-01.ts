import { mean, countSatisfaction } from "./math";
import { safetyBlockTimes } from "./batch-helpers";
import { resistance, muscles, exposure, goal } from "./helpers";
import { type RuleValue } from "../data";
import { type Satisfaction } from "./types";
export const targetGroup01: Record<string, Satisfaction> = {
  "safety.session.warmup_cooldown": (c) => {
    const sessions = c.f.sessions.filter((t) =>
      t.items.some(
        (i) =>
          i.prescription?.structure === "circuit" ||
          (i.prescription?.block === "conditioning" &&
            (i.prescription.targetRpe?.[0] ?? 0) >=
              c.r.get("aerobic.intensity.rpe_scale").moderate[0]),
      ),
    );
    return sessions.length
      ? mean(
          sessions.map((t) => {
            const time = safetyBlockTimes(c, t);
            return mean([
              countSatisfaction(time.warmup, c.v.warmup_min_minutes * 60),
              countSatisfaction(time.cooldown, c.v.cooldown_min_minutes * 60),
            ]);
          }),
        )
      : null;
  },
  "goal.floor.all": (c) => {
    if (
      !resistance(c) ||
      c.v.exempt.some(
        (v: RuleValue) =>
          v.goal === c.p.goal ||
          (v.session_minutes_max !== undefined &&
            c.p.sessionMinutes <= v.session_minutes_max) ||
          (v.new_user_week === Math.floor(c.p.trainingAgeWeeks) + 1 &&
            c.p.level === "beginner"),
      )
    )
      return null;
    const work = c.f.items.filter((i) =>
      ["main", "accessory"].includes(i.prescription?.block ?? ""),
    );
    return mean([
      countSatisfaction(c.f.rt.length, c.v.rt_days_week_min),
      ...muscles(c).map((g) =>
        countSatisfaction(exposure(c, g), c.v.all_major_muscles_per_week_min),
      ),
      mean(
        work.map((i) => countSatisfaction(i.sets, c.v.sets_per_exercise_min)),
      ),
    ]);
  },
  "goal.aerobic.baseline": (c) =>
    countSatisfaction(c.f.aerobic, c.v.aerobic_moderate_equiv_min_week.target),
  "goal.params.start_moving": goal,
};
