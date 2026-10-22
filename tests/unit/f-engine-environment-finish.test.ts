import { Rules } from '../../src/engine/data';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createV8Workflow } from '../../src/application/v8-workflow';
import { enginePlanProposal } from '../../src/application/engine-plan';
import { toEngineProfile, type EngineCoachProfile } from '../../src/application/engine-profile';
import { EnginePlanNotices } from '../../src/ui/components/EnginePlanNotices';
import { PlanDraftPage } from '../../src/ui/pages/onboarding/PlanDraftPage';
import { EngineEnvironmentEditor } from '../../src/ui/pages/settings/EngineEnvironmentEditor';
import { engineCopy } from '../../src/coach/engine-copy';
import * as flags from '../../src/application/feature-flags';
import type { Repository } from '../../src/persistence/repository';
import type { PlanVersion, WorkoutRecord } from '../../src/domain/v8/contracts';
const at = '2026-10-16T00:00:00.000Z';
const profile: EngineCoachProfile = {
  goalText: '保持活动',
  weeklyTarget: 3,
  sessionMinutes: 30,
  scheduleOriginalText: '每周三天',
  place: 'outdoor',
  equipment: ['none'],
  householdSupport: false,
  adultConfirmed: true,
  cautions: [],
  confirmedAt: at,
  healthStorageConsent: { acceptedAt: at },
  population: {
    kind: 'older_adult',
    fallsAnswers: [false, true, false, false],
    walkingAid: false,
    balanceCautious: true,
  },
  screening: {
    cmrSymptoms: Object.fromEntries(
      new Rules().get('safety.screen.cmr_symptoms').symptoms.map((key: string) => [key, false]),
    ),
    completedAt: at,
    parqAllNo: true,
    parqAnswers: Array(7).fill(false),
    knownCondition: false,
    symptoms: false,
    restingBp: 'known_below_threshold',
  },
  birthYearMonth: '1956-01',
  constraints: { noJump: true, quiet: true, space: 'small' },
};
function setup() {
  let state = {
    id: 'v8',
    migratedAt: at,
    notice: { planCount: 0, acknowledged: true },
    legacyPlanIds: [] as string[],
    coachProfile: structuredClone(profile),
    currentPlanId: undefined as string | undefined,
  };
  const plans: { id: string; currentVersionId: string; readOnly: boolean; name: string }[] = [],
    versions: PlanVersion[] = [],
    workouts: WorkoutRecord[] = [];
  const empty = { toArray: async () => [] },
    db = {
      tables: [],
      transaction: async (_mode: unknown, _tables: unknown, fn: () => unknown) => fn(),
      v8State: {
        get: async () => state,
        put: async (value: typeof state) => {
          state = value;
        },
      },
      v8Plans: {
        get: async (id: string) => plans.find(p => p.id === id),
        toArray: async () => plans,
        toCollection: () => ({ modify: async () => {} }),
        add: async (value: (typeof plans)[number]) => plans.push(value),
        put: async (value: (typeof plans)[number]) => {
          plans.splice(
            plans.findIndex(p => p.id === value.id),
            1,
            value,
          );
        },
      },
      v8PlanVersions: {
        get: async (id: string) => versions.find(v => v.id === id),
        toArray: async () => versions,
        add: async (value: PlanVersion) => versions.push(value),
      },
      v8Workouts: {
        toArray: async () => workouts,
        where: () => ({
          equals: () => ({ count: async () => workouts.filter(w => w.status === 'in_progress').length }),
        }),
        add: async (value: WorkoutRecord) => workouts.push(value),
      },
      sessions: { where: () => ({ equals: () => ({ count: async () => 0 }) }) },
      profiles: { toCollection: () => ({ first: async () => ({ timeZone: 'Asia/Shanghai', locale: 'zh' }) }) },
      aiMemoryNotes: empty,
      v8PlanReferences: empty,
      v8Activities: empty,
    };
  const workflow = createV8Workflow({
    db,
    readMetadata: async () => ({ dataRevision: 1, restoreGeneration: 0 }),
    write: async (fn: () => unknown) => fn(),
  } as unknown as Repository);
  return {
    workflow,
    versions,
    plans,
    workouts,
    get state() {
      return state;
    },
  };
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
describe('F finish environment application and recovery', () => {
  it('applies and starts a proven outdoor environment plan, then restores balance in a new version without rewriting history', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-16T10:00:00Z'));
    vi.spyOn(flags, 'isFeatureEnabled').mockReturnValue(true);
    const db = setup(),
      candidate = await db.workflow.propose(profile, 'zh', { trainingEngine: true });
    expect(candidate.enginePlan?.quality?.status).toBe('environmentLimited');
    expect(candidate.proposal.templates.length).toBeGreaterThan(0);
    const version = await db.workflow.adopt(candidate),
      before = JSON.stringify(version);
    expect(await db.workflow.nextTargetPreview(version.templates[0].id)).toMatchObject({ blocked: false });
    const workout = await db.workflow.start(version.templates[0].id),
      workoutBefore = JSON.stringify(workout);
    expect(workout.planVersionId).toBe(version.id);
    const restored = await db.workflow.saveEngineSettings({ ...profile, householdSupport: true }, 1);
    expect(restored?.basedOnVersionId).toBe(version.id);
    expect(restored?.versionNumber).toBe(2);
    expect(restored?.enginePlan?.quality?.status).not.toBe('environmentLimited');
    expect(restored?.templates.every(t => t.items.some(i => i.prescription?.pattern === 'balance'))).toBe(true);
    expect(db.versions).toHaveLength(2);
    expect(JSON.stringify(db.versions[0])).toBe(before);
    expect(JSON.stringify(db.workouts[0])).toBe(workoutBefore);
    expect(db.plans[0].currentVersionId).toBe(restored?.id);
  });
  it('keeps environment disclosure and an enabled draft acceptance control', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-16T10:00:00Z'));
    const mapped = toEngineProfile(profile, { asOfDate: '2026-10-16', timeZone: 'Asia/Shanghai' })!,
      result = enginePlanProposal(profile, mapped);
    expect(result.proposal).toBeDefined();
    const notices = renderToStaticMarkup(
      createElement(EnginePlanNotices, { plan: result.plan, locale: 'zh', onEditEnvironment: () => {} }),
    );
    expect(notices).toContain(engineCopy('engine.copy.environment_balance', 'zh'));
    expect(notices).toContain('<button');
    expect(notices.match(/<p /g)!.length).toBeLessThanOrEqual(3);
    const html = renderToStaticMarkup(
      createElement(PlanDraftPage, {
        locale: 'zh',
        candidate: {
          type: 'plan_proposal',
          requestId: crypto.randomUUID(),
          restoreGeneration: 0,
          mutationAllowed: false,
          proposal: result.proposal!,
          enginePlan: result.plan,
        },
        slots: { BrandMark: () => null, AiLine: ({ children }) => createElement('div', null, children) },
        exerciseText: () => ({ name: '动作', instructions: '' }),
        onConfirm: () => {},
        onDiscuss: () => {},
      }),
    );
    expect(html).toContain('就用这份计划');
    expect(html).not.toContain('disabled=""');
  });
  it('keeps household support independent from mat space and defaults only by place', () => {
    const render = (p: EngineCoachProfile) =>
      renderToStaticMarkup(createElement(EngineEnvironmentEditor, { value: p, locale: 'zh', onChange: () => {} }));
    expect(
      render({
        ...profile,
        householdSupport: undefined,
        place: 'home',
        constraints: { noJump: false, quiet: false, space: 'mat' },
      }),
    ).toContain('checked=""');
    expect(
      render({ ...profile, householdSupport: false, place: 'home' }).split('家里有可扶的墙或椅子')[0],
    ).not.toContain('checked=""');
  });
});

it('regenerates a new version after confirmed pregnancy settings without rewriting the old plan', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-16T10:00:00Z'));
  vi.spyOn(flags, 'isFeatureEnabled').mockReturnValue(true);
  const db = setup();
  db.state.coachProfile = {
    ...db.state.coachProfile,
    birthYearMonth: '1996-01',
    population: { kind: 'general' },
    place: 'home',
    householdSupport: true,
  };
  const candidate = await db.workflow.propose(db.state.coachProfile, 'zh', { trainingEngine: true });
  const version = await db.workflow.adopt(candidate),
    before = JSON.stringify(version);
  const pregnant = {
    ...db.state.coachProfile,
    population: {
      kind: 'pregnant' as const,
      week: 20,
      prenatalCareConfirmed: true,
      providerCleared: true,
      contraindicationsConfirmedNone: true,
      lastScreenedWeek: 20,
    },
  };
  await db.workflow.saveEngineSettings(pregnant, 1);
  expect(db.versions).toHaveLength(2);
  expect(db.versions[1].basedOnVersionId).toBe(version.id);
  expect(JSON.stringify(db.versions[0])).toBe(before);
  expect(db.state.coachProfile.population?.kind).toBe('pregnant');
});

it('regenerates postpartum only after the actual birth event and completed rescreen', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-16T10:00:00Z'));
  vi.spyOn(flags, 'isFeatureEnabled').mockReturnValue(true);
  const db = setup();
  db.state.coachProfile = {
    ...db.state.coachProfile,
    birthYearMonth: '1996-01',
    population: {
      kind: 'pregnant',
      week: 20,
      prenatalCareConfirmed: true,
      providerCleared: true,
      contraindicationsConfirmedNone: true,
      lastScreenedWeek: 20,
    },
    place: 'home',
    householdSupport: true,
  };
  const candidate = await db.workflow.propose(db.state.coachProfile, 'zh', { trainingEngine: true });
  const original = await db.workflow.adopt(candidate),
    before = JSON.stringify(original);
  await db.workflow.reportBirth(
    { delivery: 'vaginal', perinealTrauma: false, postnatalCheckDone: false, cleared: false },
    1,
  );
  expect(db.state.coachProfile.population).toMatchObject({ kind: 'postpartum', weeksSinceBirth: 0 });
  expect(db.versions).toHaveLength(1);
  const completed = {
    ...db.state.coachProfile,
    screening: { ...db.state.coachProfile.screening!, rescreenRequired: false, completedAt: new Date().toISOString() },
  };
  await db.workflow.saveEngineSettings(completed, 1);
  expect(db.versions).toHaveLength(2);
  expect(db.versions[1].basedOnVersionId).toBe(original.id);
  expect(JSON.stringify(db.versions[0])).toBe(before);
});

it('restores pregnancy balance through the real workflow after enabling household support, retaining the old version', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-16T10:00:00Z'));
  vi.spyOn(flags, 'isFeatureEnabled').mockReturnValue(true);
  const db = setup(),
    pregnant: EngineCoachProfile = {
      ...profile,
      birthYearMonth: '1996-01',
      population: {
        kind: 'pregnant',
        week: 20,
        prenatalCareConfirmed: true,
        providerCleared: true,
        contraindicationsConfirmedNone: true,
        lastScreenedWeek: 20,
      },
      place: 'home',
      householdSupport: false,
      screening: { ...profile.screening!, activityStatus: 'active' },
    };
  db.state.coachProfile = pregnant;
  const candidate = await db.workflow.propose(pregnant, 'zh', { trainingEngine: true });
  expect(candidate.enginePlan?.quality?.status).toBe('environmentLimited');
  const before = await db.workflow.adopt(candidate),
    original = JSON.stringify(before);
  const notices = renderToStaticMarkup(createElement(EnginePlanNotices, { plan: before.enginePlan!, locale: 'zh' }));
  expect(notices).toContain('平衡练习需要');
  expect(notices).toContain('<button');
  const restored = await db.workflow.saveEngineSettings({ ...pregnant, householdSupport: true }, 1);
  expect(restored?.basedOnVersionId).toBe(before.id);
  expect(restored?.enginePlan?.quality?.status).not.toBe('environmentLimited');
  const balance = restored!.templates.flatMap(t => t.items).filter(i => i.prescription?.pattern === 'balance');
  expect(balance.length).toBeGreaterThan(0);
  expect(balance.every(i => i.prescription?.safetyCue?.zh === '扶墙或扶椅')).toBe(true);
  expect(JSON.stringify(db.versions[0])).toBe(original);
});
