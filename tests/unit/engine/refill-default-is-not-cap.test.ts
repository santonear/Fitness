import { it, expect } from "vitest";
import { Rules } from "../../../src/engine/data";
import { runGates } from "../../../src/engine/gates";
import { baseProfile } from "../../../tools/eval/training-engine-profiles";
import { prescribe } from "../../../src/engine/dose";
import { checkHard } from "../../../src/engine/hard-checks";
import { independentRefillWitness } from "../../../src/engine/validation/refill-capacity";
import type { EnginePlan } from "../../../src/engine/contracts";
it("does not mistake a default set range for the hard maximum when proving exhaustion", () => {
  const raw = structuredClone(new Rules().data),
    e = raw.exercises.find((e) => e.slug === "bodyweight-squat")!;
  e.default_dose.intermediate!.sets = [1, 3];
  raw.exercises = [e];
  const r = new Rules(raw);
  const p = baseProfile({
      level: "intermediate",
      trainingAgeWeeks: 52,
      daysPerWeek: 1,
      sessionMinutes: 30,
      equipment: ["none"],
    }),
    g = runGates(p, r),
    item = prescribe(e, p, r, g.restrictions, "accessory", 3);
  const plan: EnginePlan = {
    weeklyTarget: 1,
    sessionMinutes: 30,
    meta: {
      engineVersion: "2",
      rulesVersion: r.data.rulesVersion,
      seed: "default-vs-hard",
    },
    gates: g.reasons,
    notices: [],
    trace: [],
    templates: [
      {
        id: "sets",
        name: "sets",
        estimatedMinutes: 30,
        targetMinutes: 30,
        items: [item],
      },
    ],
  };
  expect(
    checkHard(plan, p, g, r, true).filter((x) => x.severity === "error"),
  ).toEqual([]);
  const fourth = structuredClone(plan);
  fourth.templates[0].items[0].sets = 4;
  expect(
    checkHard(fourth, p, g, r, true).filter((x) => x.severity === "error"),
  ).toEqual([]);
  expect(
    checkHard(plan, p, g, r).some((x) => x.code === "intentional_short"),
  ).toBe(false);
  expect(
    checkHard(plan, p, g, r).some((x) => x.code === "duration_tolerance"),
  ).toBe(true);
  expect(
    independentRefillWitness(plan, plan.templates[0], p, r, [e.id]),
  ).toBeDefined();
});
