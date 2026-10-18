import type { EnginePlan } from "../../src/engine/contracts";
import type { Rules } from "../../src/engine/data";
import { independentElapsedSeconds } from "../../src/engine/validation/cardio-duration";

/** Audit actual elapsed content independently of fitter helpers and reported minutes. */
export function mobilityBudgetExceedances(plan: EnginePlan, rules: Rules) {
  const policy = rules.get("duration.cardio.cap").refill.mobility_budget;
  return plan.templates.flatMap((template) => {
    const content = template.items.filter((item) => {
      const exercise = rules.byExercise.get(item.exerciseId);
      return (
        exercise &&
        policy.aggregate_modalities.includes(exercise.modality) &&
        !policy.exclude_patterns.includes(exercise.primary_pattern) &&
        !exercise.flags.some((flag) => policy.exclude_flags.includes(flag))
      );
    });
    const actual = independentElapsedSeconds(template.items, rules);
    const seconds = independentElapsedSeconds(content, rules);
    const limitSeconds = Math.max(
      policy.minimum_seconds,
      actual * policy.session_fraction,
    );
    return seconds > limitSeconds
      ? [{ templateId: template.id, seconds, limitSeconds }]
      : [];
  });
}
