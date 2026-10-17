import { describe, it, expect } from "vitest";
import { generatePlan, validatePlan } from "../../../src/engine";
import { Rules } from "../../../src/engine/data";
import { runGates } from "../../../src/engine/gates";
import { refillProposals } from "../../../src/engine/fit/refill-proposals";
import { independentElapsedSeconds } from "../../../src/engine/validation/cardio-duration";
import { independentRefillWitness } from "../../../src/engine/validation/refill-capacity";
import { independentlyPossibleIds } from "../../../tools/eval/training-engine-quality";
import { sampledProfiles } from "../../../tools/eval/training-engine-profiles";
import { intentionalShortFacts } from "../../../tools/eval/training-engine-shortage";
import { externalIssues } from "../../../tools/eval/training-engine-invariants";
const r = new Rules();
describe("ordered safe refill", () => {
  it("keeps the approved four-stage order and both shortage protections in mechanic data", () => {
    expect(r.get("duration.cardio.cap").refill).toMatchObject({
      order: [
        "existing_sets",
        "missing_patterns",
        "low_intensity",
        "warmup_cooldown",
      ],
      shortage_population_fraction_max: 0.05,
      shortage_session_ratio_min: 0.5,
    });
  });
  for (const index of [6, 12, 24, 32])
    it(`keeps sampled profile ${index} hard-safe with independently checked actual time`, () => {
      const p = sampledProfiles(80)[index],
        plan = generatePlan(p);
      expect(
        validatePlan(plan, p).filter((x) => x.severity === "error"),
      ).toEqual([]);
      expect(
        externalIssues(plan, p).filter((x) => x.severity === "error"),
      ).toEqual([]);
      for (const t of plan.templates)
        if (t.durationScope !== "untargeted")
          expect(
            independentElapsedSeconds(t.items, r) /
              ((t.targetMinutes ?? p.sessionMinutes) * 60),
          ).toBeGreaterThanOrEqual(0.5);
    });
  it("detects remaining legal low-intensity work without trusting a producer short marker", () => {
    const p = sampledProfiles(80)[32],
      plan = generatePlan(p),
      t = plan.templates[0],
      g = runGates(p, r);
    const proposals = [...refillProposals(t, p, g, r, "low_intensity")];
    expect(proposals.length).toBeGreaterThan(0);
    expect(plan).toEqual(generatePlan(p));
    const forged = structuredClone(plan);
    forged.templates[0].targetMinutes = 90;
    expect(
      intentionalShortFacts(forged, { ...p, sessionMinutes: 90 }, r).qualified,
    ).toBe(false);
    expect(
      independentRefillWitness(
        forged,
        forged.templates[0],
        { ...p, sessionMinutes: 90 },
        r,
        independentlyPossibleIds(p, r),
      ),
    ).toBeDefined();
  });
});
