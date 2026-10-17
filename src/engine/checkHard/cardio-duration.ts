import { refillProposals, type RefillPhase } from "../fit/refill-proposals";
import type { EngineProfile, GateOutcome, Plan } from "../contracts";
import { type Rules } from "../data";
import { isHardEligible } from "../candidates";
import { cardioWorkCap, cardioWorkSeconds } from "../fit/cardio-cap";
type Template = Plan["templates"][number];
type Add = (
  code: string,
  ruleId: string,
  reason: string,
  templateId?: string,
  itemIndex?: number,
) => number;
/** Read actual active work; neither declared targets nor trace can hide an oversized bout. */
export function checkCardioCaps(
  t: Template,
  p: EngineProfile,
  g: GateOutcome,
  r: Rules,
  add: Add,
): void {
  const work = new Map<string, number>();
  for (const [index, item] of t.items.entries()) {
    const e = r.byExercise.get(item.exerciseId);
    if (e?.modality !== "cardio") continue;
    const total = (work.get(e.id) ?? 0) + cardioWorkSeconds(item, e, r);
    work.set(e.id, total);
    if (!Number.isFinite(total) || total > cardioWorkCap(e, p, r, g))
      add(
        "cardio_work_cap",
        "duration.cardio.cap",
        "whole exercise work exceeds source cap",
        t.id,
        index,
      );
  }
}
/** Exhaustion is proved against complete hard candidates and legal existing set increases. */
export function exhaustedSafeCapacity(
  t: Template,
  p: EngineProfile,
  g: GateOutcome,
  r: Rules,
  canAdd: (proposal: Template) => boolean,
): boolean {
  for (const phase of r.get("duration.cardio.cap").refill
    .order as RefillPhase[])
    for (const proposal of refillProposals(t, p, g, r, phase))
      if (canAdd(proposal)) return false;
  return true;
}
