import index44 from "../../fixtures/training-engine/cardio-duration-index44.json";
import { independentlyPossibleIds } from "../../../tools/eval/training-engine-quality";
import { externalIssues } from "../../../tools/eval/training-engine-invariants";
import { generatePlan, validatePlan } from "../../../src/engine";
import screenedKnee from "../../fixtures/training-engine/new-caution-adjustment.json";
import { engineProfileSchema } from "../../../src/engine/contracts";
import { fitDuration } from "../../../src/engine/fit";
import { createContext } from "../../../src/engine/pipeline";
import { expect, it } from "vitest";
import { Rules } from "../../../src/engine/data";
import type { EnginePlan, EngineProfile } from "../../../src/engine/contracts";
import { baseProfile } from "../../../tools/eval/training-engine-profiles";
import { runGates } from "../../../src/engine/gates";
import {
  cardioWorkCap,
  cardioWorkSeconds,
} from "../../../src/engine/fit/cardio-cap";
import { checkHard } from "../../../src/engine/hard-checks";
import { independentCardioDurationIssues } from "../../../src/engine/validation/cardio-duration";
function fixture() {
  const source = new Rules(),
    e = structuredClone(
      source.data.exercises.find((e) => e.slug === "walking")!,
    );
  e.slug = "synthetic-low-impact-cardio";
  e.space = "small";
  e.flags = ["low_intensity"];
  e.impact = 0;
  e.noise = 0;
  e.time.per_side = false;
  e.equipment_required = ["none"];
  e.equipment_alternatives = {};
  const data = structuredClone(source.data);
  data.exercises = [e];
  const r = new Rules(data),
    p: EngineProfile = { ...baseProfile(), sessionMinutes: 30 };
  const gate = runGates(p, r);
  return { e, r, p, gate };
}
function plan(
  id: string,
  seconds: number,
  sets = 1,
  perSide = false,
): EnginePlan {
  return {
    weeklyTarget: 1,
    sessionMinutes: 30,
    templates: [
      {
        id: "day",
        name: "test",
        estimatedMinutes: 10,
        targetMinutes: 30,
        items: [
          {
            exerciseId: id,
            equipment: "none",
            sets,
            target: { metricType: "duration", durationSeconds: seconds },
            prescription: {
              pattern: "cardio_cyclic",
              block: "conditioning",
              rir: [4, 5],
              restSeconds: 0,
              perSide,
              structure: "straight",
            },
          },
        ],
      },
    ],
    meta: { engineVersion: "2", rulesVersion: "test", seed: "fixed" },
    trace: [],
    notices: [],
    gates: [],
  };
}
it("uses 600 only for explicit low intensity with zero impact, otherwise 300", () => {
  const { e, r, p } = fixture();
  expect(cardioWorkCap(e, p, r)).toBe(600);
  e.impact = 1;
  expect(cardioWorkCap(e, p, r)).toBe(300);
  e.impact = 0;
  e.flags = [];
  expect(cardioWorkCap(e, p, r)).toBe(300);
});
it("honors a lower authored specialized ceiling", () => {
  const { e, r, p } = fixture();
  r.get("duration.cardio.cap").specialized_caps = [
    { when: { field: "slug", eq: e.slug }, max_work_seconds: 120 },
  ];
  expect(cardioWorkCap(e, p, r)).toBe(120);
});
it("counts the whole identity across sets and sides and ignores a forged short trace", () => {
  const { e, r, p, gate } = fixture();
  for (const [seconds, sets, side] of [
    [301, 2, false],
    [301, 1, true],
  ] as const) {
    const value = plan(e.id, seconds, sets, side);
    value.trace.push({
      ruleId: "duration.cardio.cap",
      reason: "intentional_short",
    });
    expect(cardioWorkSeconds(value.templates[0].items[0], e, r)).toBe(602);
    expect(checkHard(value, p, gate, r)).toContainEqual(
      expect.objectContaining({ code: "cardio_work_cap", severity: "error" }),
    );
    expect(independentCardioDurationIssues(value, p, r, [])).toContainEqual(
      expect.objectContaining({ code: "independent_cardio_work_cap" }),
    );
  }
});
it("rejects repeated identities even if separate rows are each under the cap", () => {
  const { e, r, p, gate } = fixture(),
    value = plan(e.id, 301);
  value.templates[0].items.push(structuredClone(value.templates[0].items[0]));
  const errors = checkHard(value, p, gate, r);
  expect(errors).toContainEqual(
    expect.objectContaining({ code: "duplicate_exercise" }),
  );
  expect(errors).toContainEqual(
    expect.objectContaining({ code: "cardio_work_cap" }),
  );
});
it("keeps the requested target and accepts a short session only after actual safe capacity is exhausted", () => {
  const { e, r, p, gate } = fixture(),
    value = plan(e.id, 600);
  expect(
    checkHard(value, p, gate, r).filter((e) => e.severity === "error"),
  ).toEqual([]);
  expect(checkHard(value, p, gate, r)).toContainEqual(
    expect.objectContaining({ code: "intentional_short", severity: "warning" }),
  );
  expect(value.templates[0].targetMinutes).toBe(30);
  expect(independentCardioDurationIssues(value, p, r, [e.id])).toEqual([]);
  value.templates[0].items[0].target = {
    metricType: "duration",
    durationSeconds: 300,
  };
  expect(checkHard(value, p, gate, r)).toContainEqual(
    expect.objectContaining({ code: "duration_tolerance" }),
  );
  expect(independentCardioDurationIssues(value, p, r, [e.id])).toContainEqual(
    expect.objectContaining({ code: "independent_short_capacity" }),
  );
});
it("does not accept shortage when a different safe aerobic identity is still available", () => {
  const { e, r, p, gate } = fixture(),
    other = { ...structuredClone(e), id: "other-cardio", slug: "other-cardio" };
  r.data.exercises.push(other);
  r.byExercise.set(other.id, other);
  const value = plan(e.id, 600);
  expect(checkHard(value, p, gate, r)).toContainEqual(
    expect.objectContaining({ code: "duration_tolerance" }),
  );
  expect(
    independentCardioDurationIssues(value, p, r, [e.id, other.id]),
  ).toContainEqual(
    expect.objectContaining({ code: "independent_short_capacity" }),
  );
});
it("cannot bypass the cap by reducing the declared target", () => {
  const { e, r, p, gate } = fixture(),
    value = plan(e.id, 601);
  value.templates[0].targetMinutes = 10;
  expect(checkHard(value, p, gate, r)).toContainEqual(
    expect.objectContaining({ code: "cardio_work_cap" }),
  );
});

it("fits a genuinely exhausted short class without expanding a bout or lowering the requested target", () => {
  const { e, r, p } = fixture(),
    value = plan(e.id, 60),
    ctx = createContext(p, 0, r),
    template = value.templates[0],
    fitted = fitDuration({ ...template, slots: [] }, 30, ctx);
  expect(fitted.targetMinutes).toBe(30);
  expect(fitted.items).toHaveLength(1);
  expect(cardioWorkSeconds(fitted.items[0], e, r)).toBe(600);
  expect(fitted.estimatedSeconds).toBe(600);
  expect(ctx.trace).toContainEqual(
    expect.objectContaining({ reason: "intentional_short" }),
  );
});
it("fills with different safe identities instead of repeating or extending a capped action", () => {
  const { e, r, p } = fixture(),
    other = {
      ...structuredClone(e),
      id: "other-cardio",
      slug: "other-cardio",
      flags: ["low_intensity"],
      impact: 0,
    };
  r.data.exercises.push(other);
  r.byExercise.set(other.id, other);
  const value = plan(e.id, 60),
    ctx = createContext(p, 0, r),
    fitted = fitDuration({ ...value.templates[0], slots: [] }, 30, ctx);
  expect(new Set(fitted.items.map((i) => i.exerciseId)).size).toBe(
    fitted.items.length,
  );
  expect(fitted.items.map((i) => i.exerciseId)).toContain(other.id);
  for (const item of fitted.items) {
    const exercise = r.byExercise.get(item.exerciseId)!;
    expect(cardioWorkSeconds(item, exercise, r)).toBeLessThanOrEqual(
      cardioWorkCap(exercise, p, r, ctx.gate),
    );
  }
  expect(fitted.targetMinutes).toBe(30);
});

const requestedProfiles = (() => {
  const general = baseProfile(),
    pregnant = {
      ...general,
      daysPerWeek: 3,
      population: {
        kind: "pregnant",
        week: 20,
        providerCleared: true,
        contraindicationsConfirmedNone: true,
        lastScreenedWeek: 20,
      },
    },
    older = {
      ...general,
      daysPerWeek: 3,
      birthYearMonth: "1956-01",
      population: {
        kind: "older_adult",
        fallsAnswers: [false, false, false, false],
        balanceCautious: false,
      },
    },
    knee = {
      ...screenedKnee.profile,
      equipment: ["none"],
      cautions: ["knee"],
      constraints: {
        ...screenedKnee.profile.constraints,
        quiet: true,
        noJump: true,
      },
    },
    postpartum = {
      ...general,
      daysPerWeek: 3,
      population: {
        kind: "postpartum",
        weeksSinceBirth: 6,
        delivery: "cesarean",
        cleared: false,
      },
    };
  return [
    { name: "pregnant week20", profile: pregnant },
    { name: "older age70 three days", profile: older },
    { name: "bodyweight quiet noJump screened knee", profile: knee },
    { name: "cesarean week6 uncleared", profile: postpartum },
  ].map((row) => ({
    name: row.name,
    profile: engineProfileSchema.parse(row.profile),
  }));
})();
it.each(requestedProfiles)(
  "keeps bounded distinct safe classes for requested $name",
  ({ profile }) => {
    const r = new Rules(),
      value = generatePlan(profile);
    expect(value.templates.length).toBeGreaterThan(0);
    expect(
      externalIssues(value, profile).filter(
        (issue) => issue.severity === "error",
      ),
    ).toEqual([]);
    expect(
      validatePlan(value, profile).filter(
        (issue) => issue.severity === "error",
      ),
    ).toEqual([]);
    for (const template of value.templates) {
      expect(template.items.length).toBeGreaterThan(0);
      expect(new Set(template.items.map((i) => i.exerciseId)).size).toBe(
        template.items.length,
      );
      for (const item of template.items) {
        const exercise = r.byExercise.get(item.exerciseId)!;
        expect(exercise.flags).not.toContain("running");
        expect(exercise.flags).not.toContain("jumping");
        if (exercise.modality === "cardio")
          expect(cardioWorkSeconds(item, exercise, r)).toBeLessThanOrEqual(
            cardioWorkCap(exercise, profile, r, runGates(profile, r)),
          );
      }
    }
    const third = value.templates[2];
    if (third)
      for (const item of third.items) {
        const exercise = r.byExercise.get(item.exerciseId)!;
        if (exercise.modality === "cardio")
          expect(cardioWorkSeconds(item, exercise, r)).toBeLessThanOrEqual(
            cardioWorkCap(exercise, profile, r),
          );
      }
  },
);

it("rejects a forged non-duration aerobic target instead of treating unknown seconds as zero", () => {
  const { e, r, p, gate } = fixture(),
    value = plan(e.id, 60);
  value.templates[0].items[0].target = { metricType: "reps", reps: 99999 };
  expect(checkHard(value, p, gate, r)).toContainEqual(
    expect.objectContaining({ code: "cardio_work_cap" }),
  );
  expect(independentCardioDurationIssues(value, p, r, [])).toContainEqual(
    expect.objectContaining({ code: "independent_cardio_work_cap" }),
  );
});

it("recomputes source capacity for fixed80 index44 without trusting producer short markers", () => {
  const p = engineProfileSchema.parse(index44.profile),
    r = new Rules(),
    value = generatePlan(p),
    possible = new Set(independentlyPossibleIds(p, r));
  for (const e of r.data.exercises.filter((e) => e.flags.includes("running")))
    expect(possible.has(e.id), e.slug).toBe(false);
  expect(externalIssues(value, p)).toEqual([]);
  expect(
    validatePlan(value, p).filter((issue) => issue.severity === "error"),
  ).toEqual([]);
  expect(
    value.quality?.issues?.filter(
      (issue) => issue.code === "intentional_short",
    ),
  ).toHaveLength(0);
});
it("keeps running in the independent possible pool when both explicit movement restrictions are lifted", () => {
  const p = engineProfileSchema.parse(index44.profile),
    r = new Rules(),
    running = r.data.exercises.find((e) => e.slug === "running")!;
  p.constraints.noJump = false;
  p.preferences.cannotDo = p.preferences.cannotDo.filter(
    (value) => value !== "jumping",
  );
  expect(independentlyPossibleIds(p, r)).toContain(running.id);
  p.constraints.noJump = true;
  expect(independentlyPossibleIds(p, r)).not.toContain(running.id);
  p.constraints.noJump = false;
  p.preferences.cannotDo.push("jumping");
  expect(independentlyPossibleIds(p, r)).not.toContain(running.id);
});
