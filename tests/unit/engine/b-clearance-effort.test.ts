import { it, expect } from "vitest";
import { Rules } from "../../../src/engine/data";
import { createContext } from "../../../src/engine/pipeline";
import { prescribe } from "../../../src/engine/dose";
import { fixtureProfile } from "./fixtures";
const rules = new Rules(),
  cardio = rules.data.exercises.find(
    (e) => e.id === "d16325d9-fc00-4c41-88a1-000000000002",
  )!,
  cap = rules.get("safety.clearance.restricted_mode").max_rpe_0_10;
it("caps restricted cardio conditioning by source clearance effort even when the matrix retains a higher gate RPE", () => {
  const profile = {
      ...fixtureProfile,
      level: "intermediate" as const,
      trainingAgeWeeks: 45,
      population: {
        kind: "pregnant" as const,
        week: 35,
        providerCleared: true,
        prenatalCareConfirmed: true,
        contraindicationsConfirmedNone: true,
        lastScreenedWeek: 35,
      },
      screening: {
        ...fixtureProfile.screening,
        knownCondition: true,
        knownCmrDisease: true,
        activityStatus: "active" as const,
      },
    },
    ctx = createContext(profile);
  expect(ctx.gate.restrictions.user.clearance_state).toBe("required");
  expect(ctx.gate.restrictions.maxRpe).toBeGreaterThan(cap);
  for (const block of [
    "warmup",
    "main",
    "accessory",
    "conditioning",
    "cooldown",
  ] as const) {
    const item = prescribe(
      cardio,
      profile,
      rules,
      ctx.gate.restrictions,
      block,
    );
    expect(item.prescription!.targetRpe![1]).toBeLessThanOrEqual(cap);
    expect(item.prescription!.rir[0]).toBeGreaterThan(0);
  }
  const before = ctx.gate.restrictions.maxRpe;
  prescribe(cardio, profile, rules, ctx.gate.restrictions, "conditioning");
  expect(ctx.gate.restrictions.maxRpe).toBe(before);
});
it("retains normal conditioning effort for unrestricted users and honors stricter existing gate effort", () => {
  const ctx = createContext(fixtureProfile),
    moderate = rules.get("aerobic.intensity.rpe_scale").moderate;
  expect(ctx.gate.restrictions.user.clearance_state).toBe("none_needed");
  expect(
    prescribe(
      cardio,
      fixtureProfile,
      rules,
      ctx.gate.restrictions,
      "conditioning",
    ).prescription!.targetRpe,
  ).toEqual(moderate);
  ctx.gate.restrictions.user.clearance_state = "required";
  ctx.gate.restrictions.maxRpe = rules.get(
    "aerobic.intensity.rpe_scale",
  ).light_max;
  expect(
    prescribe(
      cardio,
      fixtureProfile,
      rules,
      ctx.gate.restrictions,
      "conditioning",
    ).prescription!.targetRpe,
  ).toEqual([ctx.gate.restrictions.maxRpe, ctx.gate.restrictions.maxRpe]);
});

it("keeps general warmup within source effort bounds and below conditioning without mutating inputs", () => {
  const profile = structuredClone(fixtureProfile),
    ctx = createContext(profile),
    before = JSON.stringify({ profile, state: ctx.gate.restrictions, cardio });
  const warmup = prescribe(
      cardio,
      profile,
      rules,
      ctx.gate.restrictions,
      "warmup",
    ).prescription!.targetRpe!,
    range = rules.get("session.warmup.general").intensity_rpe;
  expect(warmup[0]).toBeGreaterThanOrEqual(range[0]);
  expect(warmup[1]).toBeLessThanOrEqual(range[1]);
  expect(warmup[0]).toBeLessThanOrEqual(warmup[1]);
  expect(warmup[1]).toBeLessThan(
    rules.get("aerobic.intensity.rpe_scale").moderate[0],
  );
  expect(
    prescribe(cardio, profile, rules, ctx.gate.restrictions, "conditioning")
      .prescription!.targetRpe,
  ).toEqual(rules.get("aerobic.intensity.rpe_scale").moderate);
  expect(
    JSON.stringify({ profile, state: ctx.gate.restrictions, cardio }),
  ).toBe(before);
  ctx.gate.restrictions.maxRpe = rules.get(
    "session.warmup.general",
  ).intensity_rpe[0];
  expect(
    prescribe(cardio, profile, rules, ctx.gate.restrictions, "warmup")
      .prescription!.targetRpe,
  ).toEqual([ctx.gate.restrictions.maxRpe, ctx.gate.restrictions.maxRpe]);
});
