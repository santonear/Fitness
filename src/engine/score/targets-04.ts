import { muscles, resistance, older } from "./helpers";
import { volume } from "../dose";
import { countSatisfaction, mean, intervalSatisfaction } from "./math";
import { type Satisfaction } from "./types";
export const targetGroup04: Record<string, Satisfaction> = {
  "week.recovery.spacing": (c) => {
    if (
      !c.plan.preferredDays ||
      c.plan.preferredDays.length !== c.f.sessions.length ||
      c.f.rt.length < 2
    )
      return null;
    const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    const gaps: number[] = [];
    for (const g of muscles(c)) {
      const positions = c.f.sessions
        .flatMap((t, i) =>
          ((c.f.mainSetsBySession?.get(t) ??
            volume(
              t.items.filter((x) => x.prescription?.block === "main"),
              c.r,
            ))[g] ?? 0) > 0
            ? [days.indexOf(c.plan.preferredDays![i])]
            : [],
        )
        .sort((a, b) => a - b);
      if (positions.length > 1)
        for (let i = 0; i < positions.length; i++)
          gaps.push(
            countSatisfaction(
              ((positions[(i + 1) % positions.length] - positions[i] + 7) % 7) *
                24,
              c.v.same_muscle_heavy_min_hours,
            ),
          );
    }
    return gaps.length ? mean(gaps) : null;
  },
  "session.warmup.general": (c) =>
    c.p.sessionMinutes < c.v.include_when.session_minutes_min
      ? null
      : mean(
          c.f.sessions.map((t) => {
            const key = c.r
                .get("session.durations.allowed")
                .minutes.filter((n: number) => n <= c.p.sessionMinutes)
                .at(-1),
              range = c.v.seconds_by_duration[key],
              valid = t.items.filter((i) => {
                const e = c.r.byExercise.get(i.exerciseId),
                  rpe = i.prescription?.targetRpe;
                return (
                  i.prescription?.block === "warmup" &&
                  e?.modality === "cardio" &&
                  e.use.some((use) => c.v.use.includes(use)) &&
                  !e.flags.some((flag) => c.v.exclude_flags.includes(flag)) &&
                  rpe &&
                  rpe[0] >= c.v.intensity_rpe[0] &&
                  rpe[1] <= c.v.intensity_rpe[1]
                );
              });
            return Array.isArray(range)
              ? intervalSatisfaction(
                  valid.reduce(
                    (n, i) =>
                      n +
                      ("durationSeconds" in i.target
                        ? i.sets * i.target.durationSeconds
                        : 0),
                    0,
                  ),
                  range[0],
                  range[1],
                )
              : 0;
          }),
        ),
  "session.warmup.dynamic": (c) =>
    !resistance(c)
      ? null
      : mean(
          c.f.rt.map((t) => {
            const warm = t.items.filter(
                (i) =>
                  i.prescription?.block === "warmup" &&
                  c.r.byExercise.get(i.exerciseId)?.mobility_type === "dynamic",
              ),
              work = t.items
                .filter((i) =>
                  ["main", "accessory"].includes(i.prescription?.block ?? ""),
                )
                .map((i) => c.r.byExercise.get(i.exerciseId))
                .filter((e) => !!e),
              seconds = warm.reduce(
                (n, i) =>
                  n +
                  ("durationSeconds" in i.target
                    ? i.sets * i.target.durationSeconds
                    : 0),
                0,
              ),
              matches = warm.map((i) => {
                const e = c.r.byExercise.get(i.exerciseId)!;
                return Number(
                  work.some(
                    (w) =>
                      (e.bodyPart && e.bodyPart === w.bodyPart) ||
                      (e.primaryMuscles ?? []).some((m) =>
                        w.primaryMuscles?.includes(m),
                      ),
                  ),
                );
              });
            return mean([
              intervalSatisfaction(
                warm.length,
                c.v.exercises[0],
                c.v.exercises[1],
              ),
              intervalSatisfaction(seconds, c.v.seconds[0], c.v.seconds[1]),
              mean(matches),
            ]);
          }),
        ),
  "session.warmup.balance_older": (c) =>
    older(c, (x) =>
      x.p.sessionMinutes < x.v.min_session_minutes
        ? null
        : mean(
            x.f.sessions.map((t) =>
              intervalSatisfaction(
                t.items
                  .filter(
                    (i) =>
                      i.prescription?.block === "warmup" &&
                      x.r.byExercise.get(i.exerciseId)?.primary_pattern ===
                        "balance",
                  )
                  .reduce(
                    (n, i) =>
                      n +
                      ("durationSeconds" in i.target
                        ? i.sets *
                          i.target.durationSeconds *
                          (i.prescription?.perSide ||
                          x.r.byExercise.get(i.exerciseId)?.time.per_side
                            ? x.r.get("session.time.model").per_side_multiplier
                            : 1)
                        : 0),
                    0,
                  ),
                x.v.add_slot.seconds[0],
                x.v.add_slot.seconds[1],
              ),
            ),
          ),
    ),
};
