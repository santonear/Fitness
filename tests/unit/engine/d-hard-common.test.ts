import { describe, it, expect } from "vitest";
import { Rules, type Exercise } from "../../../src/engine/data";
import { checkHard } from "../../../src/engine/hard-checks";
import type {
  EngineProfile,
  GateOutcome,
  Plan,
} from "../../../src/engine/contracts";
import { fixtureProfile, planFixture } from "./fixtures";
const source = new Rules(),
  walking = source.data.exercises.find((e) => e.slug === "walking")!;
function fixture(
  overrides: Partial<EngineProfile> = {},
  population: GateOutcome["restrictions"]["population"] = "general",
  phase = 0,
) {
  const exercise: Exercise = {
      ...walking,
      id: "d-common-work",
      primary_pattern: "squat",
      modality: "strength",
      metricType: "reps",
      impact: 0,
      primaryMuscles: ["quadriceps"],
      equipment_required: ["none"],
      position: ["standing"],
      flags: [],
      difficulty: 1,
    },
    rules = new Rules({ ...source.data, exercises: [exercise] }),
    plan = planFixture(),
    profile = {
      ...fixtureProfile,
      level: "intermediate" as const,
      ...overrides,
    },
    gate: GateOutcome = {
      status: "ok",
      reasons: [],
      notices: [],
      trace: [],
      restrictions: {
        blocked: false,
        gates: [],
        notices: [],
        trace: [],
        user: {
          hypertension: "controlled",
          gestation_week: 20,
          postpartum_phase: phase,
        },
        maxRpe: 10,
        maxIntensity: 10,
        rirMin: 0,
        phase,
        population,
        eligibility: new Map(),
        allowedBundles: [],
        excludeFlags: [],
        excludePositions: [],
      },
    };
  plan.templates[0].items[0] = {
    exerciseId: exercise.id,
    equipment: "none",
    sets: 2,
    target: { metricType: "reps", reps: 12 },
    prescription: {
      pattern: "squat",
      block: "main",
      rir: [3, 3],
      restSeconds: 120,
      targetRpe: [5, 5],
      structure: "straight",
    },
  };
  return { exercise, rules, plan, profile, gate };
}
const has = (f: ReturnType<typeof fixture>, code: string) =>
  checkHard(f.plan, f.profile, f.gate, f.rules).some((i) => i.code === code);
describe("D observed hard subconditions independently from other modules", () => {
  it("power uses authored RIR and rest bounds even when sets and reps are legal", () => {
    const f = fixture();
    f.exercise.primary_pattern = "throw_upper";
    f.exercise.modality = "power";
    const i = f.plan.templates[0].items[0];
    i.sets = 3;
    i.target = { metricType: "reps", reps: 4 };
    i.prescription!.rir = [2, 2];
    expect(has(f, "power_effort_rest")).toBe(false);
    i.prescription!.rir = [1, 1];
    expect(has(f, "power_effort_rest")).toBe(true);
    i.prescription!.rir = [2, 2];
    i.prescription!.restSeconds = 10;
    expect(has(f, "power_effort_rest")).toBe(true);
  });
  it("introductory week three reads its RIR array rather than an absent rir_min", () => {
    const f = fixture({ level: "beginner", trainingAgeWeeks: 2 }),
      i = f.plan.templates[0].items[0];
    i.prescription!.rir = [2, 2];
    expect(has(f, "intro_dose")).toBe(false);
    i.prescription!.rir = [1, 1];
    expect(has(f, "intro_dose")).toBe(true);
  });
  it("introductory eccentric cadence has a source cap", () => {
    const f = fixture({ level: "beginner", trainingAgeWeeks: 0 }),
      i = f.plan.templates[0].items[0];
    i.prescription!.tempo = {
      eccentricSeconds: 3,
      concentricSeconds: 1,
      pauseSeconds: 0,
    };
    expect(has(f, "intro_tempo")).toBe(false);
    i.prescription!.tempo.eccentricSeconds = 4;
    expect(has(f, "intro_tempo")).toBe(true);
  });
  it("introductory working exercise count obeys its source ceiling", () => {
    const f = fixture({ level: "beginner", trainingAgeWeeks: 0 }),
      item = f.plan.templates[0].items[0];
    item.sets = 1;
    f.plan.templates[0].items = Array.from({ length: 6 }, () =>
      structuredClone(item),
    );
    expect(has(f, "intro_exercise_count")).toBe(false);
    f.plan.templates[0].items.push(structuredClone(item));
    expect(has(f, "intro_exercise_count")).toBe(true);
  });
  it("intermediate strength main direct sets remain capped at three", () => {
    const f = fixture({ goal: "strength" }),
      i = f.plan.templates[0].items[0];
    i.sets = 3;
    expect(has(f, "strength_main_sets")).toBe(false);
    i.sets = 4;
    expect(has(f, "strength_main_sets")).toBe(true);
  });
  it("older adult repetitions use the known introductory phase", () => {
    const f = fixture(
        { population: { kind: "older_adult" }, trainingAgeWeeks: 0 },
        "older_adult",
      ),
      i = f.plan.templates[0].items[0];
    i.target = { metricType: "reps", reps: 10 };
    expect(has(f, "older_reps")).toBe(false);
    i.target.reps = 9;
    expect(has(f, "older_reps")).toBe(true);
  });
  it("pregnancy explicit RPE source cap survives a permissive generic gate fixture", () => {
    const f = fixture(
        {
          population: {
            kind: "pregnant",
            week: 20,
            providerCleared: true,
            prenatalCareConfirmed: true,
            contraindicationsConfirmedNone: true,
          },
        },
        "pregnant",
      ),
      i = f.plan.templates[0].items[0];
    i.prescription!.targetRpe = [6, 6];
    expect(has(f, "pregnancy_rpe")).toBe(false);
    i.prescription!.targetRpe = [7, 7];
    expect(has(f, "pregnancy_rpe")).toBe(true);
  });
  it("phase-two postpartum strength keeps its authored effort margin", () => {
    const f = fixture(
        {
          population: {
            kind: "postpartum",
            weeksSinceBirth: 8,
            delivery: "vaginal",
            cleared: true,
          },
        },
        "postpartum",
        2,
      ),
      i = f.plan.templates[0].items[0];
    expect(has(f, "postpartum_phase2_effort")).toBe(false);
    i.prescription!.rir = [2, 2];
    expect(has(f, "postpartum_phase2_effort")).toBe(true);
  });
});
it("blood-pressure and clearance source effort caps remain independently inspectable", () => {
  const f = fixture(),
    i = f.plan.templates[0].items[0];
  f.gate.restrictions.user.hypertension = "unknown";
  i.prescription!.targetRpe = [7, 7];
  expect(has(f, "hypertension_rpe")).toBe(false);
  i.prescription!.targetRpe = [8, 8];
  expect(has(f, "hypertension_rpe")).toBe(true);
  f.gate.restrictions.user.hypertension = "controlled";
  f.gate.restrictions.user.clearance_state = "required";
  i.prescription!.targetRpe = [5, 5];
  expect(has(f, "clearance_effort")).toBe(false);
  i.prescription!.targetRpe = [6, 6];
  expect(has(f, "clearance_effort")).toBe(true);
});
