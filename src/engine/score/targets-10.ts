import { mean, countSatisfaction, clamp } from "./math";
import { estimatedSeconds } from "../fit/elapsed-time";
import { type Satisfaction } from "./types";
export const targetGroup10: Record<string, Satisfaction> = {
  "postpartum.weekly_target": (c) =>
    c.p.population.kind === "postpartum" && c.p.population.cleared
      ? mean([
          countSatisfaction(c.f.aerobic, c.v.moderate_min_week_min),
          countSatisfaction(c.f.rt.length, c.v.strength_days_per_week),
        ])
      : null,
  "duration.fit.tolerance": (c) =>
    mean(
      c.f.sessions.map((t) => {
        const ratio =
            (c.f.sessionSeconds?.get(t) ?? estimatedSeconds(t, c.r)) /
            ((t.targetMinutes ?? c.p.sessionMinutes) * 60),
          [lo, hi] = c.v.band,
          [zeroLo, zeroHi] = c.v.zero_score_band;
        return ratio < lo
          ? clamp((ratio - zeroLo) / (lo - zeroLo))
          : ratio > hi
            ? clamp((zeroHi - ratio) / (zeroHi - hi))
            : 1;
      }),
    ),
};
