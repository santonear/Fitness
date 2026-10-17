import { afterEach, expect, it, vi } from "vitest";
import { generatePlan } from "../../../src/engine/pipeline";
import { adjust } from "../../../src/engine/operations/adjust";
import * as fitting from "../../../src/engine/fit";
import { checkHard } from "../../../src/engine/hard-checks";
import { createContext } from "../../../src/engine/pipeline";
import { baseProfile } from "../../../tools/eval/training-engine-profiles";
import { engineAction } from "../../../src/application/engine-plan";
import { coachRequestSchema } from "../../../src/coach/contracts";
import type { EngineProfile } from "../../../src/engine/contracts";
import type { SessionTemplate } from "../../../src/domain/v8/contracts";

const upper = [
  "push_horizontal",
  "push_vertical",
  "pull_horizontal",
  "pull_vertical",
  "isolation_upper",
];
function profile(minutes: number) {
  return baseProfile({
    sessionMinutes: minutes,
    level: "intermediate",
    trainingAgeWeeks: 52,
    daysPerWeek: 3,
    equipment: ["none", "dumbbell", "flat-bench"],
    constraints: { noJump: false, quiet: false, space: "small" },
  });
}
function request(template: SessionTemplate, p: EngineProfile) {
  return coachRequestSchema.parse({
    version: "fitness-coach-v8",
    task: "ADJUST_TODAY",
    requestId: crypto.randomUUID(),
    conversationId: crypto.randomUUID(),
    restoreGeneration: 0,
    inputSnapshot: "synthetic mainline fixture",
    sendConfirmation: "preview",
    locale: "zh",
    timeZone: "Asia/Shanghai",
    adultConfirmed: true,
    messages: [],
    trainingEngine: true,
    engineProfile: p,
    target: {
      planId: crypto.randomUUID(),
      versionId: crypto.randomUUID(),
      revision: 1,
    },
    template,
    instruction: "只练上肢",
  });
}
function errors(template: SessionTemplate, p: EngineProfile) {
  const ctx = createContext(p);
  return checkHard(
    {
      weeklyTarget: p.daysPerWeek,
      sessionMinutes: p.sessionMinutes,
      templates: [template],
      meta: {
        engineVersion: "2",
        rulesVersion: ctx.rules.data.rulesVersion,
        seed: ctx.profileHash,
      },
      trace: [],
      gates: ctx.gate.reasons,
      notices: [],
    },
    p,
    ctx.gate,
    ctx.rules,
  ).filter((issue) => issue.severity === "error");
}

afterEach(() => vi.restoreAllMocks());
it.each([30, 45])(
  "adjusts a real %i minute mainline draft to upper-only",
  (minutes) => {
    const p = profile(minutes),
      ctx = createContext(p),
      r = ctx.rules;
    const template = generatePlan(p).templates[0],
      before = structuredClone(template);
    const out = adjust(template, p, { focus: "upper" }, r);
    expect(template).toEqual(before);
    expect(out.noop).toBe(false);
    expect(
      out.value.items.every((i) =>
        upper.includes(r.byExercise.get(i.exerciseId)!.primary_pattern),
      ),
    ).toBe(true);
    expect(errors(out.value, p)).toEqual([]);
    expect(out.value.targetMinutes).toBe(minutes);
  },
);
it.each([30, 45])(
  "keeps a completed prefix immutable in a %i minute upper request",
  (minutes) => {
    const p = profile(minutes),
      ctx = createContext(p),
      r = ctx.rules,
      template = generatePlan(p).templates[0],
      before = structuredClone(template);
    const lower = template.items.findIndex(
      (i) =>
        i.prescription?.block === "main" &&
        ["squat", "hinge", "lunge"].includes(
          r.byExercise.get(i.exerciseId)!.primary_pattern,
        ),
    );
    expect(lower).toBeGreaterThanOrEqual(0);
    const locked = Array.from({ length: lower + 1 }, (_, index) => index),
      out = adjust(
        template,
        p,
        { focus: "upper", lockedItemIndexes: locked },
        r,
      );
    expect(template).toEqual(before);
    for (const index of locked)
      expect(out.value.items[index]).toEqual(before.items[index]);
    if (out.noop) expect(out.value).toEqual(before);
    else {
      expect(
        out.value.items.every(
          (item, index) =>
            locked.includes(index) ||
            upper.includes(r.byExercise.get(item.exerciseId)!.primary_pattern),
        ),
      ).toBe(true);
      expect(errors(out.value, p)).toEqual([]);
    }
    const action = engineAction(
      request(template, p),
      p,
      { kind: "adjust", request: { focus: "upper" } },
      locked,
    );
    if (out.noop) expect(action.response).toBeUndefined();
    else expect(action.noop).toBe(false);
  },
);
it("returns no application response for a genuinely infeasible beginner upper duration", () => {
  const p = { ...profile(30), level: "beginner" as const, trainingAgeWeeks: 0 },
    ctx = createContext(p),
    template = generatePlan(p).templates[0],
    before = structuredClone(template);
  const fit = fitting.fitDuration;
  let fitted: ReturnType<typeof fit> | undefined;
  vi.spyOn(fitting, "fitDuration").mockImplementation((...args) => {
    fitted = fit(...args);
    return fitted;
  });
  const out = adjust(template, p, { focus: "upper" }, ctx.rules);
  expect(fitted).toBeDefined();
  expect(errors(fitted!, p).map((issue) => issue.code)).toEqual([
    "duration_tolerance",
  ]);
  expect(out.noop).toBe(true);
  expect(out.value).toEqual(before);
  const prior = engineAction(
    request(generatePlan(profile(30)).templates[0], profile(30)),
    profile(30),
    { kind: "adjust", request: { focus: "upper" } },
  );
  expect(prior.response).toBeDefined();
  const denied = engineAction(request(template, p), p, {
    kind: "adjust",
    request: { focus: "upper" },
  });
  expect(denied.noop).toBe(true);
  expect(denied.response).toBeUndefined();
  expect(template).toEqual(before);
});
