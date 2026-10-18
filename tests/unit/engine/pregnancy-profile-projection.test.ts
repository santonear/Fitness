import { expect, it } from "vitest";
import {
  toEngineProfile,
  type EngineCoachProfile,
} from "../../../src/application/engine-profile";
import { baseProfile } from "../../../tools/eval/training-engine-profiles";
import { runGates } from "../../../src/engine/gates";
const at = "2026-10-17T00:00:00.000Z";
it("projects local supine avoidance without dropping the entire validated profile", () => {
  const source = baseProfile({
    population: {
      kind: "pregnant",
      week: 8,
      providerCleared: true,
      prenatalCareConfirmed: true,
      contraindicationsConfirmedNone: true,
      lastScreenedWeek: 8,
    },
  });
  const profile: EngineCoachProfile = {
    goalText: "活动",
    weeklyTarget: 3,
    sessionMinutes: 30,
    scheduleOriginalText: "",
    place: "home",
    equipment: ["none"],
    adultConfirmed: true,
    cautions: [],
    confirmedAt: at,
    population: source.population,
    screening: source.screening,
    healthStorageConsent: { acceptedAt: at },
    birthYearMonth: "1996-01",
  };
  const mapped = toEngineProfile(profile, {
    asOfDate: "2026-10-17",
    pregnancySafety: { supineAvoidSince: at },
  });
  expect(mapped).toBeDefined();
  expect(mapped!.pregnancySafety).toEqual({ avoidSupine: true });
  expect(runGates(mapped!).restrictions.excludePositions).toContain("supine");
  expect(
    toEngineProfile(profile, { asOfDate: "2026-10-17", pregnancySafety: {} }),
  ).toBeDefined();
});
