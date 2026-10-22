import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import {
  createTrainingCheckin,
  type TrainingCheckinRow,
  type TrainingCheckinInput,
} from '../../src/application/training-checkin';
import { createV8Workflow } from '../../src/application/v8-workflow';
import { createBackupService, validateBackupEnvelope } from '../../src/application/backup';
import { prepareV8Migration } from '../../src/persistence/v8-migration';
import { engineCheckinSchema, type EngineCheckin } from '../../src/engine/contracts';
import { Rules } from '../../src/engine/data';
import { scorePlan } from '../../src/engine/score';
import { generatePlan, nextTargets, validatePlan } from '../../src/engine';
import { baseProfile, equipmentScenarios } from '../../tools/eval/training-engine-profiles';
import { EXERCISE_IDS } from '../../src/catalog/exercises';
import { DATABASE_VERSION } from '../../src/domain/storage-version';
import type { Repository } from '../../src/persistence/repository';
import { toEngineProfile, historyPainState } from '../../src/application/engine-profile';
import { painQuestionKeys } from '../../src/application/training-pain';
import * as flags from '../../src/application/feature-flags';
const rules = new Rules(),
  now = '2026-10-15T03:00:00.000Z',
  root = new URL('../fixtures/legacy-backups/', import.meta.url);
// Transactional in-memory adapter, not a claim about IndexedDB crash recovery.
function fixture() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(now));
  const original = validateBackupEnvelope(JSON.parse(readFileSync(new URL('v807-mainline.json', root), 'utf8'))),
    data = structuredClone(original.data),
    p = baseProfile();
  let rows: Record<string, any[]> = {};
  for (const [name, value] of Object.entries(data)) if (Array.isArray(value)) rows[name] = structuredClone(value);
  rows.metadata = [{ ...data.metadata, schemaVersion: DATABASE_VERSION, restoreGeneration: 0 }];
  rows.trainingMemo = [data.trainingMemo];
  rows.trainingCheckins = [];
  const v8 = data.v8!;
  for (const [key, name] of Object.entries({
    plans: 'v8Plans',
    planVersions: 'v8PlanVersions',
    workouts: 'v8Workouts',
    activities: 'v8Activities',
    planReferences: 'v8PlanReferences',
  }))
    rows[name] = structuredClone((v8 as any)[key] ?? []);
  rows.v8State = [
    {
      ...v8.state,
      currentPlanId: undefined,
      legacyPlanIds: [],
      coachProfile: {
        goalText: '健康',
        weeklyTarget: 3,
        sessionMinutes: 30,
        scheduleOriginalText: '每周三次',
        place: 'home',
        equipment: ['none'],
        adultConfirmed: true,
        cautions: [],
        confirmedAt: now,
        birthYearMonth: p.birthYearMonth,
        population: p.population,
        screening: p.screening,
        healthStorageConsent: { acceptedAt: now },
      },
    },
  ];
  rows.v8Workouts = [];
  let failConsume = false;
  const db: any = { tables: [], transaction: async (_mode: unknown, _tables: unknown, fn: () => unknown) => fn() };
  const names = [
    ...new Set([
      ...Object.keys(rows),
      'assistantConversations',
      'exerciseFavorites',
      'nutritionRecords',
      'activityImportReceipts',
      'aiMemoryNotes',
      'scheduledWorkouts',
      'v8Activities',
      'v8PlanReferences',
      'fitnessTests',
      'journeys',
      'futureLetters',
    ]),
  ];
  for (const name of names) {
    rows[name] ??= [];
    const select = (predicate: (row: any) => boolean) => ({
      toArray: async () => structuredClone(rows[name].filter(predicate)),
      count: async () => rows[name].filter(predicate).length,
      sortBy: async (key: string) =>
        structuredClone(rows[name].filter(predicate).sort((a, b) => String(a[key]).localeCompare(String(b[key])))),
      delete: async () => {
        rows[name] = rows[name].filter(row => !predicate(row));
      },
    });
    db[name] = {
      name,
      toArray: async () => structuredClone(rows[name]),
      get: async (id: unknown) => structuredClone(rows[name].find(row => row.id === id)),
      toCollection: () => ({ first: async () => structuredClone(rows[name][0]) }),
      where: (key: string) => ({
        equals: (value: unknown) => select(row => row[key] === value),
        belowOrEqual: (value: unknown) => select(row => row[key] <= value!),
      }),
      put: async (value: any) => {
        rows[name] = [...rows[name].filter(row => row.id !== value.id), structuredClone(value)];
      },
      add: async (value: any) => {
        rows[name].push(structuredClone(value));
      },
      delete: async (id: string) => {
        if (name === 'trainingCheckins' && id === 'pending' && failConsume)
          throw Error('INJECTED_CONSUME_DELETE_FAILURE');
        rows[name] = rows[name].filter(row => row.id !== id);
      },
      clear: async () => {
        rows[name] = [];
      },
    };
    db.tables.push(db[name]);
  }
  const repo = {
    db,
    readMetadata: async () => structuredClone(rows.metadata[0]),
    write: async <T>(fn: () => Promise<T>, revision?: number) => {
      const before = structuredClone(rows);
      if (revision !== undefined && revision !== rows.metadata[0].dataRevision) throw Error('STALE_REVISION');
      try {
        const result = await fn();
        rows.metadata[0].dataRevision++;
        return result;
      } catch (error) {
        rows = before;
        throw error;
      }
    },
  } as unknown as Repository;
  return {
    repo,
    service: createTrainingCheckin(repo),
    workflow: createV8Workflow(repo),
    rows: () => rows,
    fail: () => {
      failConsume = true;
    },
  };
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
const plainFatigue = (): EngineCheckin => ({
  poorSleepNights: rules.get('deload.trigger.reactive').flags.poor_sleep.nights_sum_gte,
});
const tired = (): EngineCheckin => ({
  poorSleepNights: rules.get('deload.trigger.reactive').flags.poor_sleep.nights_sum_gte,
  newOrWorseJointPain: true,
});

describe('source pain follow-up persistence', () => {
  function followupFixture() {
    const f = fixture(),
      e = rules.byExercise.get(EXERCISE_IDS.bodyweightSquat)!;
    const previous = {
      id: crypto.randomUUID(),
      startedAt: '2026-10-14T03:00:00.000Z',
      endedAt: '2026-10-14T03:10:00.000Z',
      localDate: '2026-10-14',
      timeZone: 'Asia/Shanghai',
      status: 'complete',
      plannedSetCount: 1,
      sets: [{ exerciseId: e.id, itemIndex: 0, setIndex: 0, reps: 8, completedAt: '2026-10-14T03:01:00.000Z' }],
    };
    f.rows().v8Workouts.push(previous);
    return {
      f,
      e,
      answers: {
        jointPain: {
          painArea: 'knee' as const,
          redFlagAnswers: Object.fromEntries(painQuestionKeys(['knee']).map(key => [key, false])),
        },
        painLastedToNextMorning: true,
        painFollowup: { workoutId: previous.id, itemIndex: 0, painArea: 'knee' as const },
      },
    };
  }
  it('persists only applied adjustment, rejects the same pattern with engine off, and does not invent pain scores', async () => {
    const { f, e, answers } = followupFixture(),
      facts = structuredClone(f.rows().v8Workouts);
    await expect(f.service.save({ ...answers, jointPain: undefined })).rejects.toThrow('RED_FLAG_ANSWERS_REQUIRED');
    expect(f.rows().v8State[0].painFollowupRestrictions).toBeUndefined();
    await f.service.save(answers);
    const applied = f.rows().v8State[0].painFollowupRestrictions;
    expect(applied).toEqual([
      {
        pattern: e.primary_pattern,
        sourceWorkoutId: answers.painFollowup.workoutId,
        cautionLevelDelta: 1,
        appliedAt: now,
      },
    ]);
    expect(await f.service.pending()).toEqual(answers);
    vi.spyOn(flags, 'isFeatureEnabled').mockReturnValue(false);
    await expect(f.workflow.start(undefined, e.id)).rejects.toThrow('PAIN_PATTERN_EXCLUDED');
    expect(f.rows().v8Workouts).toEqual(facts);
    expect(JSON.stringify(applied)).not.toContain('painScore');
  });
  it('repeated save is idempotent and expiration removes raw answers, not the applied two-session adjustment', async () => {
    const { f, answers } = followupFixture();
    await f.service.save(answers);
    const applied = structuredClone(f.rows().v8State[0].painFollowupRestrictions);
    vi.setSystemTime(new Date(Date.parse(now) + 1000));
    await f.service.save(answers);
    expect(f.rows().v8State[0].painFollowupRestrictions).toEqual(applied);
    vi.setSystemTime(new Date(Date.parse(now) + 11 * 86400000));
    expect(await f.service.pending()).toBeUndefined();
    expect(f.rows().v8State[0].painFollowupRestrictions).toEqual(applied);
    expect(historyPainState(f.rows().v8Workouts, [], applied)?.[0].remainingSessions).toBe(2);
    for (let n = 0; n < 2; n++) {
      f.rows().v8Workouts.push({
        ...f.rows().v8Workouts[0],
        id: crypto.randomUUID(),
        startedAt: new Date(Date.parse(now) + (n + 1) * 60000).toISOString(),
      });
      expect(historyPainState(f.rows().v8Workouts, [], applied)?.[0].remainingSessions).toBe(1 - n);
    }
  });
  it('rolls back applied restriction if the temporary answer cannot be written', async () => {
    const { f, answers } = followupFixture(),
      before = structuredClone(f.rows());
    vi.spyOn(f.repo.db.trainingCheckins, 'put').mockRejectedValueOnce(Error('ANSWER_WRITE_FAILED'));
    await expect(f.service.save(answers)).rejects.toThrow('ANSWER_WRITE_FAILED');
    expect(f.rows()).toEqual(before);
  });
  it('simultaneous red flag and follow-up retain both independent protections', async () => {
    const { f, answers } = followupFixture(),
      question = painQuestionKeys(['knee'])[0];
    await f.service.save({
      ...answers,
      newOrWorseJointPain: true,
      jointPain: { painArea: 'knee', painScore: 6, redFlagAnswers: { [question]: true } },
    });
    expect(f.rows().v8State[0].painFollowupRestrictions).toHaveLength(1);
    expect(f.rows().v8State[0].trainingPause).toEqual({ requiredAt: now });
  });
});
describe('ephemeral local training check-ins', () => {
  it('requires local consent, rejects malformed answers and never infers skipped answers', async () => {
    const f = fixture();
    delete f.rows().v8State[0].coachProfile.healthStorageConsent;
    await expect(f.service.save({ sorenessResolved: false })).rejects.toThrow('HEALTH_STORAGE_CONSENT_REQUIRED');
    expect(f.rows().trainingCheckins).toEqual([]);
    for (const invalid of [
      { poorSleepNights: -1 },
      { energyMotivation: rules.get('deload.checkin.inputs').fields.energy_motivation.scale[0] - 1 },
      { energyMotivation: rules.get('deload.checkin.inputs').fields.energy_motivation.scale[1] + 1 },
      { sorenessResolved: 'false' },
      { unknown: false },
    ])
      expect(engineCheckinSchema.safeParse(invalid).success).toBe(false);
    await f.service.save({});
    expect(await f.service.pending()).toBeUndefined();
    f.rows().v8State[0].coachProfile.healthStorageConsent = { acceptedAt: now };
    await f.service.save({ sorenessResolved: false });
    expect(await f.service.pending()).toEqual({ sorenessResolved: false });
    await f.service.save({});
    expect(await f.service.pending()).toBeUndefined();
  });
  it('expires exactly at the source TTL and prunes only temporary rows without editing legacy facts', async () => {
    const f = fixture(),
      history = structuredClone(
        validateBackupEnvelope(JSON.parse(readFileSync(new URL('v807-mainline.json', root), 'utf8'))).data.v8!.workouts,
      );
    history[0].checkin = { poorSleepNights: 3 };
    const facts = structuredClone(history);
    await f.service.save(tired());
    const row = f.rows().trainingCheckins[0] as TrainingCheckinRow,
      ttl = rules.get('deload.checkin.inputs').retain_days * 86400000;
    expect(Date.parse(row.expiresAt) - Date.parse(row.recordedAt)).toBe(ttl);
    vi.setSystemTime(new Date(Date.parse(row.expiresAt) - 1));
    expect(await f.service.pending()).toEqual(tired());
    vi.setSystemTime(new Date(row.expiresAt));
    const ctx = await f.service.context(history);
    expect(ctx.checkin).toBeUndefined();
    expect((ctx.history[0] as { checkin?: EngineCheckin }).checkin).toBeUndefined();
    expect(f.rows().trainingCheckins).toEqual([]);
    expect(history).toEqual(facts);
  });
  it('withdrawn consent hides answers without rewriting retained workout facts', async () => {
    const f = fixture();
    await f.service.save(tired());
    const history = structuredClone(
      validateBackupEnvelope(JSON.parse(readFileSync(new URL('v807-mainline.json', root), 'utf8'))).data.v8!.workouts,
    );
    history[0].checkin = { energyMotivation: 1 };
    const before = structuredClone(history);
    delete f.rows().v8State[0].coachProfile.healthStorageConsent;
    const ctx = await f.service.context(history);
    expect(ctx.checkin).toBeUndefined();
    expect((ctx.history[0] as { checkin?: EngineCheckin }).checkin).toBeUndefined();
    expect(history).toEqual(before);
  });
  it('strips legacy health answers even for an old adapter without the temporary table', async () => {
    const f = fixture(),
      history = structuredClone(
        validateBackupEnvelope(JSON.parse(readFileSync(new URL('v807-mainline.json', root), 'utf8'))).data.v8!.workouts,
      );
    history[0].checkin = { energyMotivation: 1 };
    const before = structuredClone(history);
    delete (f.repo.db as unknown as Record<string, unknown>).trainingCheckins;
    delete f.rows().v8State[0].coachProfile.healthStorageConsent;
    const context = await f.service.context(history);
    expect(context.history[0]).not.toHaveProperty('checkin');
    expect(context.checkin).toBeUndefined();
    expect(history).toEqual(before);
  });
  it('clears temporary rows on a consent-withdrawn consume without adding health answers to workout facts', async () => {
    const f = fixture();
    await f.service.save(tired());
    const before = structuredClone(f.rows().v8Workouts);
    delete f.rows().v8State[0].coachProfile.healthStorageConsent;
    await f.service.consume('not-a-new-health-write');
    expect(f.rows().trainingCheckins).toEqual([]);
    expect(f.rows().v8Workouts).toEqual(before);
  });
  it('consumes non-joint fatigue answers atomically with start and does not copy them into backup facts', async () => {
    const f = fixture();
    await f.service.save(plainFatigue());
    const pending = structuredClone(f.rows().trainingCheckins[0]),
      record = await f.workflow.start(undefined, EXERCISE_IDS.bodyweightSquat);
    expect(f.rows().trainingCheckins).toEqual([{ ...pending, id: record.id }]);
    expect(record.checkin).toBeUndefined();
    const ctx = await f.service.context(f.rows().v8Workouts);
    expect((ctx.history[0] as { checkin?: EngineCheckin }).checkin).toEqual(plainFatigue());
    expect(f.rows().v8Workouts[0].checkin).toBeUndefined();
  });
  it('rolls back both created workout and consumed answer if the transaction fails after the consumed row was written', async () => {
    const f = fixture();
    await f.service.save(plainFatigue());
    const before = structuredClone(f.rows());
    f.fail();
    await expect(f.workflow.start(undefined, EXERCISE_IDS.bodyweightSquat)).rejects.toThrow(
      'INJECTED_CONSUME_DELETE_FAILURE',
    );
    expect(f.rows()).toEqual(before);
  });
  it('exports no ephemeral answers while preserving legacy checkin facts', async () => {
    const f = fixture(),
      legacy = structuredClone(
        validateBackupEnvelope(JSON.parse(readFileSync(new URL('v807-mainline.json', root), 'utf8'))).data.v8!
          .workouts[0],
      );
    legacy.checkin = { poorSleepNights: 2, sorenessResolved: false };
    f.rows().v8State[0].currentPlanId = f.rows().v8Plans[0].id;
    f.rows().v8Workouts = [legacy];
    await f.service.save(tired());
    const before = structuredClone(f.rows().trainingCheckins),
      backup = JSON.parse(await (await createBackupService(f.repo).exportBackup()).text());
    expect(JSON.stringify(backup)).not.toContain('trainingCheckins');
    expect(backup.data.v8.workouts[0].checkin).toEqual(legacy.checkin);
    expect(f.rows().trainingCheckins).toEqual(before);
  });
  for (const name of readdirSync(root).filter(name => name.endsWith('.json'))) {
    const raw = JSON.parse(readFileSync(new URL(name, root), 'utf8'));
    if (raw.format !== 'fitness-local') continue;
    it(`retains the legacy restore validation/migration path: ${name}`, async () => {
      const before = structuredClone(raw),
        parsed = validateBackupEnvelope(raw),
        v8 = parsed.data.v8 ?? (await prepareV8Migration(parsed.data, now));
      expect(v8.state).toBeDefined();
      expect(v8.workouts).toBeDefined();
      expect(raw).toEqual(before);
      expect(JSON.stringify(parsed)).not.toContain('trainingCheckins');
    });
  }
  it('uses the current pending checkin consistently in preview and start and leaves it unconsumed when preview blocks', async () => {
    const f = fixture();
    vi.spyOn(flags, 'isFeatureEnabled').mockReturnValue(true);
    const p = toEngineProfile(f.rows().v8State[0].coachProfile, {
      asOfDate: '2026-10-15',
      timeZone: f.rows().profiles[0].timeZone,
      history: [],
    })!;
    expect(p).toBeDefined();
    const enginePlan = generatePlan(p),
      version = f.rows().v8PlanVersions[0],
      plan = f.rows().v8Plans[0];
    version.enginePlan = enginePlan;
    version.templates = enginePlan.templates;
    plan.currentVersionId = version.id;
    f.rows().v8State[0].currentPlanId = plan.id;
    const template = enginePlan.templates[0];
    expect(template).toBeDefined();
    await f.service.save(plainFatigue());
    const direct = nextTargets([], enginePlan, p, { checkin: plainFatigue() }),
      preview = await f.workflow.nextTargetPreview(template.id),
      hard = validatePlan(direct.value, p, {
        progression: { baseline: enginePlan, history: [], checkin: plainFatigue() },
      }).filter(i => i.severity === 'error');
    if (hard.length || direct.gates.some(g => g.status === 'blocked')) {
      expect(preview.blocked).toBe(true);
      await expect(f.workflow.start(template.id)).rejects.toThrow('ENGINE_SCREENING_REQUIRED');
      expect(await f.service.pending()).toEqual(plainFatigue());
      expect(f.rows().v8Workouts).toEqual([]);
    } else {
      expect(preview.template).toEqual(direct.value.templates.find(t => t.id === template.id));
      const record = await f.workflow.start(template.id);
      expect(record.templateSnapshot).toEqual(preview.template);
      expect(await f.service.pending()).toBeUndefined();
    }
  });
  it('treats a skipped current checkin as unknown, rather than manufacturing fatigue', () => {
    const p = baseProfile(),
      plan = generatePlan(p),
      a = nextTargets([], plan, p),
      b = nextTargets([], plan, p, { checkin: {} });
    expect(b.value).toEqual(a.value);
    expect(b.trace.some(t => t.ruleId === 'deload.dose.prescription')).toBe(false);
  });
});

function reducedFixture() {
  const p = baseProfile({ equipment: [...equipmentScenarios[3]] }),
    baseline = generatePlan(p),
    checkin = tired(),
    out = nextTargets([], baseline, p, { checkin });
  return { p, baseline, checkin, out, context: { progression: { baseline, history: [], checkin } } };
}
function weeklyTargets(plan: ReturnType<typeof generatePlan>, p: ReturnType<typeof baseProfile>) {
  const rows = scorePlan(plan, p, rules).perRule.filter(row =>
    ['dose.sets_week.beginner', 'dose.sets_week.goal_matrix', 'progression.new.weekly_sets'].includes(row.id),
  );
  expect(rows.length).toBeGreaterThan(0);
  return rows;
}
it('scores genuine fatigue reductions as weekly target shortfalls without requiring a legacy context exemption', () => {
  const { p, baseline, out, context } = reducedFixture();
  expect(out.diff.length).toBeGreaterThan(0);
  expect(out.suggestions.some(s => s.ruleId === 'deload.dose.prescription' && s.after.sets < s.before.sets)).toBe(true);
  expect(weeklyTargets(out.value, p).some(row => row.satisfaction < 1)).toBe(true);
  expect(validatePlan(out.value, p, context)).toEqual(validatePlan(out.value, p));
  expect(validatePlan(out.value, p).some(i => i.code === 'weekly_volume_floor')).toBe(false);
  expect(
    scorePlan(out.value, p, rules).perRule.find(row => row.id === 'goal.params.health')!.satisfaction,
  ).toBeLessThan(1);
  expect(out.value.meta).not.toHaveProperty('checkin');
  expect(baseline.meta).not.toHaveProperty('checkin');
});
it('does not let deload metadata change factual target scores or bypass a hard dose cap', () => {
  const { p, out, context } = reducedFixture(),
    tampered = structuredClone(out.value),
    item = tampered.templates.flatMap(t => t.items).find(i => i.prescription?.block === 'main')!;
  expect(item).toBeDefined();
  if ('reps' in item.target) item.target.reps++;
  else item.target.durationSeconds++;
  const factual = scorePlan(tampered, p, rules);
  (tampered.meta as unknown as Record<string, unknown>).deload = true;
  expect(scorePlan(tampered, p, rules)).toEqual(factual);
  expect(weeklyTargets(tampered, p).some(row => row.satisfaction < 1)).toBe(true);
  item.sets = rules.get('duration.fit.bounds').sets_per_exercise_max[p.level] + 1;
  expect(validatePlan(tampered, p, context).some(i => i.code === 'exercise_set_cap' && i.severity === 'error')).toBe(
    true,
  );
  expect(validatePlan(tampered, p, context)).toEqual(validatePlan(tampered, p));
});
it('keeps an already under-volume baseline below the weekly target after fatigue projection', () => {
  const { p, baseline, checkin } = reducedFixture();
  for (const template of baseline.templates) for (const item of template.items) item.sets = 1;
  const before = structuredClone(baseline);
  expect(weeklyTargets(baseline, p).some(row => row.satisfaction < 1)).toBe(true);
  const out = nextTargets([], baseline, p, { checkin });
  expect(weeklyTargets(out.value, p).some(row => row.satisfaction < 1)).toBe(true);
  expect(validatePlan(out.value, p, { progression: { baseline, history: [], checkin } })).toEqual(
    validatePlan(out.value, p),
  );
  expect(baseline).toEqual(before);
});
it('does not manufacture fresh fatigue reductions from an expired temporary answer', async () => {
  const f = fixture(),
    { p, baseline, out } = reducedFixture();
  await f.service.save(tired());
  vi.setSystemTime(new Date(f.rows().trainingCheckins[0].expiresAt));
  const ctx = await f.service.context([]);
  expect(ctx.checkin).toBeUndefined();
  expect(ctx.history).toEqual([]);
  const fresh = nextTargets(ctx.history, baseline, p, { checkin: ctx.checkin });
  expect(fresh.noop).toBe(true);
  expect(fresh.trace.some(row => row.ruleId === 'deload.dose.prescription')).toBe(false);
  expect(weeklyTargets(out.value, p).some(row => row.satisfaction < 1)).toBe(true);
  expect(validatePlan(out.value, p, { progression: { baseline, history: ctx.history, checkin: ctx.checkin } })).toEqual(
    validatePlan(out.value, p),
  );
});

function jointInput(positive = false): TrainingCheckinInput {
  const answers = Object.fromEntries(painQuestionKeys(['knee']).map(key => [key, false]));
  if (positive) answers[Object.keys(answers)[0]] = true;
  return {
    ...tired(),
    jointPain: {
      painScore: rules.get('pain.rule').bands[1].when.all[0].gte,
      painArea: 'knee',
      redFlagAnswers: answers,
    },
  };
}
it.each(['absent', 'score', 'area', 'answers'] as const)(
  'does not consume or start an unfinished pre-session joint-pain report: %s',
  async missing => {
    const f = fixture(),
      input = jointInput();
    if (missing === 'absent') delete input.jointPain;
    if (missing === 'score') delete input.jointPain!.painScore;
    if (missing === 'area') delete input.jointPain!.painArea;
    if (missing === 'answers')
      delete input.jointPain!.redFlagAnswers![Object.keys(input.jointPain!.redFlagAnswers!)[0]];
    await f.service.save(input);
    const before = structuredClone(f.rows());
    await expect(f.workflow.start(undefined, EXERCISE_IDS.bodyweightSquat)).rejects.toThrow(
      'RED_FLAG_ANSWERS_REQUIRED',
    );
    expect(f.rows()).toEqual(before);
  },
);
it('permits a confirmed all-negative report only for a real zero-load joint action and never invents a triggering event or pattern', async () => {
  const f = fixture();
  await f.service.save(jointInput());
  const safe = rules.byExercise.get(EXERCISE_IDS.selfResistedRow)!;
  expect(safe.joint_load.knee).toBe(0);
  expect(rules.byExercise.get(EXERCISE_IDS.bodyweightSquat)!.joint_load.knee).toBeGreaterThan(0);
  await expect(f.workflow.start(undefined, EXERCISE_IDS.bodyweightSquat)).rejects.toThrow('PAIN_REVIEW_REQUIRED');
  const workout = await f.workflow.start(undefined, EXERCISE_IDS.selfResistedRow);
  await f.workflow.recordSet(workout.id, 0, 0, { reps: 8 });
  const before = structuredClone(f.rows().v8Workouts[0]);
  expect(before.painActions).toBeUndefined();
  expect(before.setFeedbackEvents).toBeUndefined();
  expect(f.rows().v8State[0].coachProfile.painState).toBeUndefined();
  await f.workflow.substitute(workout.id, 0, EXERCISE_IDS.bodyweightSquat, 'other');
  await expect(f.workflow.recordSet(workout.id, 0, 1, { reps: 8 })).rejects.toThrow('PAIN_REVIEW_REQUIRED');
  expect(f.rows().v8Workouts[0].sets).toEqual(before.sets);
});
it('persists only a minimal positive pause through skipped answers, expiry, consent withdrawal and flag-off operations', async () => {
  const f = fixture();
  vi.spyOn(flags, 'isFeatureEnabled').mockReturnValue(false);
  const active = await f.workflow.start(undefined, EXERCISE_IDS.selfResistedRow);
  await f.workflow.recordSet(active.id, 0, 0, { reps: 8 });
  const facts = structuredClone(f.rows().v8Workouts);
  await f.service.save(jointInput(true));
  expect(f.rows().v8State[0].trainingPause).toEqual({ requiredAt: now });
  const expiry = f.rows().trainingCheckins[0].expiresAt;
  await f.service.save({});
  expect(f.rows().v8State[0].trainingPause).toEqual({ requiredAt: now });
  await expect(f.workflow.recordSet(active.id, 0, 1, { reps: 8 })).rejects.toThrow('PAIN_REVIEW_REQUIRED');
  await f.workflow.finish(active.id, { reasons: [] });
  const ended = structuredClone(f.rows().v8Workouts);
  vi.setSystemTime(new Date(expiry));
  expect(await f.service.pending()).toBeUndefined();
  delete f.rows().v8State[0].coachProfile.healthStorageConsent;
  delete f.rows().v8State[0].coachProfile.screening;
  delete f.rows().v8State[0].coachProfile.population;
  await expect(f.workflow.start(undefined, EXERCISE_IDS.selfResistedRow)).rejects.toThrow('PAIN_REVIEW_REQUIRED');
  await expect(f.workflow.propose(f.rows().v8State[0].coachProfile, 'zh')).rejects.toThrow('PAIN_REVIEW_REQUIRED');
  expect(f.rows().v8Workouts).toEqual(ended);
  expect(ended[0].sets).toEqual(facts[0].sets);
  expect(f.rows().v8State[0].trainingPause).toEqual({ requiredAt: now });
});
it('includes the minimal pause in backup roundtrip but excludes every temporary raw joint answer', async () => {
  const f = fixture();
  f.rows().v8State[0].currentPlanId = f.rows().v8Plans[0].id;
  await f.service.save(jointInput(true));
  const text = await (await createBackupService(f.repo).exportBackup()).text(),
    backup = validateBackupEnvelope(JSON.parse(text));
  expect(backup.data.v8!.state.trainingPause).toEqual({ requiredAt: now });
  expect(text).not.toContain('trainingCheckins');
  expect(text).not.toContain('redFlagAnswers');
  expect(text).not.toContain('painScore');
  expect(Object.keys(backup.data.v8!.state.trainingPause!)).toEqual(['requiredAt']);
  const malformed = JSON.parse(text);
  malformed.data.v8.state.trainingPause.painArea = 'knee';
  expect(() => validateBackupEnvelope(malformed)).toThrow();
  expect(f.rows().v8State[0].coachProfile.screening.redFlagReview).toBeUndefined();
});
it.each(['consent', 'parq', 'rescreen', 'pending_history'] as const)(
  'requires explicit complete safety prerequisites before clearing a minimal pause: %s',
  async missing => {
    const f = fixture();
    await f.service.save(jointInput(true));
    if (missing === 'consent') delete f.rows().v8State[0].coachProfile.healthStorageConsent;
    if (missing === 'parq') f.rows().v8State[0].coachProfile.screening.parqAnswers = [false];
    if (missing === 'rescreen') f.rows().v8State[0].coachProfile.screening.rescreenRequired = true;
    if (missing === 'pending_history') {
      const row = structuredClone(
        validateBackupEnvelope(JSON.parse(readFileSync(new URL('v807-mainline.json', root), 'utf8'))).data.v8!
          .workouts[0],
      );
      row.setFeedbackEvents = [
        {
          id: crypto.randomUUID(),
          exerciseId: row.sets[0].exerciseId,
          itemIndex: row.sets[0].itemIndex,
          setIndex: row.sets[0].setIndex,
          createdAt: now,
          effort: 'discomfort',
          painScore: 6,
          painArea: 'knee',
        },
      ];
      f.rows().v8Workouts = [row];
    }
    const before = structuredClone(f.rows());
    await expect(f.workflow.confirmPainProfessionalSeen()).rejects.toThrow('RED_FLAG_ANSWERS_REQUIRED');
    expect(f.rows()).toEqual(before);
  },
);
it('clears only the new pause and temporary joint fields after explicit medical confirmation, leaving facts and other fatigue answers unchanged', async () => {
  const f = fixture(),
    active = await f.workflow.start(undefined, EXERCISE_IDS.selfResistedRow);
  await f.workflow.recordSet(active.id, 0, 0, { reps: 8 });
  const before = structuredClone(f.rows().v8Workouts);
  await f.service.save(jointInput(true));
  const pending = structuredClone(f.rows().trainingCheckins[0]);
  f.rows().v8State[0].coachProfile.screening = {
    ...f.rows().v8State[0].coachProfile.screening,
    parqAnswers: rules.get('safety.screen.parq').parq_questions.map(() => false),
    completedAt: new Date().toISOString(),
  };
  await f.workflow.confirmPainProfessionalSeen();
  expect(f.rows().v8State[0].trainingPause).toBeUndefined();
  expect(f.rows().trainingCheckins).toEqual(
    [{ ...pending, answers: plainFatigue(), jointPain: undefined }].map(({ jointPain: _removed, ...row }) => row),
  );
  expect(f.rows().v8Workouts).toEqual(before);
  await expect(f.workflow.recordSet(active.id, 0, 1, { reps: 8 })).resolves.toBeDefined();
});

it('expires positive raw answers without clearing the minimum pause, then requires renewed consent and explicit professional confirmation', async () => {
  const f = fixture(),
    active = await f.workflow.start(undefined, EXERCISE_IDS.selfResistedRow);
  await f.workflow.recordSet(active.id, 0, 0, { reps: 8 });
  await f.workflow.finish(active.id, { reasons: [] });
  const facts = structuredClone(f.rows().v8Workouts),
    screening = structuredClone(f.rows().v8State[0].coachProfile.screening);
  await f.service.save(jointInput(true));
  vi.setSystemTime(new Date(f.rows().trainingCheckins[0].expiresAt));
  expect(await f.service.pending()).toBeUndefined();
  expect(f.rows().trainingCheckins).toEqual([]);
  expect(f.rows().v8State[0].trainingPause).toEqual({ requiredAt: now });
  delete f.rows().v8State[0].coachProfile.healthStorageConsent;
  delete f.rows().v8State[0].coachProfile.screening;
  delete f.rows().v8State[0].coachProfile.population;
  await expect(f.workflow.confirmPainProfessionalSeen()).rejects.toThrow('RED_FLAG_ANSWERS_REQUIRED');
  f.rows().v8State[0].coachProfile.healthStorageConsent = { acceptedAt: new Date().toISOString() };
  f.rows().v8State[0].coachProfile.screening = {
    ...screening,
    parqAnswers: rules.get('safety.screen.parq').parq_questions.map(() => false),
    completedAt: new Date().toISOString(),
  };
  await f.workflow.confirmPainProfessionalSeen();
  expect(f.rows().v8State[0].trainingPause).toBeUndefined();
  expect(f.rows().v8State[0].coachProfile.population).toBeUndefined();
  expect(f.rows().v8Workouts).toEqual(facts);
  await expect(f.workflow.start(undefined, EXERCISE_IDS.selfResistedRow)).resolves.toBeDefined();
});

it('refuses old seven-answer screening even when medical confirmation is explicit and local consent remains', async () => {
  const f = fixture();
  await f.service.save(jointInput(true));
  expect(Date.parse(f.rows().v8State[0].coachProfile.screening.completedAt)).toBeLessThan(
    Date.parse(f.rows().v8State[0].trainingPause.requiredAt),
  );
  const before = structuredClone(f.rows());
  await expect(f.workflow.confirmPainProfessionalSeen()).rejects.toThrow('RED_FLAG_ANSWERS_REQUIRED');
  expect(f.rows()).toEqual(before);
});
