import { expect, it } from "vitest";
import { generatePlan, validatePlan } from "../../../src/engine";
import { engineProfileSchema } from "../../../src/engine/contracts";
import { hash } from "../../../src/engine/data";
import {
  extremeProfiles,
  TRAINING_ENGINE_SEED,
} from "../../../tools/eval/training-engine-profiles";
import { externalIssues } from "../../../tools/eval/training-engine-invariants";
import fixed from "../../fixtures/training-engine/assemble-duration-regressions.json";

it("pins the two newly exposed extreme inputs without profile-specific generator branches", () => {
  const originals = extremeProfiles(fixed.source.extremeCount);
  expect(fixed.source.seed).toBe(TRAINING_ENGINE_SEED);
  expect(fixed.profiles.map((row) => row.index)).toEqual([2078, 2182]);
  for (const row of fixed.profiles) {
    expect(row.profile).toEqual(originals[row.extremeIndex]);
    expect(hash([row.profile, fixed.source.variant])).toBe(row.profileHash);
  }
});

it.each(fixed.profiles)(
  "extreme profile $index assembles a nonempty plan within unchanged public and independent hard limits",
  (row) => {
    const profile = engineProfileSchema.parse(structuredClone(row.profile));
    const before = structuredClone(profile);
    const plan = generatePlan(profile, { variant: fixed.source.variant });
    expect(profile).toEqual(before);
    expect(plan.templates.length).toBeGreaterThan(0);
    for (const template of plan.templates) {
      expect(template.items.length).toBeGreaterThan(0);
    }
    expect(
      [...validatePlan(plan, profile), ...externalIssues(plan, profile)].filter(
        (issue) => issue.severity === "error",
      ),
    ).toEqual([]);
    expect(generatePlan(profile, { variant: fixed.source.variant })).toEqual(plan);
  },
);
