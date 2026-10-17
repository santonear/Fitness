import { expect, it } from "vitest";
import { replacementCandidateIds } from "../../src/application/engine-replacement-candidates";
import type { EngineCoachProfile } from "../../src/application/engine-profile";
import { Rules } from "../../src/engine/data";
import { baseProfile } from "../../tools/eval/training-engine-profiles";
const legacy: EngineCoachProfile = {
    goalText: "保持活动",
    weeklyTarget: 2,
    sessionMinutes: 20,
    scheduleOriginalText: "每周2次，每次20分钟",
    place: "home",
    equipment: ["none"],
    adultConfirmed: true,
    cautions: [],
    confirmedAt: "2026-10-18T00:00:00Z",
  },
  rules = new Rules();
it("retains only the existing conservative basic subset when the new engine is off and no health facts exist", () => {
  const before = structuredClone(legacy),
    ids = replacementCandidateIds(undefined, legacy, false, rules);
  expect(ids).toContain(
    rules.data.exercises.find((e) => e.slug === "native-self-resisted-row")!.id,
  );
  for (const id of ids) {
    const e = rules.byExercise.get(id)!;
    expect(e.noise).toBe(0);
    expect(e.difficulty).toBeLessThanOrEqual(2);
    expect(e.flags).not.toContain("running");
    expect(e.flags).not.toContain("jumping");
  }
  expect(legacy).toEqual(before);
});
it("does not use the compatibility subset when engine screening is required or partially stored", () => {
  expect(replacementCandidateIds(undefined, legacy, true, rules)).toEqual([]);
  expect(
    replacementCandidateIds(
      undefined,
      { ...legacy, healthStorageConsent: { acceptedAt: legacy.confirmedAt } },
      false,
      rules,
    ),
  ).toEqual([]);
  expect(
    replacementCandidateIds(
      undefined,
      { ...legacy, birthYearMonth: "1956-01" },
      false,
      rules,
    ),
  ).toEqual([]);
});
it("keeps known caution and explicit space exclusions in the compatibility subset", () => {
  const self = rules.data.exercises.find(
    (e) => e.slug === "native-self-resisted-row",
  )!.id;
  expect(
    replacementCandidateIds(
      undefined,
      { ...legacy, cautions: ["shoulder"] },
      false,
      rules,
    ),
  ).not.toContain(self);
  expect(
    replacementCandidateIds(
      undefined,
      { ...legacy, constraints: { quiet: true, noJump: true, space: "mat" } },
      false,
      rules,
    ),
  ).not.toContain(self);
  expect(
    replacementCandidateIds(
      undefined,
      { ...legacy, cautions: ["other"] },
      false,
      rules,
    ),
  ).toEqual([]);
});
it("continues full current-profile filtering even when the rollout flag is off", () => {
  const p = baseProfile({
      constraints: { quiet: true, noJump: true, space: "mat" },
    }),
    before = structuredClone(p),
    ids = replacementCandidateIds(p, legacy, false, rules);
  expect(ids).not.toContain(
    rules.data.exercises.find((e) => e.slug === "high-knees")!.id,
  );
  expect(p).toEqual(before);
});
