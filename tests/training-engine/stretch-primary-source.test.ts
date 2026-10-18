import { scorePlan } from "../../src/engine/score";
import { describe, expect, it } from "vitest";
import { Rules } from "../../src/engine/data";
import { credit, prescribe, type Template } from "../../src/engine/dose";
import {
  priorityStretchGroups,
  requiredStretchGroups,
  plannedCooldown,
  ensureCooldown,
} from "../../src/engine/progression/legacy-cooldown";
import { safety } from "../../src/engine/gates/strength-scoring";
import { validatePlan } from "../../src/engine";
import type { EnginePlan, EngineProfile } from "../../src/engine/contracts";
import {
  independentCooldownIssues,
  independentStretchPrimaryWarnings,
} from "../unit/engine/reference/training-engine-cooldown";
import { classifyPlan } from "../../tools/eval/training-engine-audit";
import { baseProfile } from "../../tools/eval/training-engine-profiles";
const r = new Rules();
function template(slug: string, p: EngineProfile): Template {
  const item = prescribe(
    r.data.exercises.find((e) => e.slug === slug)!,
    p,
    r,
    safety(p, r),
    "main",
    2,
  );
  item.prescription!.sourcePosition = "main_1";
  return {
    id: "primary",
    name: "Full body",
    estimatedMinutes: 30,
    items: [item],
  };
}
function plan(t: Template): EnginePlan {
  return {
    weeklyTarget: 3,
    sessionMinutes: 30,
    templates: [t],
    meta: {
      engineVersion: "test",
      rulesVersion: r.data.rulesVersion,
      seed: "primary",
    },
    trace: [],
    notices: [],
    gates: [],
  };
}
describe("stretch obligations use registered primary muscles only", () => {
  it("keeps secondary volume credits without promoting them to primary stretch requirements", () => {
    const p = baseProfile(),
      t = template("knee-push-ups", p),
      before = credit(t.items[0], r);
    expect(before.shoulders).toBeGreaterThan(0);
    expect(requiredStretchGroups(t, r)).toContain("shoulders");
    expect(priorityStretchGroups(t, r, p)).toEqual(["chest"]);
    expect(credit(t.items[0], r)).toEqual(before);
  });
  it("does not turn missing primary data into pattern-credit or whole-template priority", () => {
    const p = baseProfile(),
      t = template("native-bodyweight-squat", p);
    expect(credit(t.items[0], r).glutes).toBeGreaterThan(0);
    expect(requiredStretchGroups(t, r)).toContain("glutes");
    expect(priorityStretchGroups(t, r, p)).toEqual([]);
    const auxiliary = prescribe(
      r.data.exercises.find((e) => e.slug === "knee-push-ups")!,
      p,
      r,
      safety(p, r),
      "accessory",
      2,
    );
    t.items.push(auxiliary);
    expect(requiredStretchGroups(t, r)).toContain("chest");
    expect(priorityStretchGroups(t, r, p)).toEqual([]);
    const q = plan(t);
    expect(
      validatePlan(q, p).some((i) => i.code === "stretch_primary_unknown"),
    ).toBe(false);
    expect(
      scorePlan(q, p, r).perRule.find(
        (v) => v.id === "session.cooldown.stretch",
      )!.satisfaction,
    ).toBe(0);
    expect(independentStretchPrimaryWarnings(q)).toContainEqual(
      expect.objectContaining({
        code: "external_stretch_primary_unknown",
        severity: "warning",
        itemIndex: 0,
      }),
    );
  });
  it("reports the approved safety-priority default omission for known primary glutes in pregnancy", () => {
    const p = baseProfile({
        population: {
          kind: "pregnant",
          week: 20,
          providerCleared: true,
          prenatalCareConfirmed: true,
          contraindicationsConfirmedNone: true,
          lastScreenedWeek: 20,
        },
      }),
      t = template("bodyweight-squat", p),
      state = safety(p, r);
    expect(priorityStretchGroups(t, r, p)).toEqual(["glutes", "quads"]);
    expect(plannedCooldown(t, p, r, state).safetyUnavailable).toContain(
      "glutes",
    );
    ensureCooldown(t, p, r, state, true);
    const q = plan(t),
      issues = validatePlan(q, p);
    expect(
      issues.some((i) => i.code === "cooldown_stretch_safety_unavailable"),
    ).toBe(false);
    expect(
      scorePlan(q, p, r).perRule.find(
        (v) => v.id === "session.cooldown.stretch",
      )!.satisfaction,
    ).toBeLessThan(1);
    expect(independentCooldownIssues(q, p)).toContainEqual(
      expect.objectContaining({
        code: "external_cooldown_warning",
        severity: "error",
        reason: "unreported_safe_catalog_omission:glutes",
      }),
    );
    q.quality = { status: "unavailable", issues };
    expect(
      independentCooldownIssues(q, p).some(
        (i) => i.reason === "unreported_safe_catalog_omission:glutes",
      ),
    ).toBe(true);
  });
  it("continues to reject actual static dose violations and actual cooldown cap overflow", () => {
    const p = baseProfile(),
      t = template("native-bodyweight-squat", p),
      stretch = prescribe(
        r.data.exercises.find((e) => e.slug === "standing-quad-stretch")!,
        p,
        r,
        safety(p, r),
        "cooldown",
        2,
      );
    stretch.sets = 2;
    stretch.target = { metricType: "duration", durationSeconds: 1 };
    t.items.push(stretch);
    expect(
      validatePlan(plan(t), p).some(
        (i) => i.code === "stretch_dose_bounds" && i.severity === "error",
      ),
    ).toBe(true);
    stretch.target.durationSeconds = 300;
    expect(
      validatePlan(plan(t), p).some(
        (i) => i.code === "stretch_dose_bounds" && i.severity === "error",
      ),
    ).toBe(true);
    expect(
      independentCooldownIssues(plan(t), p).some(
        (i) => i.code === "external_cooldown_cap" && i.severity === "error",
      ),
    ).toBe(true);
  });
});
