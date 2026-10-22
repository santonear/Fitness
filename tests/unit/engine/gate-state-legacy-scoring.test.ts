import { createHash } from "node:crypto";
import fc from "fast-check";
import { expect, test } from "vitest";
import type { EngineProfile, GateState } from "../../../src/engine/contracts";
import { Rules } from "../../../src/engine/data";
import { gateState } from "../../../src/engine/gates/state";
import { safety } from "../../../src/engine/gates/strength-scoring";
import { canonical } from "../../../src/domain/request-fingerprint";
import {
  baseProfile,
  extremeProfiles,
  goldenProfiles,
  profileArbitrary,
  sampledProfiles,
} from "../../../tools/eval/training-engine-profiles";
import { typicalProfiles } from "./fixtures";

/**
 * Characterization of the two safety-gate views. `gateState` is the live gate used by runGates;
 * `safety` is the legacy source-scoring view read by progression/legacy-*. Both digests are pinned
 * so that merging their implementations cannot silently change either output, and the field-level
 * differences between them are pinned so any change to that gap is a visible, reviewed decision.
 */
const rules = new Rules();
const cmrPositive = Object.fromEntries(
  rules
    .get("safety.screen.cmr_symptoms")
    .symptoms.map((key: string, index: number) => [key, index === 0]),
);
type Mutate = (p: EngineProfile) => EngineProfile;
const screening = (p: EngineProfile, extra: object) =>
  ({ ...p, screening: { ...p.screening, ...extra } }) as EngineProfile;
/** Inputs that only the live gate reads; each must appear in the corpus at least once. */
const mutators: Record<string, Mutate> = {
  fallPaused: (p) =>
    ({ ...p, olderSafety: { fallPaused: true } }) as EngineProfile,
  urgentPaused: (p) =>
    ({ ...p, postpartumSafety: { urgentPaused: true } }) as EngineProfile,
  regressedPhase: (p) =>
    ({ ...p, postpartumSafety: { regressedPhase: 1 } }) as EngineProfile,
  balanceStage: (p) =>
    ({ ...p, olderSafety: { balanceStage: 3 } }) as EngineProfile,
  unreviewedCaution: (p) =>
    ({
      ...p,
      cautions: ["knee"],
      screening: { ...p.screening, redFlagReview: undefined },
    }) as EngineProfile,
  cmrPositive: (p) => screening(p, { cmrSymptoms: cmrPositive }),
  cmrMissing: (p) => screening(p, { cmrSymptoms: undefined }),
  inactiveWithEvidence: (p) =>
    screening(p, {
      activityStatus: "inactive",
      activityEvidence: {
        consecutiveRegularWeeks: 52,
        noSymptomReportsWeeks: 52,
      },
    }),
  hiitEvidence: (p) =>
    screening(p, {
      clearance: { date: "2026-10-02T00:00:00.000Z", intensity: "vigorous" },
      activityEvidence: {
        consecutiveRegularWeeks: 52,
        noSymptomReportsWeeks: 52,
      },
      rarelyVigorous: false,
    }),
  age45Acked: (p) =>
    screening(
      { ...p, birthYearMonth: "1975-06" },
      {
        rarelyVigorous: true,
        age45AdvisoryAck: {
          screenedAt: p.screening.completedAt,
          acknowledgedAt: "2026-10-02T00:00:00.000Z",
        },
      },
    ),
  age45Unacked: (p) =>
    screening({ ...p, birthYearMonth: "1975-06" }, { rarelyVigorous: true }),
  parqIncomplete: (p) => screening(p, { parqAnswers: [false] }),
};
function corpus(): EngineProfile[] {
  const base = [
    ...sampledProfiles(),
    ...extremeProfiles(),
    ...goldenProfiles.map((g) => g.profile),
    ...typicalProfiles,
    ...fc.sample(profileArbitrary, { seed: 20261022, numRuns: 1000 }),
  ];
  const seeds = [
    ...goldenProfiles.map((g) => g.profile),
    ...fc.sample(profileArbitrary, { seed: 20261023, numRuns: 200 }),
    baseProfile({
      population: {
        kind: "postpartum",
        weeksSinceBirth: 14,
        delivery: "vaginal",
        cleared: true,
      },
    }),
  ];
  return [
    ...base,
    ...seeds.flatMap((p) => Object.values(mutators).map((m) => m(p))),
  ];
}
const plain = (s: GateState) =>
  JSON.parse(
    canonical({ ...s, eligibility: [...s.eligibility.entries()] }),
  ) as Record<string, any>;
const digest = (rows: unknown[]) =>
  createHash("sha256").update(canonical(rows)).digest("hex");
const profiles = corpus();
const live = profiles.map((p) => plain(gateState(p, rules)));
const legacy = profiles.map((p) => plain(safety(p, rules)));

test("live and legacy gate outputs are unchanged", () => {
  expect(profiles.length).toBe(5882);
  expect(digest(live)).toBe(
    "be786328afc6263c366e4b6a12da3e7ca93168aa8587fffc4732aaf6908146dd",
  );
  expect(digest(legacy)).toBe(
    "38bfa1aa6ba0fa644cbddb7e3f35097324bde2cfa8f0a45a62759fbb9a52b831",
  );
});

test("fields the scoring callers read never differ between the two views", () => {
  for (const [index] of profiles.entries()) {
    expect(legacy[index].population).toBe(live[index].population);
    expect(legacy[index].user.hypertension).toBe(live[index].user.hypertension);
  }
});

test("the gap between live and legacy views is exactly the documented one", () => {
  const counts: Record<string, number> = {};
  const bump = (key: string) => (counts[key] = (counts[key] ?? 0) + 1);
  for (const [index, a] of live.entries()) {
    const b = legacy[index];
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)]))
      if (key === "user") {
        for (const field of new Set([
          ...Object.keys(a.user),
          ...Object.keys(b.user),
        ]))
          if (canonical(a.user[field]) !== canonical(b.user[field]))
            bump(`user.${field}`);
      } else if (canonical(a[key]) !== canonical(b[key])) bump(key);
    const onlyLive = (a.gates as { ruleId: string }[])
      .map((g) => g.ruleId)
      .filter(
        (id) => !b.gates.some((g: { ruleId: string }) => g.ruleId === id),
      );
    for (const id of new Set(onlyLive)) bump(`gate:${id}`);
  }
  expect(counts).toMatchInlineSnapshot(`
    {
      "blocked": 825,
      "gate:caution.activation": 221,
      "gate:hiit.gate.unlock": 5882,
      "gate:older.stop.trigger": 221,
      "gate:postpartum.urgent": 221,
      "gate:safety.age45.vigorous_advisory": 1439,
      "gate:safety.clearance.hard_stop": 198,
      "gate:safety.screen.cmr_symptoms": 5882,
      "gate:safety.unlock.vigorous": 2870,
      "gates": 5882,
      "maxRpe": 1298,
      "notices": 2203,
      "phase": 25,
      "rirMin": 1362,
      "trace": 5882,
      "user.age45_advisory_acked": 5882,
      "user.age45_advisory_required": 5882,
      "user.balance_stage": 5882,
      "user.clearance_state": 198,
      "user.hiit_unlocked": 5882,
      "user.postpartum_phase": 25,
    }
  `);
});
