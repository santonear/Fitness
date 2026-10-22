import { computeExerciseEvidence } from '../../src/application/review/evidence';
import { readFileSync } from 'node:fs';
import type { Transaction } from 'dexie';
import { validateBackupEnvelope } from '../../src/application/backup';
import { prepareV8Migration, writeV8Library } from '../../src/persistence/v8-migration';
import { projectLegacyWorkouts } from '../../src/domain/v8/legacy-workouts';
import { computeWeekFacts } from '../../src/application/review/compute';
import { localProfile } from '../../src/application/rules/local-profile';
import { basicProposal } from '../../src/application/v8-workflow';
import { adaptCoachResponse, coachV8Exercises } from '../../src/coach/response-adapter';
import type { CoachRequest } from '../../src/coach/contracts';
import { describe, expect, it } from 'vitest';
import {
  coachRequestSchema,
  coachResponseSchema,
  planProposalSchema,
  reviewFactsSchema,
} from '../../src/coach/contracts';
import { v8Routes } from '../../src/ui/routes.contract';
import { v8Namespaces } from '../../src/i18n/namespaces.contract';
import type { WorkoutRecord, MapSchedule } from '../../src/domain/v8/contracts';
import type { ThemeSlots } from '../../src/themes/contract';
import type { PlanProposal, ReviewFacts } from '../../src/application/review/contracts';
import type { z } from 'zod';

// Compile-time checks: C's proposal can cross D's wire boundary without a second model.
type WireProposal = z.infer<typeof planProposalSchema>;
const toWire: (value: PlanProposal) => WireProposal = value => value;
const toApplication: (value: WireProposal) => PlanProposal = value => value;
const reviewToWire: (value: ReviewFacts) => z.infer<typeof reviewFactsSchema> = value => ({
  ...value,
  improvements: [...value.improvements],
});

const identity = { requestId: '11111111-1111-4111-8111-111111111111', restoreGeneration: 0, mutationAllowed: false };
describe('V8 wave 0 contracts', () => {
  it('accepts empty or multiple boundary statements, never a legacy scalar', () => {
    const response = {
      ...identity,
      type: 'review_summary',
      target: { planId: identity.requestId, versionId: identity.requestId, revision: 0 },
      opening: 'a',
      encouragement: 'b',
      gap: 'c',
    };
    for (const dataBoundary of [[], ['饮食信息未知'], ['饮食信息未知', '体重未记录']]) {
      expect(coachResponseSchema.safeParse({ ...response, dataBoundary }).success).toBe(true);
    }
    for (const dataBoundary of ['旧字符串', [null], ['']]) {
      expect(coachResponseSchema.safeParse({ ...response, dataBoundary }).success).toBe(false);
    }
  });
  it('requires all six incomplete timing cells with separate nonnegative counts', () => {
    const bands = {
      morning: { partial: 1, notStarted: 0 },
      daytime: { partial: 0, notStarted: 2 },
      evening: { partial: 0, notStarted: 0 },
    };
    const schema = reviewFactsSchema.shape.incompleteTiming;
    expect(schema.safeParse({ weekday: bands, weekend: bands }).success).toBe(true);
    expect(schema.safeParse({ weekday: bands }).success).toBe(false);
    expect(
      schema.safeParse({ weekday: { ...bands, morning: { partial: -1, notStarted: 0 } }, weekend: bands }).success,
    ).toBe(false);
    expect(typeof reviewToWire).toBe('function');
  });
  it('never accepts write authority or legacy date payloads', () => {
    expect(coachResponseSchema.safeParse({ ...identity, type: 'refused', reason: 'unavailable' }).success).toBe(true);
    expect(
      coachResponseSchema.safeParse({ ...identity, type: 'refused', reason: 'unavailable', mutationAllowed: true })
        .success,
    ).toBe(false);
    expect(coachResponseSchema.safeParse({ ...identity, type: 'date_plan_candidate' }).success).toBe(false);
  });
  it('requires adult confirmation and bounded dialogue', () => {
    const request = {
      version: 'fitness-coach-v8',
      requestId: identity.requestId,
      conversationId: identity.requestId,
      restoreGeneration: 0,
      inputSnapshot: 'scope',
      sendConfirmation: 'confirmation',
      locale: 'zh',
      timeZone: 'Asia/Shanghai',
      adultConfirmed: true,
      messages: [],
      task: 'ONBOARD_PLAN',
      profile: {
        goalText: 'habit',
        weeklyTarget: 2,
        sessionMinutes: 20,
        scheduleOriginalText: '20分钟',
        place: 'home',
        equipment: [],
        adultConfirmed: true,
        cautions: [],
      },
    };
    expect(coachRequestSchema.safeParse(request).success).toBe(true);
    expect(coachRequestSchema.safeParse({ ...request, adultConfirmed: false }).success).toBe(false);
    expect(
      coachRequestSchema.safeParse({ ...request, messages: Array(9).fill({ role: 'user', content: 'x' }) }).success,
    ).toBe(false);
    expect(
      coachRequestSchema.safeParse({ ...request, messages: [{ role: 'user', content: 'x'.repeat(1601) }] }).success,
    ).toBe(false);
    expect(coachRequestSchema.parse(request)).not.toHaveProperty('history');
    expect(coachRequestSchema.parse(request)).not.toHaveProperty('body');
  });
  it('keeps 15/20-minute plans distinct from onboarding allowed values', () => {
    expect(planProposalSchema.shape.sessionMinutes.safeParse(15).success).toBe(true);
    expect(planProposalSchema.shape.sessionMinutes.safeParse(20).success).toBe(true);
    expect(planProposalSchema.shape.sessionMinutes.safeParse(121).success).toBe(false);
    const status: WorkoutRecord['status'] = 'not_started';
    expect(status).toBe('not_started');
    const stub: MapSchedule = originalText => ({
      originalText,
      minutes: { status: 'skipped' },
      startTime: { status: 'skipped' },
    });
    expect(stub('20分钟').startTime.status).toBe('skipped');
  });
  it('defines nine slots and unique routes with owned namespaces', () => {
    expect(typeof toWire).toBe('function');
    expect(typeof toApplication).toBe('function');
    const slots: (keyof ThemeSlots)[] = [
      'BrandMark',
      'WeekProgress',
      'StartHero',
      'Suggestions',
      'AiLine',
      'SetValue',
      'RestClock',
      'FeatureCard',
      'NavIcon',
    ];
    expect(slots).toHaveLength(9);
    expect(new Set(v8Routes.map(r => r.path)).size).toBe(v8Routes.length);
    for (const route of v8Routes) expect(v8Namespaces).toContain(route.namespace);
  });
  it('B: migration preserves old facts, rolls back failures, and is idempotent', async () => {
    const source = validateBackupEnvelope(
        JSON.parse(readFileSync(new URL('../fixtures/legacy-backups/v71-coach-plan.json', import.meta.url), 'utf8')),
      ).data,
      before = structuredClone(source),
      at = '2026-10-10T00:00:00.000Z';
    const migrated = await prepareV8Migration(source, at);
    expect(await prepareV8Migration(source, at)).toEqual(migrated);
    expect(source).toEqual(before);
    expect(migrated.plans.length).toBeGreaterThan(0);
    expect(
      migrated.planVersions.every(
        row => row.origin === 'migrated' && source.planVersions.some(original => original.id === row.basedOnVersionId),
      ),
    ).toBe(true);
    const projected = projectLegacyWorkouts(source.sessions, source.sets);
    expect(projected.map(row => row.id)).toEqual(source.sessions.map(row => row.id));
    expect(source.sessions).toEqual(before.sessions);
    expect(source.sets).toEqual(before.sets);
    // Transaction adapter fault injection only: real IndexedDB rollback is separately covered by the existing migration browser suite.
    const committed: Record<string, unknown[]> = { legacyFacts: structuredClone(source.sessions) },
      original = structuredClone(committed),
      attempted: string[] = [];
    async function atomicWrite(fail: boolean) {
      const draft = structuredClone(committed),
        tx = {
          table: (name: string) => ({
            bulkAdd: async (rows: unknown[]) => {
              attempted.push(name);
              if (fail && name === 'v8PlanVersions') throw Error('injected migration write failure');
              draft[name] = structuredClone(rows);
            },
            add: async (row: unknown) => {
              attempted.push(name);
              draft[name] = [structuredClone(row)];
            },
          }),
        } as unknown as Transaction;
      await writeV8Library(tx, migrated);
      Object.assign(committed, draft);
    }
    await expect(atomicWrite(true)).rejects.toThrow('injected migration write failure');
    expect(attempted).toEqual(['v8Plans', 'v8PlanVersions']);
    expect(committed).toEqual(original);
    await atomicWrite(false);
    expect(committed.v8Plans).toEqual(migrated.plans);
    expect(committed.v8State).toEqual([migrated.state]);
    expect(committed.legacyFacts).toEqual(before.sessions);
  });
  it('C: not_started is excluded from training counts and progression', () => {
    const record = (id: string, status: WorkoutRecord['status'], date: string, reps: number): WorkoutRecord => ({
      id,
      status,
      planVersionId: 'plan',
      startedAt: date + 'T06:00:00Z',
      endedAt: date + 'T06:30:00Z',
      localDate: date,
      timeZone: 'Asia/Shanghai',
      plannedSetCount: 1,
      sets: [{ exerciseId: 'squat', itemIndex: 0, setIndex: 0, reps, completedAt: date + 'T06:01:00Z' }],
    });
    const result = computeWeekFacts({
      from: '2026-10-05',
      to: '2026-10-11',
      timeZone: 'Asia/Shanghai',
      weeklyTarget: 3,
      workouts: [
        record('previous', 'complete', '2026-10-01', 8),
        record('actual', 'partial', '2026-10-06', 10),
        record('not-started', 'not_started', '2026-10-07', 100),
      ],
      activities: [],
      bodyWeights: [],
    });
    expect(result).toMatchObject({ complete: 0, partial: 1, notStarted: 1, movementCount: 1, trainingSeconds: 1800 });
    expect(result.improvements).toEqual([{ exerciseId: 'squat', metric: 'reps', previous: 8, current: 10 }]);
    const easy: WorkoutRecord = {
      ...record('easy-zero', 'not_started', '2026-10-07', 100),
      feedback: { feel: 'easy', reasons: [] },
      plannedExercises: [{ exerciseId: 'squat', itemIndex: 0, plannedSetCount: 1 }],
    };
    expect(computeExerciseEvidence(easy).easyCompletedExerciseIds).toEqual([]);
    expect(computeExerciseEvidence({ ...easy, status: 'partial' }).easyCompletedExerciseIds).toEqual(['squat']);
  });
  it('C: base plan uses 15/20-minute original request without coercing to 30', () => {
    for (const minutes of [15, 20]) {
      const originalText = `每周2次，每次${minutes}分钟`,
        profile = localProfile({
          goalText: '活动',
          scheduleOriginalText: originalText,
          placeEquipmentText: '在家，无器械',
          adultConfirmed: true,
          cautions: [],
        }),
        proposal = basicProposal(profile)!;
      expect(profile.sessionMinutes).toBe(minutes);
      expect(proposal.sessionMinutes).toBe(minutes);
      expect(proposal.scheduleOriginalText).toBe(originalText);
      expect(proposal.templates).toHaveLength(2);
      for (const template of proposal.templates) {
        expect(template.items.length).toBeGreaterThanOrEqual(4);
        expect(template.estimatedMinutes).toBeLessThanOrEqual(minutes);
      }
      expect(planProposalSchema.safeParse(proposal).success).toBe(true);
    }
  });
  it('D: reject stale restore generation, mismatched identity and task', () => {
    const profile = {
        goalText: '活动',
        weeklyTarget: 2,
        sessionMinutes: 20,
        scheduleOriginalText: '20分钟',
        place: 'home' as const,
        equipment: [],
        adultConfirmed: true as const,
        cautions: [],
      },
      request: CoachRequest = {
        version: 'fitness-coach-v8',
        requestId: identity.requestId,
        conversationId: identity.requestId,
        restoreGeneration: 2,
        inputSnapshot: 'revision:4',
        sendConfirmation: 'confirmed',
        locale: 'zh',
        timeZone: 'Asia/Shanghai',
        adultConfirmed: true,
        messages: [],
        task: 'ONBOARD_PLAN',
        profile,
      },
      response = {
        ...identity,
        restoreGeneration: 2,
        type: 'plan_proposal',
        proposal: {
          goalText: profile.goalText,
          weeklyTarget: profile.weeklyTarget,
          sessionMinutes: profile.sessionMinutes,
          scheduleOriginalText: profile.scheduleOriginalText,
          templates: [
            {
              id: 'A',
              name: 'A',
              estimatedMinutes: 20,
              items: [
                {
                  exerciseId: coachV8Exercises(request).find(exercise => exercise.metricType === 'reps')!.id,
                  equipment: 'none',
                  sets: 2,
                  target: { metricType: 'reps' as const, reps: 8 },
                },
              ],
            },
          ],
          reasons: ['a', 'b', 'c'],
        },
      };
    expect(adaptCoachResponse(request, response)).toEqual(response);
    for (const patch of [{ restoreGeneration: 1 }, { requestId: '22222222-2222-4222-8222-222222222222' }])
      expect(() => adaptCoachResponse(request, { ...response, ...patch })).toThrow();
    const wrongTask = {
      ...identity,
      restoreGeneration: 2,
      type: 'today_adjustment',
      target: { planId: identity.requestId, versionId: identity.requestId, revision: 4 },
      template: response.proposal.templates[0],
      summary: '调整',
    };
    expect(coachResponseSchema.safeParse(wrongTask).success).toBe(true);
    expect(() => adaptCoachResponse(request, wrongTask)).toThrow();
  });
});
