import { type SessionDraft } from "../contracts";
import { Rules } from "../data";
import { type Item } from "./types";

/** Chapter 13 elapsed time: work, sides, setup, rests and grouped transitions. */
export function estimateSeconds(
  session: Pick<SessionDraft, "items">,
  r = new Rules(),
): number {
  const seen = new Set<string>(),
    transition = r.get("duration.transition.setup"),
    overhead = r.get("duration.set.overhead");
  let total = 0;
  const work = (i: Item) => {
    const e = r.byExercise.get(i.exerciseId);
    if (!e) return 0;
    const side =
      i.prescription?.perSide || e.time.per_side
        ? r.get("session.time.model").per_side_multiplier
        : 1;
    return (
      ("durationSeconds" in i.target
        ? i.target.durationSeconds
        : i.target.reps *
          (i.prescription?.secondsPerRep ??
            e.time.s_per_rep ??
            r.get("duration.rep.seconds").default_if_unknown)) *
        side +
      (e.modality === "mobility"
        ? overhead.mobility_overhead_s_per_set
        : overhead.overhead_s_per_set)
    );
  };
  for (const i of session.items) {
    const e = r.byExercise.get(i.exerciseId);
    if (!e) continue;
    const p = i.prescription;
    if (["warmup", "cooldown", "mobility"].includes(p?.block ?? "")) {
      total += i.sets * work(i);
      continue;
    }
    const grouped = p?.structure && p.structure !== "straight" && p.groupId,
      key = grouped ? `${p.structure}:${p.groupId}` : undefined;
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    const members = grouped
      ? session.items.filter(
          (m) =>
            m.prescription?.groupId === p.groupId &&
            m.prescription?.structure === p.structure,
        )
      : [i];
    if (
      members.length === 1 &&
      e.modality === "cardio" &&
      "durationSeconds" in i.target
    ) {
      total +=
        i.sets *
        i.target.durationSeconds *
        (p?.perSide || e.time.per_side
          ? r.get("session.time.model").per_side_multiplier
          : 1);
      continue;
    }
    total +=
      members.reduce(
        (n, m) =>
          n +
          (r.byExercise.get(m.exerciseId)?.time.setup_s ?? 0) +
          m.sets * work(m) +
          (m.prescription?.warmupSeconds ?? 0),
        0,
      ) + transition.buffer_s;
    if (members.length > 1) {
      const v = r.get("duration.rest.block")[p!.structure!],
        rounds = Math.max(...members.map((m) => m.sets)),
        rests =
          p!.structure === "superset"
            ? Math.max(
                v.after_round_range_s[0],
                ...members.map(
                  (m) => m.prescription?.roundRestSeconds ?? v.after_round_s,
                ),
              )
            : v.after_round_s;
      total +=
        (rounds - 1) * rests +
        Array.from({ length: rounds }, (_, n) =>
          Math.max(0, members.filter((m) => m.sets > n).length - 1),
        ).reduce((a, b) => a + b, 0) *
          (v.between_exercises_s ?? v.between_stations_s);
    } else
      total +=
        (i.sets - 1) *
        (p?.restSeconds ??
          r.get("duration.rest.straight").rest_s[
            e.nsca_class === "isolation" ? "isolation" : "compound"
          ]);
  }
  return total;
}

export function estimateMinutes(
  session: Pick<SessionDraft, "items">,
  rules = new Rules(),
): number {
  return estimateSeconds(session, rules) / 60;
}
