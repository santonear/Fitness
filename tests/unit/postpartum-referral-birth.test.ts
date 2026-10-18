import {
  createPostpartumReferral,
  postpartumReferralKeys,
  postpartumReferralSchema,
  needsPostpartumReferralCheck,
  referralOccasions,
  requestedPostpartumPhase,
} from "../../src/application/postpartum-referral";
import { createBirthReport } from "../../src/application/birth-report";
import { prescribe } from "../../src/engine/dose";
import { runGates } from "../../src/engine/gates";
import { Rules } from "../../src/engine/data";
import { v8CoachProfileSchema } from "../../src/domain/schemas";
import { afterEach, expect, it, vi } from "vitest";
import { createV8Workflow } from "../../src/application/v8-workflow";
import {
  createPostpartumSafety,
  postpartumReportSchema,
  twoSymptomFreeWeeks,
} from "../../src/application/postpartum-safety";
import { v8StateSchema, v8WorkoutSchema } from "../../src/domain/schemas";
import { DATA } from "../../src/engine/data";
import { baseProfile } from "../../tools/eval/training-engine-profiles";
import { toEngineProfile } from "../../src/application/engine-profile";
import type {
  CoachProfile,
  WorkoutRecord,
} from "../../src/domain/v8/contracts";
import type { Repository } from "../../src/persistence/repository";
const at = "2026-10-15T02:00:00.000Z",
  id = "a1111111-1111-4111-8111-111111111111";
const urgent = DATA.rules.find((r) => r.id === "postpartum.urgent")!.value!
    .items as string[],
  symptoms = DATA.rules.find((r) => r.id === "postpartum.symptom_regression")!
    .value!.when.contains_any as string[];
const negative = () => ({
  urgent: Object.fromEntries(urgent.map((k) => [k, false])),
  regression: Object.fromEntries(symptoms.map((k) => [k, false])),
});
function fixture() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(at));
  const p = baseProfile({
      population: {
        kind: "postpartum",
        weeksSinceBirth: 20,
        delivery: "vaginal",
        cleared: true,
      },
    }),
    walk = DATA.exercises.find((e) => e.slug === "walking")!;
  const profile: CoachProfile = {
    goalText: "活动",
    goal: "health",
    weeklyTarget: 3,
    sessionMinutes: 30,
    scheduleOriginalText: "",
    place: "home",
    equipment: ["none"],
    adultConfirmed: true,
    cautions: [],
    confirmedAt: at,
    population: p.population,
    screening: p.screening,
    healthStorageConsent: { acceptedAt: at },
  };
  let state = v8StateSchema.parse({
      id: "v8",
      migratedAt: at,
      legacyPlanIds: [],
      notice: { planCount: 0, acknowledged: true },
      coachProfile: profile,
    }),
    rows: WorkoutRecord[] = [
      {
        id,
        startedAt: at,
        localDate: "2026-10-15",
        timeZone: "Asia/Shanghai",
        status: "in_progress",
        plannedSetCount: 2,
        plannedExercises: [
          { exerciseId: walk.id, itemIndex: 0, plannedSetCount: 2 },
        ],
        sets: [
          {
            exerciseId: walk.id,
            itemIndex: 0,
            setIndex: 0,
            durationSeconds: 30,
            completedAt: at,
          },
        ],
      },
    ],
    revision = 0,
    fail = false;
  const repo = {
    readMetadata: async () => ({
      dataRevision: revision,
      restoreGeneration: 0,
    }),
    write: async <T>(fn: () => Promise<T>, expected?: number) => {
      if (expected !== undefined && expected !== revision)
        throw Error("STALE_REVISION");
      const before = structuredClone({ state, rows, revision });
      try {
        const out = await fn();
        revision++;
        return out;
      } catch (e) {
        ({ state, rows, revision } = before);
        throw e;
      }
    },
    db: {
      profiles: {
        toCollection: () => ({
          first: async () => ({ timeZone: "Asia/Shanghai", locale: "zh" }),
        }),
      },
      sessions: { where: () => ({ equals: () => ({ count: async () => 0 }) }) },
      v8Plans: { toArray: async () => [] },
      v8Workouts: {
        get: async (key: string) =>
          structuredClone(rows.find((r) => r.id === key)),
        toArray: async () => structuredClone(rows),
        put: async (row: WorkoutRecord) => {
          rows = rows.map((old) =>
            old.id === row.id ? structuredClone(row) : old,
          );
        },
        add: async (row: WorkoutRecord) => {
          rows.push(structuredClone(row));
        },
        where: () => ({
          equals: (status: string) => ({
            count: async () => rows.filter((r) => r.status === status).length,
            toArray: async () =>
              structuredClone(rows.filter((r) => r.status === status)),
          }),
        }),
      },
      v8State: {
        get: async () => structuredClone(state),
        put: async (value: typeof state) => {
          if (fail) throw Error("WRITE_FAILED");
          state = v8StateSchema.parse(value);
        },
      },
      trainingCheckins: {
        clear: async () => {},
        get: async () => undefined,
        toArray: async () => [],
        where: () => ({ belowOrEqual: () => ({ delete: async () => {} }) }),
      },
      aiMemoryNotes: { toArray: async () => [] },
    },
  } as unknown as Repository;
  return {
    repo,
    workflow: createV8Workflow(repo),
    safety: createPostpartumSafety(repo),
    walk,
    get state() {
      return state;
    },
    get rows() {
      return rows;
    },
    get revision() {
      return revision;
    },
    setItem: (
      item: NonNullable<WorkoutRecord["templateSnapshot"]>["items"][number],
    ) => {
      rows[0] = {
        ...rows[0],
        sets: [],
        plannedSetCount: item.sets,
        templateSnapshot: {
          id: "actual",
          name: "actual",
          estimatedMinutes: 30,
          items: [item],
        },
        plannedExercises: [
          {
            exerciseId: item.exerciseId,
            itemIndex: 0,
            plannedSetCount: item.sets,
          },
        ],
      };
    },
    fail: () => {
      fail = true;
    },
    reopen: () => {
      rows[0].status = "in_progress";
    },
    end: () => {
      rows[0].status = "partial";
    },
  };
}
afterEach(() => vi.useRealTimers());
const referralNegative = () =>
  Object.fromEntries(postpartumReferralKeys.map((key) => [key, false]));
it.each(postpartumReferralKeys)(
  "runs actual source regression for the full referral condition %s without inventing a generic symptom",
  async (key) => {
    const f = fixture();
    await f.repo.db.v8State.put({
      ...f.state,
      postpartumReferralChecks: { weekly_checkin: { answeredAt: at } },
      cardiacPause: { requiredAt: at },
    });
    const out = await createPostpartumReferral(f.repo).report(
      { occasion: "weekly_checkin", answers: { [key]: true } },
      0,
    );
    expect(out).toMatchObject({
      positive: true,
      copyKey: "postpartum.copy.warning.warning",
    });
    expect(f.state.postpartumSafety).toMatchObject({
      lastSymptomAt: at,
      regression: { phase: 2, requiredAt: at, symptomFreeDates: [] },
    });
    expect(f.state.postpartumReferralChecks).toBeUndefined();
    expect(f.state.cardiacPause?.requiredAt).toBe(at);
    expect(f.rows[0].postpartumSymptoms).toBeUndefined();
  },
);
it.each(referralOccasions)(
  "requires all seven explicit negatives and retains the actual %s occasion",
  async (occasion) => {
    const f = fixture();
    expect(
      postpartumReferralSchema.safeParse({ occasion, phase: 2, answers: {} })
        .success,
    ).toBe(false);
    await createPostpartumReferral(f.repo).report(
      { occasion, phase: 2, answers: referralNegative() },
      0,
    );
    expect(f.state.postpartumReferralChecks?.[occasion]?.answeredAt).toBe(at);
    expect(f.state.postpartumSafety?.regression).toBeUndefined();
  },
);
it("asks once each local week, and a weekly answer cannot substitute for a phase transition or running attempt", () => {
  const checks = {
      weekly_checkin: { answeredAt: at },
      each_phase_transition: { answeredAt: at, phase: 2 as const },
      running_readiness_check: { answeredAt: at },
    },
    input = { asOfDate: "2026-10-15", timeZone: "Asia/Shanghai" };
  expect(needsPostpartumReferralCheck(checks, "weekly_checkin", input)).toBe(
    false,
  );
  expect(
    needsPostpartumReferralCheck(checks, "weekly_checkin", {
      ...input,
      asOfDate: "2026-10-19",
    }),
  ).toBe(true);
  expect(
    needsPostpartumReferralCheck(
      { weekly_checkin: checks.weekly_checkin },
      "each_phase_transition",
      { ...input, phase: 2, requestedAt: at },
    ),
  ).toBe(true);
  expect(
    needsPostpartumReferralCheck(checks, "each_phase_transition", {
      ...input,
      phase: 3,
      requestedAt: at,
    }),
  ).toBe(true);
  expect(
    needsPostpartumReferralCheck(checks, "each_phase_transition", {
      ...input,
      phase: 2,
      requestedAt: at,
    }),
  ).toBe(false);
  expect(
    needsPostpartumReferralCheck(checks, "running_readiness_check", {
      ...input,
      requestedAt: "2026-10-15T03:00:00Z",
    }),
  ).toBe(true);
  expect(
    needsPostpartumReferralCheck(checks, "running_readiness_check", {
      ...input,
      requestedAt: at,
    }),
  ).toBe(false);
});
it("cannot treat partial, unknown or generic symptom keys as a completed referral screen", () => {
  expect(
    postpartumReferralSchema.safeParse({
      occasion: "weekly_checkin",
      answers: { leakage: true },
    }).success,
  ).toBe(false);
  expect(
    postpartumReferralSchema.safeParse({
      occasion: "weekly_checkin",
      answers: { [postpartumReferralKeys[0]]: false },
    }).success,
  ).toBe(false);
  expect(
    postpartumReferralSchema.safeParse({
      occasion: "each_phase_transition",
      answers: referralNegative(),
    }).success,
  ).toBe(false);
});
it("does not store negative health evidence without consent, but preserves a positive safety episode", async () => {
  const f = fixture();
  await f.repo.db.v8State.put({
    ...f.state,
    coachProfile: { ...f.state.coachProfile!, healthStorageConsent: undefined },
  });
  await expect(
    createPostpartumReferral(f.repo).report(
      { occasion: "weekly_checkin", answers: referralNegative() },
      0,
    ),
  ).rejects.toThrow("HEALTH_STORAGE_CONSENT_REQUIRED");
  await createPostpartumReferral(f.repo).report(
    {
      occasion: "weekly_checkin",
      answers: { [postpartumReferralKeys[2]]: true },
    },
    0,
  );
  expect(f.state.postpartumSafety?.regression?.phase).toBe(2);
  expect(f.state.postpartumReferralChecks).toBeUndefined();
});
async function pregnantFixture() {
  const f = fixture();
  await f.repo.db.v8State.put({
    ...f.state,
    coachProfile: {
      ...f.state.coachProfile!,
      population: {
        kind: "pregnant",
        week: 39,
        providerCleared: true,
        prenatalCareConfirmed: true,
        contraindicationsConfirmedNone: true,
      },
    },
    cardiacPause: { requiredAt: at },
    trainingPause: { requiredAt: at },
    pregnancySafety: {
      providerPause: { requiredAt: at },
      supineAvoidSince: at,
    },
    postpartumSafety: { lastSymptomAt: at, urgentAt: at },
  });
  return f;
}
const birth = {
  delivery: "cesarean" as const,
  perinealTrauma: false,
  postnatalCheckDone: false,
  cleared: false,
};
it("birth atomically ends current training and activates postpartum week zero while preserving every independent safety fact", async () => {
  const f = await pregnantFixture(),
    facts = structuredClone(f.rows[0].sets),
    prior = structuredClone(f.state);
  await createBirthReport(f.repo).report(birth, 0);
  expect(f.rows[0]).toMatchObject({
    status: "partial",
    endedAt: at,
    sets: facts,
  });
  expect(f.state.coachProfile?.population).toEqual({
    kind: "postpartum",
    weeksSinceBirth: 0,
    ...birth,
  });
  expect(f.state.coachProfile?.screening?.rescreenRequired).toBe(true);
  for (const key of [
    "cardiacPause",
    "trainingPause",
    "pregnancySafety",
    "postpartumSafety",
  ] as const)
    expect(f.state[key]).toEqual(prior[key]);
  expect(f.revision).toBe(1);
});
it("rolls birth and completed-workout facts back together on persistence failure", async () => {
  const f = await pregnantFixture(),
    before = structuredClone({ state: f.state, rows: f.rows });
  f.fail();
  await expect(createBirthReport(f.repo).report(birth, 0)).rejects.toThrow(
    "WRITE_FAILED",
  );
  expect(f.state).toEqual(before.state);
  expect(f.rows).toEqual(before.rows);
  expect(f.revision).toBe(0);
});
it("does not guess birth activation answers or accept stale revisions", async () => {
  const f = await pregnantFixture();
  await expect(
    createBirthReport(f.repo).report({ delivery: "vaginal" } as never, 0),
  ).rejects.toThrow();
  await expect(createBirthReport(f.repo).report(birth, 1)).rejects.toThrow(
    "STALE_REVISION",
  );
  expect(f.state.coachProfile?.population?.kind).toBe("pregnant");
});

it("derives transition phases from source six/twelve-week boundaries, the four-week buffer and clearance", () => {
  expect(requestedPostpartumPhase({ kind: "general" })).toBeUndefined();
  expect(
    requestedPostpartumPhase({
      kind: "postpartum",
      weeksSinceBirth: 6,
      delivery: "vaginal",
      cleared: true,
    }),
  ).toBe(2);
  expect(
    requestedPostpartumPhase({
      kind: "postpartum",
      weeksSinceBirth: 12,
      delivery: "vaginal",
      cleared: true,
    }),
  ).toBe(3);
  expect(
    requestedPostpartumPhase({
      kind: "postpartum",
      weeksSinceBirth: 9,
      delivery: "cesarean",
      cleared: true,
    }),
  ).toBe(1);
  expect(
    requestedPostpartumPhase({
      kind: "postpartum",
      weeksSinceBirth: 10,
      delivery: "cesarean",
      cleared: true,
    }),
  ).toBe(2);
  expect(
    requestedPostpartumPhase({
      kind: "postpartum",
      weeksSinceBirth: 16,
      delivery: "cesarean",
      cleared: true,
    }),
  ).toBe(3);
  expect(
    requestedPostpartumPhase({
      kind: "postpartum",
      weeksSinceBirth: 20,
      delivery: "vaginal",
      cleared: false,
    }),
  ).toBe(1);
});
it("rejects missing or malformed attempt times instead of treating them as current negative proof", () => {
  const checks = { running_readiness_check: { answeredAt: at } },
    input = { asOfDate: "2026-10-15", timeZone: "Asia/Shanghai" };
  expect(
    needsPostpartumReferralCheck(checks, "running_readiness_check", input),
  ).toBe(true);
  expect(
    needsPostpartumReferralCheck(checks, "running_readiness_check", {
      ...input,
      requestedAt: "invalid",
    }),
  ).toBe(true);
});

// These service tests call the real workflow through the rollback-capable in-memory Repository fake above; not IndexedDB/browser E2E.
async function transitionFixture() {
  const f = fixture();
  await f.repo.db.v8State.put({
    ...f.state,
    coachProfile: {
      ...f.state.coachProfile!,
      population: {
        kind: "postpartum",
        weeksSinceBirth: 2,
        delivery: "vaginal",
        cleared: true,
        readinessChecklistPassed: false,
      },
    },
  });
  return f;
}
function nextPostpartum(
  f: Awaited<ReturnType<typeof transitionFixture>>,
  weeks = 12,
  ready = false,
): CoachProfile {
  return {
    ...f.state.coachProfile!,
    population: {
      kind: "postpartum",
      weeksSinceBirth: weeks,
      delivery: "vaginal",
      cleared: true,
      readinessChecklistPassed: ready,
    },
  };
}
it("workflow refuses an old weekly negative as evidence for an actual phase increase", async () => {
  const f = await transitionFixture();
  await createPostpartumReferral(f.repo).report(
    { occasion: "weekly_checkin", answers: referralNegative() },
    0,
  );
  await expect(
    f.workflow.saveEngineSettings(nextPostpartum(f, 6), f.revision, at),
  ).rejects.toThrow("POSTPARTUM_REFERRAL_CHECK_REQUIRED");
  expect(f.state.coachProfile?.population).toMatchObject({
    weeksSinceBirth: 2,
  });
});
it("workflow refuses a phase-two negative for a phase-three transition", async () => {
  const f = await transitionFixture();
  await createPostpartumReferral(f.repo).report(
    {
      occasion: "each_phase_transition",
      phase: 2,
      answers: referralNegative(),
    },
    0,
  );
  await expect(
    f.workflow.saveEngineSettings(nextPostpartum(f), f.revision, at),
  ).rejects.toThrow("POSTPARTUM_REFERRAL_CHECK_REQUIRED");
});
it("workflow refuses a readiness negative that predates this editing attempt", async () => {
  const f = await transitionFixture();
  await createPostpartumReferral(f.repo).report(
    { occasion: "running_readiness_check", answers: referralNegative() },
    0,
  );
  await expect(
    f.workflow.saveEngineSettings(
      nextPostpartum(f, 2, true),
      f.revision,
      "2026-10-15T02:00:01Z",
    ),
  ).rejects.toThrow("POSTPARTUM_REFERRAL_CHECK_REQUIRED");
});
it("workflow requires both same-attempt checks when phase and running readiness increase together", async () => {
  const f = await transitionFixture();
  await createPostpartumReferral(f.repo).report(
    {
      occasion: "each_phase_transition",
      phase: 3,
      answers: referralNegative(),
    },
    0,
  );
  await expect(
    f.workflow.saveEngineSettings(nextPostpartum(f, 12, true), f.revision, at),
  ).rejects.toThrow("POSTPARTUM_REFERRAL_CHECK_REQUIRED");
  await createPostpartumReferral(f.repo).report(
    { occasion: "running_readiness_check", answers: referralNegative() },
    f.revision,
  );
  await f.workflow.saveEngineSettings(
    nextPostpartum(f, 12, true),
    f.revision,
    at,
  );
  expect(f.state.coachProfile?.population).toMatchObject({
    weeksSinceBirth: 12,
    readinessChecklistPassed: true,
  });
});
it("a real positive referral invalidates both old proofs and keeps regression and independent locks through workflow save rejection", async () => {
  const f = await transitionFixture();
  await f.repo.db.v8State.put({
    ...f.state,
    postpartumReferralChecks: {
      each_phase_transition: { answeredAt: at, phase: 3 },
      running_readiness_check: { answeredAt: at },
    },
    cardiacPause: { requiredAt: at },
  });
  await createPostpartumReferral(f.repo).report(
    {
      occasion: "weekly_checkin",
      answers: { [postpartumReferralKeys[1]]: true },
    },
    0,
  );
  await expect(
    f.workflow.saveEngineSettings(nextPostpartum(f, 12, true), f.revision, at),
  ).rejects.toThrow("POSTPARTUM_REFERRAL_CHECK_REQUIRED");
  expect(f.state.postpartumSafety?.regression?.phase).toBe(1);
  expect(f.state.cardiacPause?.requiredAt).toBe(at);
  expect(f.state.postpartumReferralChecks).toBeUndefined();
});
it("ordinary settings edits do not demand an unrelated new phase or readiness questionnaire", async () => {
  const f = await transitionFixture();
  await f.workflow.saveEngineSettings(
    { ...f.state.coachProfile!, sessionMinutes: 35 },
    0,
  );
  expect(f.state.coachProfile?.sessionMinutes).toBe(35);
  expect(f.state.postpartumReferralChecks).toBeUndefined();
});
it("withdrawing consent removes negative proofs while retaining every independent minimal safety lock", async () => {
  const f = await transitionFixture();
  await f.repo.db.v8State.put({
    ...f.state,
    postpartumReferralChecks: { weekly_checkin: { answeredAt: at } },
    postpartumSafety: {
      lastSymptomAt: at,
      urgentAt: at,
      regression: {
        requiredAt: at,
        phase: 1,
        symptomFreeDates: ["2026-10-14"],
      },
    },
    cardiacPause: { requiredAt: at },
    olderSafety: { fallAt: at, reviewRequiredAt: at },
    pregnancySafety: { providerPause: { requiredAt: at } },
    trainingPause: { requiredAt: at },
  });
  await f.workflow.saveEngineSettings(
    {
      ...f.state.coachProfile!,
      healthStorageConsent: undefined,
      population: undefined,
      screening: undefined,
    },
    0,
  );
  expect(f.state.postpartumReferralChecks).toBeUndefined();
  expect(f.state.postpartumSafety).toMatchObject({
    urgentAt: at,
    lastSymptomAt: at,
    regression: { phase: 1, symptomFreeDates: [] },
  });
  expect(f.state.cardiacPause?.requiredAt).toBe(at);
  expect(f.state.olderSafety?.reviewRequiredAt).toBe(at);
  expect(f.state.pregnancySafety?.providerPause?.requiredAt).toBe(at);
  expect(f.state.trainingPause?.requiredAt).toBe(at);
});
it("direct pregnant-to-postpartum settings edits cannot bypass the birth event transaction", async () => {
  const f = await pregnantFixture();
  await expect(
    f.workflow.saveEngineSettings(
      {
        ...f.state.coachProfile!,
        population: { kind: "postpartum", weeksSinceBirth: 0, ...birth },
      },
      0,
      at,
    ),
  ).rejects.toThrow("PREGNANCY_BIRTH_REPORT_REQUIRED");
  expect(f.rows[0].status).toBe("in_progress");
  expect(f.state.coachProfile?.population?.kind).toBe("pregnant");
});
it("cannot bypass an actual phase increase by switching health storage consent off for that edit", async () => {
  const f = await transitionFixture();
  await expect(
    f.workflow.saveEngineSettings(
      { ...nextPostpartum(f), healthStorageConsent: undefined },
      0,
      at,
    ),
  ).rejects.toThrow("POSTPARTUM_REFERRAL_CHECK_REQUIRED");
});
it("cannot bypass a pending postpartum transition by removing population and restoring an advanced phase", async () => {
  const f = await transitionFixture(),
    saved = f.state.coachProfile!;
  await f.workflow.saveEngineSettings(
    {
      ...saved,
      healthStorageConsent: undefined,
      population: undefined,
      screening: undefined,
    },
    0,
  );
  await expect(
    f.workflow.saveEngineSettings(
      {
        ...saved,
        population: {
          kind: "postpartum",
          weeksSinceBirth: 12,
          delivery: "vaginal",
          cleared: true,
        },
      },
      f.revision,
      at,
    ),
  ).rejects.toThrow("POSTPARTUM_REFERRAL_CHECK_REQUIRED");
});

it("blocks the pregnancy-to-general first step of a birth-event bypass while consent remains active", async () => {
  const f = await pregnantFixture(),
    before = structuredClone({ state: f.state, rows: f.rows });
  await expect(
    f.workflow.saveEngineSettings(
      { ...f.state.coachProfile!, population: { kind: "general" } },
      0,
      at,
    ),
  ).rejects.toThrow("PREGNANCY_BIRTH_REPORT_REQUIRED");
  expect(f.state).toEqual(before.state);
  expect(f.rows).toEqual(before.rows);
  expect(f.revision).toBe(0);
});

it("does not persist new delivery or injury answers or end training when birth is reported without health-storage consent", async () => {
  const f = await pregnantFixture();
  await f.repo.db.v8State.put({
    ...f.state,
    coachProfile: { ...f.state.coachProfile!, healthStorageConsent: undefined },
  });
  const before = structuredClone({ state: f.state, rows: f.rows });
  await expect(createBirthReport(f.repo).report(birth, 0)).rejects.toThrow(
    "HEALTH_STORAGE_CONSENT_REQUIRED",
  );
  expect(f.state).toEqual(before.state);
  expect(f.rows).toEqual(before.rows);
  expect(f.revision).toBe(0);
});

it("still allows pregnancy identity to be removed on consent withdrawal without clearing minimal independent danger locks", async () => {
  const f = await pregnantFixture();
  await f.workflow.saveEngineSettings(
    {
      ...f.state.coachProfile!,
      healthStorageConsent: undefined,
      population: undefined,
      screening: undefined,
    },
    0,
  );
  expect(f.state.coachProfile?.population).toBeUndefined();
  expect(f.state.coachProfile?.screening).toBeUndefined();
  expect(f.state.coachProfile?.healthStorageConsent).toBeUndefined();
  expect(f.state.pregnancySafety).toEqual({
    providerPause: { requiredAt: at },
    supineAvoidSince: at,
  });
  expect(f.state.cardiacPause?.requiredAt).toBe(at);
  expect(f.state.postpartumSafety?.urgentAt).toBe(at);
});
