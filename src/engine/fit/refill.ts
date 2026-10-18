import type { PipelineContext, SessionDraft } from "../contracts";
import { refillProposals, type RefillPhase } from "./refill-proposals";
import { estimateSeconds } from "./estimate";
/** Follow the registered order. Each accepted step has passed the caller's full hard gate. */
export function fillSafeBudget(
  current: () => SessionDraft,
  targetSeconds: number,
  ctx: PipelineContext,
  locked: Set<string>,
  accept: (next: SessionDraft) => boolean,
) {
  const phases = ctx.rules.get("duration.cardio.cap").refill
    .order as RefillPhase[];
  for (const phase of phases) {
    if (ctx.focus && ["missing_patterns", "low_intensity"].includes(phase))
      continue;
    while (estimateSeconds(current(), ctx.rules) < targetSeconds) {
      let changed = false;
      for (const proposal of refillProposals(
        current(),
        ctx.profile,
        ctx.gate,
        ctx.rules,
        phase,
      )) {
        if (
          current().items.some(
            (item, index) =>
              locked.has(item.exerciseId) &&
              JSON.stringify(item) !== JSON.stringify(proposal.items[index]),
          )
        )
          continue;
        if (accept({ ...proposal, slots: current().slots })) {
          changed = true;
          break;
        }
      }
      if (!changed) break;
    }
  }
}
