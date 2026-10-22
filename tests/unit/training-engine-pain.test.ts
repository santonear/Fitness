import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createTrainingPain,
  effectivePainItem,
  activePainReplacement,
  latestSetFeedback,
  painQuestionKeys,
  unresolvedReview,
} from '../../src/application/training-pain';
import { createV8Workflow } from '../../src/application/v8-workflow';
import { v8BackupSchema, v8StateSchema, v8WorkoutSchema } from '../../src/domain/schemas';
import { EXERCISE_IDS } from '../../src/catalog/exercises';
import type { Repository } from '../../src/persistence/repository';
import type { WorkoutRecord, CoachProfile } from '../../src/domain/v8/contracts';
import { baseProfile } from '../../tools/eval/training-engine-profiles';
import { pendingPainReviews } from '../../src/application/pain-events';
import { toEngineProfile, historyPainState } from '../../src/application/engine-profile';
import { generatePlan } from '../../src/engine';

const at = '2026-10-15T02:00:00.000Z',
  id = 'f1111111-1111-4111-8111-111111111111',
  eventId = 'f2222222-2222-4222-8222-222222222222',
  secondId = 'f3333333-3333-4333-8333-333333333333';
function fixture() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-15T03:00:00.000Z'));
  const p = baseProfile();
  const coach: CoachProfile = {
    goalText: '规律训练',
    weeklyTarget: 3,
    sessionMinutes: 30,
    scheduleOriginalText: '每周三次',
    place: 'home',
    equipment: ['none'],
    adultConfirmed: true,
    cautions: [],
    confirmedAt: at,
    healthStorageConsent: { acceptedAt: at },
    birthYearMonth: p.birthYearMonth,
    population: p.population,
    screening: p.screening,
  };
  let state = v8StateSchema.parse({
    id: 'v8',
    migratedAt: at,
    legacyPlanIds: [],
    notice: { planCount: 0, acknowledged: true },
    coachProfile: coach,
  });
  let record: WorkoutRecord = {
    id,
    startedAt: at,
    localDate: '2026-10-15',
    timeZone: 'Asia/Shanghai',
    status: 'in_progress',
    plannedSetCount: 4,
    templateSnapshot: {
      id: 'pain',
      name: '合成训练',
      estimatedMinutes: 30,
      items: [
        {
          exerciseId: EXERCISE_IDS.bodyweightSquat,
          equipment: 'none',
          sets: 2,
          target: { metricType: 'reps', reps: 8 },
          prescription: { pattern: 'squat', block: 'main', rir: [3, 4], restSeconds: 90, structure: 'straight' },
        },
        {
          exerciseId: EXERCISE_IDS.selfResistedRow,
          equipment: 'none',
          sets: 2,
          target: { metricType: 'reps', reps: 8 },
        },
      ],
    },
    plannedExercises: [
      { exerciseId: EXERCISE_IDS.bodyweightSquat, itemIndex: 0, plannedSetCount: 2 },
      { exerciseId: EXERCISE_IDS.selfResistedRow, itemIndex: 1, plannedSetCount: 2 },
    ],
    sets: [{ exerciseId: EXERCISE_IDS.bodyweightSquat, itemIndex: 0, setIndex: 0, reps: 8, completedAt: at }],
    setFeedbackEvents: [
      {
        id: eventId,
        exerciseId: EXERCISE_IDS.bodyweightSquat,
        itemIndex: 0,
        setIndex: 0,
        createdAt: at,
        effort: 'discomfort',
        painScore: 6,
        painArea: 'knee',
      },
    ],
  };
  let failStateWrite = false,
    revision = 0,
    others: WorkoutRecord[] = [];
  const all = () => [record, ...others];
  const repo = {
    readMetadata: async () => ({ dataRevision: revision, restoreGeneration: 0 }),
    write: async <T>(fn: () => Promise<T>, expected?: number) => {
      if (expected !== undefined && expected !== revision) throw Error('STALE_REVISION');
      const before = structuredClone({ record, state, revision, others });
      try {
        const result = await fn();
        revision++;
        return result;
      } catch (error) {
        ({ record, state, revision, others } = before);
        throw error;
      }
    },
    db: {
      sessions: { where: () => ({ equals: () => ({ count: async () => 0 }) }) },
      profiles: { toCollection: () => ({ first: async () => ({ locale: 'zh', timeZone: 'Asia/Shanghai' }) }) },
      v8Workouts: {
        get: async (key: string) => structuredClone(all().find(row => row.id === key)),
        toArray: async () => structuredClone(all()),
        where: () => ({
          equals: (status: string) => ({
            count: async () => all().filter(row => row.status === status).length,
            toArray: async () => structuredClone(all().filter(row => row.status === status)),
          }),
        }),
        add: async (value: WorkoutRecord) => {
          others.push(structuredClone(value));
        },
        put: async (value: WorkoutRecord) => {
          if (value.id === record.id) record = structuredClone(value);
          else others = others.map(row => (row.id === value.id ? structuredClone(value) : row));
        },
      },
      v8State: {
        get: async () => structuredClone(state),
        put: async (value: typeof state) => {
          if (failStateWrite) throw Error('INJECTED_STATE_WRITE_FAILURE');
          state = structuredClone(value);
        },
      },
    },
  } as unknown as Repository;
  return {
    repo,
    service: createTrainingPain(repo),
    record: () => record,
    state: () => state,
    addOther: (value: WorkoutRecord) => others.push(structuredClone(value)),
    records: () => all(),
    setRecord: (value: WorkoutRecord) => {
      record = value;
    },
    failState: () => {
      failStateWrite = true;
    },
    answers: () => Object.fromEntries(painQuestionKeys(['knee']).map(key => [key, false])),
  };
}
afterEach(() => vi.useRealTimers());

describe('confirmed pain actions preserve training facts and safety review', () => {
  it.each([4, 5])(
    'requires every explicit answer before previewing and applying a score-%s replacement',
    async score => {
      const f = fixture();
      f.record().setFeedbackEvents![0].painScore = score;
      const before = JSON.stringify({ record: f.record(), profile: f.state().coachProfile });
      const unknown = await f.service.preview(id, eventId);
      expect(unknown.action).toBe('substitute');
      expect(unknown.redFlagsRequired).toBe(true);
      expect(unknown.replacement).toBeUndefined();
      const partial = f.answers();
      delete partial[unknown.questions[0].key];
      const incomplete = await f.service.preview(id, eventId, partial);
      expect(incomplete.replacement).toBeUndefined();
      await expect(f.service.apply(id, eventId, undefined, partial)).rejects.toThrow('RED_FLAG_ANSWERS_REQUIRED');
      expect(JSON.stringify({ record: f.record(), profile: f.state().coachProfile })).toBe(before);
      const ready = await f.service.preview(id, eventId, f.answers());
      expect(ready.redFlagsRequired).toBe(false);
      expect(ready.blocked).toBe(false);
      expect(ready.replacement).toBeDefined();
      expect(ready.replacement?.exerciseId).not.toBe(f.record().sets[0].exerciseId);
      const { itemIndex: _, ...replacement } = ready.replacement!;
      const facts = structuredClone(f.record().sets);
      await f.service.apply(id, eventId, undefined, f.answers());
      expect(f.record().painActions?.[0].replacement).toEqual(replacement);
      expect(f.record().sets).toEqual(facts);
    },
  );
  it('never previews a replacement after a positive danger-sign answer', async () => {
    const f = fixture();
    f.record().setFeedbackEvents![0].painScore = 4;
    const answers = f.answers();
    answers[Object.keys(answers)[0]] = true;
    const preview = await f.service.preview(id, eventId, answers);
    expect(preview.blocked).toBe(true);
    expect(preview.replacement).toBeUndefined();
    await f.service.apply(id, eventId, undefined, answers);
    expect(f.record().painActions?.[0].replacement).toBeUndefined();
    expect(f.record().painReviewRequired).toBe(true);
    await expect(createV8Workflow(f.repo).recordSet(id, 1, 0, { reps: 8 })).rejects.toThrow('PAIN_REVIEW_REQUIRED');
  });
  it.each([false, true])('does not answer pending pain by finishing or abandoning the workout (%s)', async abandon => {
    const f = fixture(),
      workflow = createV8Workflow(f.repo);
    await workflow.finish(id, { reasons: [] }, abandon);
    expect(pendingPainReviews(f.records())).toHaveLength(1);
    await expect(workflow.start(undefined, EXERCISE_IDS.bodyweightSquat)).rejects.toThrow('PAIN_REVIEW_REQUIRED');
    expect(f.records()).toHaveLength(1);
  });
  it('blocks a new proposal and a separate active workout while old ended pain is unanswered', async () => {
    const f = fixture(),
      workflow = createV8Workflow(f.repo);
    await workflow.finish(id, { reasons: [] });
    await expect(workflow.propose(f.state().coachProfile!, 'zh')).rejects.toThrow('PAIN_REVIEW_REQUIRED');
    const other = {
      ...structuredClone(f.record()),
      id: 'f4444444-4444-4444-8444-444444444444',
      status: 'in_progress' as const,
      sets: [],
      setFeedbackEvents: [],
    };
    delete other.endedAt;
    f.addOther(other);
    await expect(workflow.recordSet(other.id, 1, 0, { reps: 8 })).rejects.toThrow('PAIN_REVIEW_REQUIRED');
    expect(f.records()[1].sets).toEqual([]);
  });
  it('projects pending history as unknown screening without changing stored profile or facts', async () => {
    const f = fixture();
    await createV8Workflow(f.repo).finish(id, { reasons: [] });
    const before = JSON.stringify({ profile: f.state().coachProfile, history: f.records() });
    const mapped = toEngineProfile(f.state().coachProfile!, {
      asOfDate: '2026-10-15',
      timeZone: 'Asia/Shanghai',
      history: f.records(),
    });
    expect(mapped).toBeDefined();
    expect(mapped?.screening.redFlagReview?.answeredAt).toBeUndefined();
    expect(mapped?.screening.redFlagReview?.questionKeys).toEqual(expect.arrayContaining(painQuestionKeys(['knee'])));
    expect(generatePlan(mapped!).gates.some(gate => gate.status === 'blocked')).toBe(true);
    expect(JSON.stringify({ profile: f.state().coachProfile, history: f.records() })).toBe(before);
  });
  it('requires the explicit past-review route, adds only safety metadata and then permits a new manual start', async () => {
    const f = fixture(),
      workflow = createV8Workflow(f.repo);
    await expect(workflow.completePastPainReview(id, eventId, undefined, f.answers())).rejects.toThrow(
      'TRAINING_NOT_ENDED',
    );
    await workflow.finish(id, { reasons: [] });
    const before = structuredClone(f.record());
    await expect(f.service.apply(id, eventId, undefined, f.answers())).rejects.toThrow('TRAINING_ENDED');
    await expect(workflow.completePastPainReview(id, eventId)).rejects.toThrow('RED_FLAG_ANSWERS_REQUIRED');
    await workflow.completePastPainReview(id, eventId, undefined, f.answers());
    const { painActions, painReviewRequired, ...facts } = f.record();
    expect(facts).toEqual(before);
    expect(painActions).toHaveLength(1);
    expect(painReviewRequired).toBe(false);
    expect(pendingPainReviews(f.records())).toEqual([]);
    const next = await workflow.start(undefined, EXERCISE_IDS.selfResistedRow);
    expect(next.status).toBe('in_progress');
    expect(next.sets).toEqual([]);
    expect(f.record().sets).toEqual(before.sets);
    expect(f.record().status).toBe(before.status);
  });
  it.each(['complete', 'partial'] as const)(
    'enforces confirmed pattern exclusion across manual sessions until an actual next %s workout',
    async status => {
      const f = fixture(),
        workflow = createV8Workflow(f.repo);
      await f.service.apply(id, eventId, undefined, f.answers());
      await workflow.finish(id, { reasons: [] });
      const original = structuredClone(f.record());
      delete f.state().coachProfile!.screening;
      delete f.state().coachProfile!.population;
      delete f.state().coachProfile!.healthStorageConsent;
      const withdrawn = structuredClone(f.state().coachProfile);
      vi.advanceTimersByTime(1000);
      const blocked = await workflow.start(undefined, EXERCISE_IDS.bodyweightSquat);
      await expect(workflow.recordSet(blocked.id, 0, 0, { reps: 8 })).rejects.toThrow('PAIN_PATTERN_EXCLUDED');
      expect(f.records().find(row => row.id === blocked.id)!.sets).toEqual([]);
      await workflow.finish(blocked.id, { reasons: [] }, true);
      expect(historyPainState(f.records())?.find(row => row.pattern === 'squat')?.remainingSessions).toBeGreaterThan(0);
      vi.advanceTimersByTime(1000);
      const next = await workflow.start(undefined, EXERCISE_IDS.selfResistedRow);
      await workflow.recordSet(next.id, 0, 0, { reps: 8 });
      if (status === 'complete')
        for (let n = 1; n < next.plannedSetCount!; n++) await workflow.recordSet(next.id, 0, n, { reps: 8 });
      const finished = await workflow.finish(next.id, { reasons: [] });
      expect(finished.status).toBe(status);
      expect(finished.sets.length).toBeGreaterThan(0);
      vi.advanceTimersByTime(1000);
      const released = await workflow.start(undefined, EXERCISE_IDS.bodyweightSquat);
      await expect(workflow.recordSet(released.id, 0, 0, { reps: 8 })).resolves.toMatchObject({
        sets: [expect.objectContaining({ exerciseId: EXERCISE_IDS.bodyweightSquat })],
      });
      expect(f.record()).toEqual(original);
      expect(f.state().coachProfile).toEqual(withdrawn);
    },
  );
  it('retains historical positive danger after profile-health withdrawal without restoring the withdrawn data', async () => {
    const f = fixture(),
      workflow = createV8Workflow(f.repo),
      answers = f.answers();
    answers[Object.keys(answers)[0]] = true;
    await f.service.apply(id, eventId, undefined, answers);
    await workflow.finish(id, { reasons: [] });
    const original = structuredClone(f.state().coachProfile!),
      facts = structuredClone(f.record());
    delete f.state().coachProfile!.screening;
    delete f.state().coachProfile!.population;
    delete f.state().coachProfile!.healthStorageConsent;
    const withdrawn = structuredClone(f.state().coachProfile);
    await expect(workflow.start(undefined, EXERCISE_IDS.selfResistedRow)).rejects.toThrow('PAIN_REVIEW_REQUIRED');
    await expect(workflow.propose(f.state().coachProfile!, 'zh')).rejects.toThrow('PAIN_REVIEW_REQUIRED');
    const other = {
      ...structuredClone(f.record()),
      id: secondId,
      status: 'in_progress' as const,
      sets: [],
      setFeedbackEvents: [],
      painActions: [],
      painReviewRequired: false,
    };
    delete other.endedAt;
    f.addOther(other);
    await expect(workflow.recordSet(secondId, 1, 0, { reps: 8 })).rejects.toThrow('PAIN_REVIEW_REQUIRED');
    await expect(f.service.confirmProfessionalSeen()).rejects.toThrow('RED_FLAG_ANSWERS_REQUIRED');
    expect(f.state().coachProfile).toEqual(withdrawn);
    expect(f.record()).toEqual(facts);
    expect(f.records()[1].sets).toEqual([]);
    f.state().coachProfile!.healthStorageConsent = { acceptedAt: new Date().toISOString() };
    f.state().coachProfile!.screening = structuredClone(original.screening!);
    delete f.state().coachProfile!.screening!.redFlagReview;
    await f.service.confirmProfessionalSeen();
    expect(f.state().coachProfile!.screening!.redFlagReview?.professionalSeenAt).toBeTruthy();
    expect(Object.values(f.state().coachProfile!.screening!.redFlagReview!.answers!)).toContain(true);
    expect(f.state().coachProfile!.population).toBeUndefined();
    expect(f.record()).toEqual(facts);
    expect(f.records()[1].sets).toEqual([]);
    await expect(workflow.recordSet(secondId, 1, 0, { reps: 8 })).resolves.toBeDefined();
  });
  it.each(['missing', 'short', 'rescreen', 'incomplete'])(
    'cannot confirm professional recovery with %s screening',
    async mode => {
      const f = fixture(),
        answers = f.answers();
      answers[Object.keys(answers)[0]] = true;
      await f.service.apply(id, eventId, undefined, answers);
      const screening = f.state().coachProfile!.screening!;
      if (mode === 'missing') delete screening.parqAnswers;
      if (mode === 'short') screening.parqAnswers = [false];
      if (mode === 'rescreen') screening.rescreenRequired = true;
      if (mode === 'incomplete') delete screening.completedAt;
      const before = structuredClone({ state: f.state(), record: f.record() });
      await expect(f.service.confirmProfessionalSeen()).rejects.toThrow('RED_FLAG_ANSWERS_REQUIRED');
      expect({ state: f.state(), record: f.record() }).toEqual(before);
    },
  );
  it('finishes an ended moderate-pain review with an incomplete engine profile without accepting a replacement', async () => {
    const f = fixture(),
      workflow = createV8Workflow(f.repo);
    f.record().setFeedbackEvents![0].painScore = 4;
    delete f.state().coachProfile!.birthYearMonth;
    await workflow.finish(id, { reasons: [] });
    const before = structuredClone(f.record());
    const preview = await f.service.preview(id, eventId, f.answers());
    expect(preview.replacement).toBeUndefined();
    expect(preview.blocked).toBe(false);
    await expect(f.service.apply(id, eventId, undefined, f.answers())).rejects.toThrow('TRAINING_ENDED');
    await workflow.completePastPainReview(id, eventId, undefined, f.answers());
    expect(f.record().painActions).toHaveLength(1);
    expect(f.record().painActions![0]).toMatchObject({ kind: 'review', eventId });
    expect(f.record().painActions![0].replacement).toBeUndefined();
    expect(f.record().painActions![0].excludedItemIndexes).toBeUndefined();
    const { painActions: _, painReviewRequired: __, ...remaining } = f.record();
    expect(remaining).toEqual(before);
    expect(pendingPainReviews(f.records())).toEqual([]);
  });
  it('cannot erase an unresolved positive review with later all-negative answers', async () => {
    const f = fixture(),
      keys = painQuestionKeys(['back']);
    f.state().coachProfile!.screening!.redFlagReview = {
      requiredAt: at,
      answeredAt: at,
      questionKeys: keys,
      areas: ['back'],
      answers: { [keys[0]]: true },
    };
    const facts = structuredClone(f.record().sets),
      answers = Object.fromEntries([...keys, ...painQuestionKeys(['knee'])].map(key => [key, false]));
    await f.service.apply(id, eventId, 0, answers);
    const review = f.state().coachProfile!.screening!.redFlagReview!;
    expect(review.answers?.[keys[0]]).toBe(true);
    expect(review.areas).toContain('back');
    expect(review.areas).toContain('knee');
    expect(unresolvedReview(review)).toBe(true);
    expect(f.record().sets).toEqual(facts);
    await expect(createV8Workflow(f.repo).recordSet(id, 1, 0, { reps: 8 })).rejects.toThrow('PAIN_REVIEW_REQUIRED');
  });
  it('keeps an unanswered older review unresolved across a new all-negative pain questionnaire', async () => {
    const f = fixture(),
      keys = painQuestionKeys(['back']);
    f.state().coachProfile!.screening!.redFlagReview = {
      requiredAt: at,
      questionKeys: keys,
      areas: ['back'],
      answers: {},
    };
    f.record().setFeedbackEvents![0].effort = 'right';
    await expect(createV8Workflow(f.repo).recordSet(id, 1, 0, { reps: 8 })).rejects.toThrow('PAIN_REVIEW_REQUIRED');
    f.record().setFeedbackEvents![0].effort = 'discomfort';
    try {
      await f.service.apply(id, eventId, 0, f.answers());
    } catch (error) {
      expect(String(error)).toContain('RED_FLAG_ANSWERS_REQUIRED');
    }
    const review = f.state().coachProfile!.screening!.redFlagReview!;
    expect(review.questionKeys).toEqual(expect.arrayContaining(keys));
    expect(keys.some(key => review.answers?.[key] === undefined)).toBe(true);
    expect(unresolvedReview(review)).toBe(true);
    await expect(createV8Workflow(f.repo).recordSet(id, 1, 0, { reps: 8 })).rejects.toThrow('PAIN_REVIEW_REQUIRED');
  });
  it('uses the actual manually substituted exercise and metric to decide the affected pattern', async () => {
    const f = fixture(),
      record = f.record();
    record.substitutions = [
      {
        fromExerciseId: EXERCISE_IDS.bodyweightSquat,
        toExerciseId: EXERCISE_IDS.selfResistedRow,
        itemIndex: 0,
        reason: 'other',
        createdAt: at,
      },
    ];
    record.sets[0].exerciseId = EXERCISE_IDS.selfResistedRow;
    record.setFeedbackEvents![0].exerciseId = EXERCISE_IDS.selfResistedRow;
    expect(effectivePainItem(record, 0, record.setFeedbackEvents![0])?.prescription?.pattern).toBe('pull_horizontal');
    await f.service.apply(id, eventId, 0, f.answers());
    expect(f.record().painActions?.[0].pattern).toBe('pull_horizontal');
    expect(f.record().sets[0].exerciseId).toBe(EXERCISE_IDS.selfResistedRow);
  });
  it('lets a later explicit manual substitution take precedence over an earlier pain replacement', () => {
    const f = fixture(),
      record = f.record();
    record.painActions = [
      {
        eventId,
        appliedAt: at,
        kind: 'substitute',
        pattern: 'squat',
        itemIndex: 0,
        replacement: record.templateSnapshot!.items[0],
      },
    ];
    record.substitutions = [
      {
        fromExerciseId: EXERCISE_IDS.bodyweightSquat,
        toExerciseId: EXERCISE_IDS.selfResistedRow,
        itemIndex: 0,
        reason: 'other',
        createdAt: '2026-10-15T02:30:00.000Z',
      },
    ];
    record.sets.push({ ...record.sets[0], exerciseId: EXERCISE_IDS.selfResistedRow, setIndex: 1 });
    expect(activePainReplacement(record, 0)).toBeUndefined();
    expect(effectivePainItem(record, 0)?.exerciseId).toBe(EXERCISE_IDS.selfResistedRow);
  });
  it('uses the completed metric of a manual timed action instead of copying squat repetitions', () => {
    const f = fixture(),
      record = f.record();
    record.sets = [{ exerciseId: EXERCISE_IDS.plank, itemIndex: 0, setIndex: 0, durationSeconds: 20, completedAt: at }];
    record.setFeedbackEvents![0].exerciseId = EXERCISE_IDS.plank;
    const effective = effectivePainItem(record, 0, record.setFeedbackEvents![0]);
    expect(effective?.target).toEqual({ metricType: 'duration', durationSeconds: 20 });
    expect(effective?.prescription?.pattern).toBe('anti_extension');
  });
  it('supports a manual workout without a template snapshot and excludes the current actual slot', async () => {
    const f = fixture(),
      record = f.record();
    delete record.templateSnapshot;
    record.sets[0].exerciseId = EXERCISE_IDS.selfResistedRow;
    record.setFeedbackEvents![0].exerciseId = EXERCISE_IDS.selfResistedRow;
    record.sets.push({ ...record.sets[0], itemIndex: 1 });
    expect(effectivePainItem(record, 0, record.setFeedbackEvents![0])).toMatchObject({
      exerciseId: EXERCISE_IDS.selfResistedRow,
      sets: 2,
      target: { metricType: 'reps', reps: 8 },
    });
    const facts = structuredClone(record.sets);
    await f.service.apply(id, eventId, 0, f.answers());
    expect(f.record().painActions?.[0]).toMatchObject({ pattern: 'pull_horizontal', excludedItemIndexes: [0, 1] });
    expect(f.record().sets).toEqual(facts);
  });
  it('projects the latest feedback correction per completed set and refuses superseded pain actions', async () => {
    const f = fixture();
    f.record().setFeedbackEvents!.push({
      ...f.record().setFeedbackEvents![0],
      id: secondId,
      effort: 'right',
      createdAt: '2026-10-15T02:01:00.000Z',
    });
    expect(latestSetFeedback(f.record()).map(event => event.id)).toEqual([secondId]);
    await expect(f.service.preview(id, eventId)).rejects.toThrow('PAIN_FEEDBACK_SUPERSEDED');
    await createV8Workflow(f.repo).recordSet(id, 0, 1, { reps: 8 });
    expect(f.record().sets).toHaveLength(2);
  });
  it('applies one append-only action idempotently and rolls back a failed profile write atomically', async () => {
    const f = fixture(),
      before = structuredClone(f.record());
    f.failState();
    await expect(f.service.apply(id, eventId, 0, f.answers())).rejects.toThrow('INJECTED_STATE_WRITE_FAILURE');
    expect(f.record()).toEqual(before);
    const success = fixture();
    await success.service.apply(id, eventId, 0, success.answers());
    const once = structuredClone(success.record());
    await success.service.apply(id, eventId, undefined, success.answers());
    expect(success.record()).toEqual(once);
    expect(success.record().painActions).toHaveLength(1);
    expect(success.record().sets).toEqual(before.sets);
  });
  it.each([
    'review_active',
    'review_replacement',
    'review_exclusions',
    'exclude_empty',
    'exclude_missing_current',
    'substitute_unblocked_without_replacement',
  ] as const)('rejects malformed pain action structure in workout and backup: %s', variant => {
    const f = fixture(),
      record = structuredClone(f.record()),
      action = {
        eventId,
        appliedAt: at,
        kind: 'review' as const,
        pattern: 'squat' as const,
        itemIndex: 0,
        redFlagAnswers: f.answers(),
      };
    if (variant.startsWith('review')) {
      record.painActions = [action];
      if (variant !== 'review_active') {
        record.status = 'partial';
        record.endedAt = at;
      }
      if (variant === 'review_replacement') record.painActions[0].replacement = record.templateSnapshot!.items[1];
      if (variant === 'review_exclusions') record.painActions[0].excludedItemIndexes = [0];
    } else if (variant.startsWith('exclude'))
      record.painActions = [
        { ...action, kind: 'exclude', excludedItemIndexes: variant === 'exclude_empty' ? [] : [1] },
      ];
    else {
      record.painActions = [{ ...action, kind: 'substitute' }];
      record.painReviewRequired = false;
    }
    const backup = { state: f.state(), plans: [], planVersions: [], workouts: [record], activities: [] };
    expect.soft(v8WorkoutSchema.safeParse(record).success).toBe(false);
    expect.soft(v8BackupSchema.safeParse(JSON.parse(JSON.stringify(backup))).success).toBe(false);
  });
  it('round trips structurally valid ended reviews and explicitly blocked active substitutes without inventing a replacement', () => {
    const f = fixture(),
      record = structuredClone(f.record()),
      action = {
        eventId,
        appliedAt: at,
        kind: 'review' as const,
        pattern: 'squat' as const,
        itemIndex: 0,
        redFlagAnswers: f.answers(),
      };
    record.status = 'partial';
    record.endedAt = at;
    record.painActions = [action];
    const backup = { state: f.state(), plans: [], planVersions: [], workouts: [record], activities: [] };
    expect(v8BackupSchema.parse(JSON.parse(JSON.stringify(backup))).workouts[0]).toEqual(record);
    const active = structuredClone(f.record());
    active.painActions = [{ ...action, kind: 'substitute' }];
    active.painReviewRequired = true;
    expect(v8BackupSchema.parse({ ...backup, workouts: [active] }).workouts[0]).toEqual(active);
  });
  it('round trips valid actions through backup schemas and rejects broken action references', async () => {
    const f = fixture();
    await f.service.apply(id, eventId, 0, f.answers());
    const valid = f.record();
    const backup = { state: f.state(), plans: [], planVersions: [], workouts: [valid], activities: [] };
    expect(v8BackupSchema.parse(JSON.parse(JSON.stringify(backup))).workouts[0]).toEqual(valid);
    const invalids = [
      { ...valid, painActions: [{ ...valid.painActions![0], eventId: secondId }] },
      { ...valid, painActions: [valid.painActions![0], valid.painActions![0]] },
      { ...valid, painActions: [{ ...valid.painActions![0], itemIndex: 1 }] },
      { ...valid, sets: [] },
      { ...valid, setFeedbackEvents: [{ ...valid.setFeedbackEvents![0], effort: 'right' as const }] },
      { ...valid, painActions: [{ ...valid.painActions![0], excludedItemIndexes: [99] }] },
    ];
    for (const record of invalids) {
      expect(v8WorkoutSchema.safeParse(record).success).toBe(false);
      expect(v8BackupSchema.safeParse({ ...backup, workouts: [record] }).success).toBe(false);
    }
  });
});
