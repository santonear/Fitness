import {
  type SessionDraft,
  type EngineProfile,
  type GateOutcome,
  type PipelineContext,
} from "../contracts";
import { Rules } from "../data";
import { newWeek, volumeLimits } from "./limits";
import { weeklyVolume, credit } from "./volume";
import { floorSafeOrder } from "./floor-order";
import { strengthRoles } from "./roles";
import { powerExercise } from "./rep-ranges";
import { prescribe } from "./prescribe";

/** P0 adapter for the new pipeline. Existing operation/progression helpers stay until migration. */
export function assignDose(
  draft: SessionDraft,
  profile: EngineProfile,
  gate: GateOutcome,
  rules = new Rules(),
  ctx?: PipelineContext,
): SessionDraft {
  const result = structuredClone(draft),
    intro = newWeek(profile, rules),
    sessionCap = rules.get("dose.sets_session.cap");
  const weekly = ctx?.plan ? weeklyVolume(ctx.plan, rules) : {},
    session: Record<string, number> = {};
  const maxWeekly = volumeLimits(profile, rules).max;
  const exerciseCap = intro?.exercises_per_session?.[1] ?? Infinity;
  let workCount = 0;
  result.items = [];
  const ordered = floorSafeOrder(draft.items, profile, gate, rules, ctx),
    roles = strengthRoles(ordered, profile, rules);
  for (const item of ordered) {
    const exercise = rules.byExercise.get(item.exerciseId);
    if (!exercise) continue;
    if (
      profile.level === "beginner" &&
      rules.get("dose.power").beginner === "excluded" &&
      powerExercise(exercise, rules)
    )
      continue;
    const block = item.prescription?.block ?? "main",
      work = ["main", "accessory", "core"].includes(block);
    if (work && workCount >= exerciseCap) continue;
    const budgetSets =
        work && item.prescription?.sourcePosition
          ? ctx?.volumeBudget?.bySlot[item.prescription.sourcePosition]
          : undefined,
      doseRole =
        profile.goal === "strength" && work
          ? (roles.get(item) ?? block)
          : block;
    const next = prescribe(
      exercise,
      profile,
      rules,
      gate.restrictions,
      doseRole,
      budgetSets,
    );
    if (next.prescription && item.prescription) {
      next.prescription.block = item.prescription.block;
      next.prescription.sourcePosition = item.prescription.sourcePosition;
      next.prescription.goalRole =
        profile.goal === "strength" && work
          ? (doseRole as "main" | "accessory")
          : item.prescription.goalRole;
    }
    if (profile.goal === "strength" && doseRole === "main")
      next.sets = Math.min(
        next.sets,
        sessionCap.strength_main_lift_direct_sets_max,
      );
    const unit = credit({ ...next, sets: 1 }, rules);
    for (const [group, amount] of Object.entries(unit))
      if (amount > 0) {
        next.sets = Math.min(
          next.sets,
          Math.floor(
            (sessionCap.per_muscle_fractional_sets_max[profile.level] -
              (session[group] ?? 0)) /
              amount,
          ),
        );
        if (intro)
          next.sets = Math.min(
            next.sets,
            Math.floor((maxWeekly - (weekly[group] ?? 0)) / amount),
          );
      }
    if (
      next.sets <
      (powerExercise(exercise, rules) ? rules.get("dose.power").sets[0] : 1)
    )
      continue;
    if (next.target.metricType === "reps_load" && next.target.loadGrams === 0)
      next.target = { metricType: "reps", reps: next.target.reps };
    result.items.push(next);
    if (work) workCount++;
    for (const [group, amount] of Object.entries(credit(next, rules))) {
      session[group] = (session[group] ?? 0) + amount;
      weekly[group] = (weekly[group] ?? 0) + amount;
    }
  }
  ctx?.trace.push({
    ruleId: "dose.sets_session.cap",
    reason: "source dose with session and introductory weekly caps",
    step: "dose",
    note: `${result.items.length} items`,
  });
  return result;
}
