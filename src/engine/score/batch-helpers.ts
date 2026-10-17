import { type Context, type Session } from "./types";
import { blockSeconds, actualWarmupSeconds } from "../fit/elapsed-time";
import { strengthRoles } from "../dose";
import { mean, countSatisfaction } from "./math";
import { safety } from "../gates/strength-scoring";

export function safetyBlockTimes(
  c: Context,
  session: Session,
): { warmup: number; cooldown: number } {
  const timing = c.timing,
    bound = timing?.profile === c.p && timing.rules === c.r,
    cache =
      bound && timing.baselineSessions.has(session) ? timing.values : undefined;
  const cached = cache?.get(session);
  if (cached) return cached;
  // Without any registered seconds the authenticated protocol contributes exactly zero in this owned batch.
  const warmup =
    bound &&
    session.items.every(
      (item) => item.prescription?.warmupSeconds === undefined,
    )
      ? blockSeconds(session, "warmup", c.r)
      : actualWarmupSeconds(session, c.p, c.r);
  const value = { warmup, cooldown: blockSeconds(session, "cooldown", c.r) };
  cache?.set(session, value);
  return value;
}

/** Preserve the original role Map and its insertion order for unchanged, round-owned sessions only. */
export function sessionStrengthRoles(
  c: Context,
  session: Session,
): ReturnType<typeof strengthRoles> {
  const timing = c.timing,
    cache =
      timing?.profile === c.p &&
      timing.rules === c.r &&
      timing.baselineSessions.has(session)
        ? timing.roles
        : undefined;
  const cached = cache?.get(session);
  if (cached) return cached;
  const roles = strengthRoles(session.items, c.p, c.r);
  cache?.set(session, roles);
  return roles;
}

/** Cache only each untouched baseline session; the row still averages in its original RT order. */
export function sessionCooldownStretch(c: Context, t: Session): number {
  const timing = c.timing,
    cache =
      timing?.profile === c.p &&
      timing.rules === c.r &&
      timing.baselineSessions.has(t)
        ? timing.cooldownStretch
        : undefined;
  const cached = cache?.get(t);
  if (cached !== undefined) return cached;
  const groupMap = c.r.get("dose.muscle_groups").catalog_map;
  const value = (() => {
    const groups = new Set(
      t.items
        .filter((i) =>
          ["main", "accessory"].includes(i.prescription?.block ?? ""),
        )
        .flatMap((i) => c.r.byExercise.get(i.exerciseId)?.primaryMuscles ?? [])
        .map((m) => groupMap[m])
        .filter(Boolean),
    );
    return mean(
      [...groups].map((g) =>
        countSatisfaction(
          t.items
            .filter(
              (i) =>
                i.prescription?.block === "cooldown" &&
                c.r.byExercise.get(i.exerciseId)?.mobility_type === "static" &&
                c.r.byExercise.get(i.exerciseId)?.stretch_targets?.includes(g),
            )
            .reduce(
              (n, i) =>
                n +
                ("durationSeconds" in i.target
                  ? i.sets * i.target.durationSeconds
                  : 0),
              0,
            ),
          c.v.total_s_per_muscle_target,
        ),
      ),
    );
  })();
  cache?.set(t, value);
  return value;
}

export function goalStrengthSafety(c: Context): ReturnType<typeof safety> {
  const timing = c.timing;
  if (timing?.profile === c.p && timing.rules === c.r)
    return (timing.strengthSafety ??= safety(c.p, c.r));
  return safety(c.p, c.r);
}
