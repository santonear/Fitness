import { expect, it } from "vitest";
import type { Slot } from "../../../src/engine/contracts";
import { fillSlots } from "../../../src/engine/fill";
import { createContext } from "../../../src/engine/pipeline";
import { baseProfile } from "../../../tools/eval/training-engine-profiles";

it("constrains floor changes in source order before accepting a high-scoring candidate", () => {
  const profile = baseProfile({
    birthYearMonth: "1956-06",
    population: {
      kind: "older_adult",
      fallsAnswers: [false, false, false, false],
    },
    constraints: { space: "large", quiet: false, noJump: true },
  });
  const context = createContext(profile);
  const slots: Slot[] = [
    {
      id: "main",
      role: "main",
      patterns: ["push_horizontal"],
      priority: 3,
      optional: false,
      sourceRuleId: "select.pipeline",
    },
    {
      id: "balance",
      role: "balance",
      patterns: ["balance"],
      priority: 2,
      optional: false,
      sourceRuleId: "older.template.balance_required",
    },
    {
      id: "core",
      role: "accessory",
      patterns: ["anti_extension"],
      priority: 1,
      optional: true,
      sourceRuleId: "select.pipeline",
    },
  ];
  const result = fillSlots(slots, context, {
    score: () => ({ quality: 0, perRule: [], advice: [] }),
    marginal: (_plan, change) => {
      const exercise = context.rules.byExercise.get(change.item!.exerciseId)!;
      return exercise.requires_floor_transition ? 10 : 0;
    },
  });
  expect(result.items.length).toBeGreaterThan(1);
  let descents = 0;
  let ascents = 0;
  let previousFloor = false;
  for (const item of result.items) {
    const exercise = context.rules.byExercise.get(item.exerciseId)!;
    const floor =
      exercise.requires_floor_transition ??
      (exercise.space === "mat" &&
        exercise.position.some((position) =>
          ["supine", "prone", "side_lying", "quadruped", "kneeling"].includes(
            position,
          ),
        ) &&
        !exercise.position.some((position) =>
          ["standing", "seated"].includes(position),
        ));
    if (floor && !previousFloor) descents++;
    if (!floor && previousFloor) ascents++;
    previousFloor = floor;
  }
  const limit = context.rules.get("older.floor.transitions").other_older_users
    .max_floor_descents_per_session;
  expect(descents).toBeLessThanOrEqual(limit);
  expect(context.trace).toContainEqual(
    expect.objectContaining({
      ruleId: "older.floor.transitions",
      step: "fill",
      details: { descents, ascents },
    }),
  );
});
