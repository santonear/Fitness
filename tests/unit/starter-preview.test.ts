import { Rules } from '../../src/engine/data';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createV8Workflow } from '../../src/application/v8-workflow';
import type { Repository } from '../../src/persistence/repository';
import * as flags from '../../src/application/feature-flags';
import { generatePlan, validatePlan } from '../../src/engine';
import { engineProfileSchema } from '../../src/engine/contracts';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// 新手 4 周 runs on the engine's own session and its safety checks; it never stores a weekly version.
async function preview(
  starterProgram: { id: 'starter-4w'; startDate: string } | undefined,
  engine: boolean,
  workouts: unknown[] = [],
) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-15T10:00:00Z'));
  vi.spyOn(flags, 'isFeatureEnabled').mockReturnValue(engine);
  const date = '2026-10-15T00:00:00Z',
    screening = {
      cmrSymptoms: Object.fromEntries(
        new Rules().get('safety.screen.cmr_symptoms').symptoms.map((key: string) => [key, false]),
      ),
      completedAt: date,
      parqAnswers: Array(7).fill(false),
      parqAllNo: true,
      knownCondition: false,
      symptoms: false,
      restingBp: 'known_below_threshold' as const,
    };
  const profile = engineProfileSchema.parse({
    goal: 'health',
    level: 'beginner',
    trainingAgeWeeks: 0,
    daysPerWeek: 2,
    sessionMinutes: 30,
    equipment: ['none'],
    place: 'home',
    constraints: { noJump: true, quiet: true, space: 'small' },
    cautions: [],
    population: { kind: 'general' },
    screening,
    preferences: { excludedExerciseIds: [], cannotDo: [] },
    birthYearMonth: '1990-01',
    asOfDate: '2026-10-15',
    timeZone: 'Asia/Shanghai',
  });
  const enginePlan = generatePlan(profile),
    template = enginePlan.templates[0]!;
  const version = {
      id: 'version',
      planId: 'plan',
      enginePlan,
      templates: enginePlan.templates,
      ...(starterProgram ? { starterProgram } : {}),
    },
    plan = { id: 'plan', currentVersionId: 'version', readOnly: false };
  const coachProfile = {
    goalText: '活动',
    weeklyTarget: 2,
    sessionMinutes: 30,
    scheduleOriginalText: '每周两次',
    place: 'home',
    equipment: ['none'],
    adultConfirmed: true,
    cautions: [],
    confirmedAt: date,
    healthStorageConsent: { acceptedAt: date },
    population: { kind: 'general' },
    screening,
    birthYearMonth: '1990-01',
  };
  const state = { id: 'v8', currentPlanId: 'plan', legacyPlanIds: [], coachProfile };
  const empty = { toArray: async () => [] },
    db = {
      tables: [],
      transaction: async (_mode: unknown, _tables: unknown, fn: () => unknown) => fn(),
      v8State: { get: async () => state },
      v8Plans: { get: async () => plan, toArray: async () => [plan] },
      v8PlanVersions: { get: async () => version, toArray: async () => [version] },
      v8Workouts: { toArray: async () => workouts, where: () => ({ equals: () => ({ count: async () => 0 }) }) },
      sessions: { where: () => ({ equals: () => ({ count: async () => 0 }) }) },
      profiles: { toCollection: () => ({ first: async () => ({ timeZone: 'Asia/Shanghai', locale: 'zh' }) }) },
      scheduledWorkouts: empty,
      aiMemoryNotes: empty,
      v8PlanReferences: empty,
      v8Activities: empty,
    };
  const workflow = createV8Workflow({
    db,
    readMetadata: async () => ({ dataRevision: 1, restoreGeneration: 0 }),
    write: async (fn: () => unknown) => fn(),
  } as unknown as Repository);
  return { result: await workflow.nextTargetPreview(template.id), template, enginePlan, profile };
}

const done = (day: string) => ({
  id: crypto.randomUUID(),
  planVersionId: 'version',
  localDate: day,
  timeZone: 'Asia/Shanghai',
  startedAt: `${day}T01:00:00.000Z`,
  endedAt: `${day}T01:30:00.000Z`,
  status: 'complete',
  sets: [],
});
const strength = (block?: string) => block === 'main' || block === 'accessory';

describe('新手 4 周 preview', () => {
  it('week 3 adds one set to strength moves only while the engine checks still pass', async () => {
    const history = [done('2026-09-30'), done('2026-10-07')];
    const base = (await preview(undefined, true, history)).result.template!;
    const third = await preview({ id: 'starter-4w', startDate: '2026-09-29' }, true, history);
    expect(third.result.blocked).toBe(false);
    const shown = third.result.template!;
    let added = 0;
    shown.items.forEach((item, index) => {
      const before = base.items[index]!;
      expect(item.exerciseId).toBe(before.exerciseId);
      if (!strength(before.prescription?.block)) expect(item.sets).toBe(before.sets);
      else {
        expect([before.sets, before.sets + 1]).toContain(item.sets);
        expect(item.sets).toBeLessThanOrEqual(3);
        if (item.sets > before.sets) added++;
      }
    });
    expect(added).toBeGreaterThan(0);
  });

  it('a week without workouts keeps the same week, so week 1 shows the plan session as it is', async () => {
    const base = await preview(undefined, true);
    const repeat = await preview({ id: 'starter-4w', startDate: '2026-09-01' }, true);
    expect(repeat.result.template?.items.map(item => item.sets)).toEqual(base.result.template?.items.map(i => i.sets));
    const shown = repeat.result.template!;
    const issues = validatePlan(
      { ...repeat.enginePlan, templates: repeat.enginePlan.templates.map(t => (t.id === shown.id ? shown : t)) },
      repeat.profile,
    );
    expect(issues.filter(issue => issue.severity === 'error')).toEqual([]);
  });

  it('applies the week table to basic plans too, never above three sets', async () => {
    const plain = await preview({ id: 'starter-4w', startDate: '2026-10-15' }, false);
    for (const item of plain.result.template!.items) expect(item.sets).toBeLessThanOrEqual(3);
  });
});
