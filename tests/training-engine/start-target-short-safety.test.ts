import { baseProfile } from "../../tools/eval/training-engine-profiles";
import { expect, it } from "vitest";
import { generatePlan, validatePlan } from "../../src/engine";
import { enginePlanSchema } from "../../src/engine/contracts";
import { legacySampledProfile } from "./v1-inputs";
import { Rules } from "../../src/engine/data";
import { scorePlan } from "../../src/engine/score";
import { actualBlockSeconds } from "../unit/engine/reference/training-engine-session-time";
import { independentElapsedAllocation } from "../unit/engine/reference/training-engine-goal-share";
it("preserves a short requested V2 target and independently measures actual safety-block shortfall", () => {
  const p = legacySampledProfile(44);
  p.screening.cmrSymptoms = baseProfile().screening.cmrSymptoms;
  if (p.population.kind === "pregnant")
    p.population = { ...p.population, prenatalCareConfirmed: true };
  const before = structuredClone(p),
    r = new Rules(),
    plan = generatePlan(p);
  expect(p.sessionMinutes).toBe(16);
  expect(p.population.kind).toBe("pregnant");
  expect(plan.templates).toHaveLength(p.daysPerWeek);
  expect(enginePlanSchema.safeParse(plan).success).toBe(true);
  for (const t of plan.templates) {
    expect(t.targetMinutes).toBe(p.sessionMinutes);
    expect(independentElapsedAllocation({ templates: [t] }).total).toBeCloseTo(
      t.estimatedSeconds!,
      6,
    );
    for (const i of t.items)
      if ("durationSeconds" in i.target) {
        expect(i.target.durationSeconds).toBeGreaterThan(0);
        expect(Number.isInteger(i.target.durationSeconds)).toBe(true);
      }
  }
  const rule = r.byId.get("safety.session.warmup_cooldown")!;
  expect(rule.severity).toBe("target");
  const walking = r.data.exercises.find((e) => e.slug === "walking")!,
    counterexample = structuredClone(plan);
  counterexample.templates = [counterexample.templates[0]];
  counterexample.templates[0].items = [
    {
      exerciseId: walking.id,
      equipment: "none",
      sets: 1,
      target: { metricType: "duration", durationSeconds: 120 },
      prescription: {
        pattern: "cardio_cyclic",
        block: "conditioning",
        rir: [4, 4],
        restSeconds: 0,
        targetRpe: [5, 6],
      },
    },
  ];
  expect(actualBlockSeconds(counterexample.templates[0], "warmup")).toBe(0);
  expect(actualBlockSeconds(counterexample.templates[0], "cooldown")).toBe(0);
  const row = scorePlan(counterexample, p, r).perRule.find(
    (row) => row.id === rule.id,
  );
  expect(row).toBeDefined();
  expect(row!.satisfaction).toBe(0);
  expect(validatePlan(plan, p).filter((i) => i.severity === "error")).toEqual(
    [],
  );
  const malformed = structuredClone(plan);
  malformed.templates[0].targetMinutes = 1;
  expect(enginePlanSchema.safeParse(malformed).success).toBe(false);
  expect(p).toEqual(before);
});
