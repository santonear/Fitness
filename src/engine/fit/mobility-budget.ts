import type { SessionDraft } from '../contracts';
import type { Rules } from '../data';
import { estimateSeconds } from './estimate';
import { isYogaSession } from '../yoga-session';

/** A content budget, never a replacement for a safety minimum or legal dose. */
export function withinMobilityBudget(template: Pick<SessionDraft, 'items'>, rules: Rules): boolean {
  if (isYogaSession(template)) return true;
  const budget = rules.get('duration.cardio.cap').refill.mobility_budget;
  const items = template.items.filter(item => {
    const exercise = rules.byExercise.get(item.exerciseId);
    return (
      exercise &&
      budget.aggregate_modalities.includes(exercise.modality) &&
      !budget.exclude_patterns.includes(exercise.primary_pattern) &&
      !exercise.flags.some(flag => budget.exclude_flags.includes(flag))
    );
  });
  return (
    estimateSeconds({ items }, rules) <=
    Math.max(budget.minimum_seconds, estimateSeconds(template, rules) * budget.session_fraction)
  );
}

/** Remove only surplus optional content; the caller independently protects all hard rules. */
export function trimMobilityBudget(
  template: SessionDraft,
  rules: Rules,
  locked: ReadonlySet<string>,
  canApply: (before: SessionDraft, next: SessionDraft) => boolean,
): SessionDraft {
  let out = template;
  while (!withinMobilityBudget(out, rules)) {
    const before = out;
    for (let index = out.items.length - 1; index >= 0; index--) {
      const item = out.items[index],
        exercise = rules.byExercise.get(item.exerciseId);
      if (
        locked.has(item.exerciseId) ||
        exercise?.modality !== 'mobility' ||
        ['warmup', 'cooldown'].includes(item.prescription?.block ?? '') ||
        exercise.flags.includes('breathing')
      )
        continue;
      const next = structuredClone(out);
      next.items.splice(index, 1);
      if (canApply(out, next)) {
        out = next;
        break;
      }
    }
    if (out === before) break;
  }
  return out;
}
