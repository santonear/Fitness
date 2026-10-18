import type { EngineProfile, GateOutcome, SessionDraft } from "../contracts";
import { condition, type Exercise, type Rules } from "../data";
type Item = SessionDraft["items"][number];
/** The cap is active work for the whole identity, never a per-set allowance. */
export function cardioWorkSeconds(item: Item, e: Exercise, r: Rules): number {
  return "durationSeconds" in item.target
    ? item.sets *
        item.target.durationSeconds *
        (item.prescription?.perSide || e.time.per_side
          ? r.get("session.time.model").per_side_multiplier
          : 1)
    : NaN;
}
export function cardioWorkCap(
  e: Exercise,
  p: EngineProfile,
  r: Rules,
  g?: GateOutcome,
): number {
  const rule = r.get("duration.cardio.cap"),
    low = rule.low_intensity;
  let cap =
    (rule.explicit_low_intensity_slugs ?? []).includes(e.slug) ||
    (e.flags.includes(low.required_flag) && e.impact === low.impact)
      ? low.max_work_seconds
      : rule.other_max_work_seconds;
  for (const row of rule.specialized_caps ?? [])
    if (
      !row.when ||
      condition(
        row.when,
        e,
        g?.restrictions.user ?? { population: p.population.kind },
      )
    )
      cap = Math.min(cap, row.max_work_seconds);
  return cap;
}
export function capCardioItems(
  session: SessionDraft,
  p: EngineProfile,
  r: Rules,
  g: GateOutcome,
  locked: Set<string>,
): SessionDraft {
  const out = structuredClone(session),
    used = new Map<string, number>();
  for (const item of out.items) {
    const e = r.byExercise.get(item.exerciseId);
    if (e?.modality !== "cardio" || !("durationSeconds" in item.target))
      continue;
    const work = cardioWorkSeconds(item, e, r),
      remaining = Math.max(
        0,
        cardioWorkCap(e, p, r, g) - (used.get(e.id) ?? 0),
      );
    if (!locked.has(e.id) && work > remaining) {
      const side =
        item.prescription?.perSide || e.time.per_side
          ? r.get("session.time.model").per_side_multiplier
          : 1;
      item.target.durationSeconds = remaining / (item.sets * side);
    }
    used.set(e.id, (used.get(e.id) ?? 0) + cardioWorkSeconds(item, e, r));
  }
  return out;
}
