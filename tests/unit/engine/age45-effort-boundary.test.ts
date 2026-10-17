import { expect, it } from "vitest";
import { Rules } from "../../../src/engine/data";
import { runGates } from "../../../src/engine/gates";
import { checkHard } from "../../../src/engine/hard-checks";
import { baseProfile } from "../../../tools/eval/training-engine-profiles";
import { planFixture } from "./fixtures";

it("rejects maximal effort before age45 acknowledgement and requires acknowledgement again after rescreening", () => {
  const rules = new Rules();
  const profile = baseProfile({
    birthYearMonth: "1976-01",
    level: "intermediate",
    daysPerWeek: 1,
  });
  profile.screening.rarelyVigorous = true;
  profile.screening.activityEvidence = {
    consecutiveRegularWeeks: 8,
    noSymptomReportsWeeks: 8,
  };
  const plan = planFixture();
  // No maximum-weight test is offered. An imported maximal-effort prescription
  // must nevertheless be rejected by the same public hard effort boundary.
  const prescription = plan.templates[0].items[0].prescription!;
  prescription.targetRpe = [10, 10];
  prescription.rir = [0, 0];
  const effortIssues = () =>
    checkHard(plan, profile, runGates(profile, rules), rules).filter(
      (issue) => issue.code === "intensity_cap",
    );
  expect(effortIssues()).toContainEqual(
    expect.objectContaining({
      ruleId: "safety.age45.vigorous_advisory",
      severity: "error",
    }),
  );
  profile.screening.age45AdvisoryAck = {
    screenedAt: profile.screening.completedAt!,
    acknowledgedAt: profile.screening.completedAt!,
  };
  expect(effortIssues()).toEqual([]);
  // The old acknowledgement belongs to the old screening, not this new one.
  profile.screening.completedAt = "2026-10-14T00:00:00.000Z";
  expect(effortIssues()).toContainEqual(
    expect.objectContaining({
      ruleId: "safety.age45.vigorous_advisory",
      severity: "error",
    }),
  );
});
