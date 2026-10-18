import { afterEach, expect, it, vi } from "vitest";
import { createV8Workflow } from "../../src/application/v8-workflow";
import {
  toEngineProfile,
  type EngineCoachProfile,
} from "../../src/application/engine-profile";
import * as flags from "../../src/application/feature-flags";
import type { Repository } from "../../src/persistence/repository";
import type { PlanVersion, WorkoutRecord } from "../../src/domain/v8/contracts";
import { baseProfile } from "../../tools/eval/training-engine-profiles";
import { localProfile } from "../../src/application/rules/local-profile";

const at = "2026-10-18T01:00:00.000Z";
function setup() {
  let state = {
    id: "v8",
    legacyPlanIds: [] as string[],
    currentPlanId: undefined as string | undefined,
    coachProfile: undefined as EngineCoachProfile | undefined,
  };
  const plans: {
      id: string;
      currentVersionId: string;
      readOnly: boolean;
      name: string;
    }[] = [],
    versions: PlanVersion[] = [],
    workouts: WorkoutRecord[] = [];
  const empty = { toArray: async () => [] };
  const db = {
    tables: [],
    transaction: async (_mode: unknown, _tables: unknown, fn: () => unknown) =>
      fn(),
    v8State: {
      get: async () => state,
      put: async (value: typeof state) => {
        state = value;
      },
    },
    v8Plans: {
      get: async (id: string) => plans.find((p) => p.id === id),
      toArray: async () => plans,
      toCollection: () => ({ modify: async () => {} }),
      add: async (value: (typeof plans)[number]) => plans.push(value),
    },
    v8PlanVersions: {
      toArray: async () => versions,
      add: async (value: PlanVersion) => versions.push(value),
    },
    v8Workouts: { toArray: async () => workouts },
    profiles: {
      toCollection: () => ({
        first: async () => ({
          id: "local-person",
          timeZone: "Asia/Shanghai",
          locale: "zh",
        }),
      }),
    },
    aiMemoryNotes: empty,
    v8PlanReferences: empty,
    v8Activities: empty,
  };
  return {
    workflow: createV8Workflow({
      db,
      readMetadata: async () => ({ dataRevision: 1, restoreGeneration: 0 }),
      write: async (fn: () => unknown) => fn(),
    } as unknown as Repository),
    versions,
  };
}
function profile(savedAt = at): EngineCoachProfile {
  const source = baseProfile();
  return {
    goalText: "规律训练",
    goal: "health",
    weeklyTarget: 1,
    sessionMinutes: 10,
    scheduleOriginalText: "每周1次，每次10分钟",
    place: "home",
    equipment: ["none"],
    adultConfirmed: true,
    cautions: [],
    confirmedAt: savedAt,
    healthStorageConsent: { acceptedAt: savedAt },
    screening: {
      ...source.screening,
      completedAt: savedAt,
      lastScreenedAt: savedAt,
    },
    birthYearMonth: "1990-01",
    population: { kind: "general" },
    constraints: { noJump: false, quiet: false, space: "small" },
  };
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
it("keeps an inactive forty-year-old's spoken ten minutes through generation and adoption", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(at));
  vi.spyOn(flags, "isFeatureEnabled").mockReturnValue(true);
  const input = {
    ...profile(),
    ...localProfile({ goalText: "规律训练", scheduleOriginalText: "每周1次，每次10分钟", placeEquipmentText: "在家，徒手", adultConfirmed: true, cautions: [] }),
    birthYearMonth: "1986-01",
    screening: { ...profile().screening!, activityStatus: "inactive" as const },
  };
  expect(input.sessionMinutes).toBe(10);
  const service = setup();
  const candidate = await service.workflow.propose(input, "zh", { trainingEngine: true });
  expect(candidate.proposal.sessionMinutes).toBe(10);
  const adopted = await service.workflow.adopt(candidate);
  for (const template of adopted.templates) {
    expect(template.targetMinutes).toBe(10);
    expect(template.estimatedSeconds).toBeGreaterThanOrEqual(480);
    expect(template.estimatedSeconds).toBeLessThanOrEqual(720);
    expect(template.estimatedMinutes).toBe(Math.ceil(template.estimatedSeconds! / 60));
  }
});
it("preserves exact engine duration through propose, adopt, and first next preview", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(at));
  vi.spyOn(flags, "isFeatureEnabled").mockReturnValue(true);
  const service = setup(),
    input = profile(),
    candidate = await service.workflow.propose(input, "zh", {
      trainingEngine: true,
    });
  const engine = candidate.enginePlan!.templates[0];
  const adopted = await service.workflow.adopt(candidate),
    preview = await service.workflow.nextTargetPreview(adopted.templates[0].id);
  console.info(
    "one-by-ten-duration",
    JSON.stringify({
      inputMinutes: input.sessionMinutes,
      engine: {
        seconds: engine.estimatedSeconds,
        minutes: engine.estimatedMinutes,
        target: engine.targetMinutes,
      },
      proposal: candidate.proposal.templates[0].estimatedMinutes,
      adopted: adopted.templates[0].estimatedMinutes,
      next: {
        blocked: preview.blocked,
        seconds: preview.template?.estimatedSeconds,
        minutes: preview.template?.estimatedMinutes,
        target: preview.template?.targetMinutes,
      },
      mapped: toEngineProfile(input, {
        asOfDate: "2026-10-18",
        timeZone: "Asia/Shanghai",
        locale: "zh",
      })?.sessionMinutes,
    }),
  );
  expect(candidate.proposal.templates[0]).toEqual(engine);
  expect(adopted.templates[0]).toEqual(engine);
  expect(preview.blocked).toBe(false);
  expect(preview.template?.estimatedMinutes).toBe(
    Math.ceil(preview.template!.estimatedSeconds! / 60),
  );
  expect(preview.template?.estimatedSeconds).toBe(engine.estimatedSeconds);
});
it("produces the same candidate for separate onboarding submissions with equal answers", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(at));
  const first = await setup().workflow.propose(profile(), "zh", {
    trainingEngine: true,
  });
  const second = await setup().workflow.propose(
    profile("2026-10-18T00:30:00.000Z"),
    "zh",
    { trainingEngine: true },
  );
  expect(first.enginePlan).toEqual(second.enginePlan);
  expect(first.proposal.templates).toEqual(second.proposal.templates);
});
