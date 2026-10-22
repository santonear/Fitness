import { FOCUS } from '../candidates/focus';
import type { PipelineContext, SessionDraft } from '../contracts';
import { refillProposals, type RefillPhase } from './refill-proposals';
import { estimateSeconds } from './estimate';
/** Follow the registered order. Each accepted step has passed the caller's full hard gate. */
export function fillSafeBudget(
  current: () => SessionDraft,
  targetSeconds: number,
  ctx: PipelineContext,
  locked: Set<string>,
  accept: (next: SessionDraft) => boolean,
) {
  const phases = ctx.rules.get('duration.cardio.cap').refill.order as RefillPhase[];
  while (estimateSeconds(current(), ctx.rules) < targetSeconds) {
    const beforePass = estimateSeconds(current(), ctx.rules);
    for (const phase of phases) {
      if (
        ctx.focus &&
        ctx.focus !== 'full' &&
        ['missing_patterns', 'low_intensity', 'balance_breathing', 'stretch'].includes(phase)
      )
        continue;
      while (estimateSeconds(current(), ctx.rules) < targetSeconds) {
        let changed = false;
        for (const proposal of refillProposals(current(), ctx.profile, ctx.gate, ctx.rules, phase)) {
          const allowed = ctx.focus ? FOCUS[ctx.focus] : undefined;
          const existingIds = new Set(current().items.map(item => item.exerciseId));
          if (
            allowed &&
            proposal.items.some(
              item =>
                !existingIds.has(item.exerciseId) &&
                !allowed.includes(ctx.rules.byExercise.get(item.exerciseId)!.primary_pattern),
            )
          )
            continue;
          if (
            current().items.some(
              (item, index) =>
                locked.has(item.exerciseId) && JSON.stringify(item) !== JSON.stringify(proposal.items[index]),
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
    if (
      !ctx.rules.get('duration.cardio.cap').refill.repeat_while_improving ||
      estimateSeconds(current(), ctx.rules) <= beforePass
    )
      break;
  }
}
