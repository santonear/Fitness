import * as environment from '../../src/engine/environment';
import { computeWeekFacts } from '../../src/application/review/compute';
import { localCoachReplyForMode } from '../../src/coach/local-fallback';
import * as basicRules from '../../src/application/rules/basic-items';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toEngineProfile, type EngineCoachProfile } from '../../src/application/engine-profile';
import { engineHealthScope, localEngineContext } from '../../src/coach/engine-health';
import {
  sanitizeAssistantRequest,
  type AssistantRequest,
  type AssistantStreamEvent,
} from '../../src/assistant/contracts';
import {
  assistantPrompt,
  assistantPromptRegistry,
  ENGINE_ASSISTANT_PROMPT_VERSION,
  selectAssistantPromptVersion,
} from '../../src/backend/assistant/prompts';
import { runAssistantModel } from '../../src/backend/assistant/model';
import { engineCopy } from '../../src/coach/engine-copy';
import { sendAssistant } from '../../src/assistant/client';
import { engineAction, enginePlanProposal, existingEnginePlan } from '../../src/application/engine-plan';
import { assembleEngineIntent } from '../../src/backend/assistant/engine-assemble';
import * as engine from '../../src/engine';
import { exercises } from '../../src/catalog/exercises';
import { enginePlanSchema, type EngineProfile, type EngineResult } from '../../src/engine/contracts';
import type { CoachRequest } from '../../src/coach/contracts';
import type { SessionTemplate } from '../../src/domain/v8/contracts';

const id = '11111111-1111-4111-8111-111111111111';
const profile: EngineProfile = {
  goal: 'health',
  level: 'beginner',
  trainingAgeWeeks: 0,
  daysPerWeek: 3,
  sessionMinutes: 30,
  equipment: ['none'],
  place: 'home',
  constraints: { noJump: true, quiet: true, space: 'small' },
  cautions: [],
  population: { kind: 'general' },
  screening: {
    parqAllNo: true,
    knownCondition: false,
    symptoms: false,
    completedAt: '2026-10-15T00:00:00Z',
    parqAnswers: Array(7).fill(false),
  },
  preferences: { excludedExerciseIds: [], cannotDo: [] },
  birthYearMonth: '1990-01',
  ageYears: 36,
  bodyWeightKg: 70,
  asOfDate: '2026-10-15',
  locale: 'zh',
};
const coach: EngineCoachProfile = {
  goalText: '保持活动',
  weeklyTarget: 3,
  sessionMinutes: 120,
  scheduleOriginalText: '每周三次120分钟',
  place: 'home',
  equipment: ['none'],
  adultConfirmed: true,
  cautions: [],
  confirmedAt: '2026-10-15T00:00:00Z',
  population: profile.population,
  screening: profile.screening,
  healthStorageConsent: { acceptedAt: '2026-10-15T00:00:00Z' },
  birthYearMonth: '1990-01',
};
const template: SessionTemplate = {
  id: 'A',
  name: '孕20周训练',
  estimatedMinutes: 30,
  items: [
    { exerciseId: exercises[0].id, equipment: 'none', sets: 2, target: { metricType: 'reps', reps: 8 } },
    { exerciseId: exercises[1].id, equipment: 'none', sets: 2, target: { metricType: 'reps', reps: 8 } },
  ],
};
const common = {
  version: 'fitness-coach-v8' as const,
  requestId: id,
  conversationId: id,
  restoreGeneration: 0,
  inputSnapshot: 'snapshot',
  sendConfirmation: 'preview',
  locale: 'zh' as const,
  timeZone: 'Asia/Shanghai',
  adultConfirmed: true as const,
  messages: [],
  trainingEngine: true,
  engineProfile: profile,
};
const context: CoachRequest = {
  ...common,
  task: 'ADJUST_TODAY',
  target: { planId: id, versionId: id, revision: 0 },
  workoutId: id,
  template,
  instruction: '调整',
};
it('never sends local load/history evidence even when questionnaire sharing is explicitly enabled', () => {
  const source: CoachRequest = {
    ...context,
    engineProfile: {
      ...profile,
      powerOneRm: { exercise: { kg: 20, source: 'user_record' } },
      postpartumSafety: { urgentPaused: true },
      screening: {
        ...profile.screening,
        activityEvidence: { consecutiveRegularWeeks: 8, noSymptomReportsWeeks: 8 },
        age45AdvisoryAck: { acknowledgedAt: '2026-10-15T01:00:00Z', screenedAt: '2026-10-15T00:00:00Z' },
      },
    },
  };
  const before = structuredClone(source),
    sent = engineHealthScope(source, true);
  expect(sent.engineProfile?.powerOneRm).toBeUndefined();
  expect(sent.engineProfile?.postpartumSafety).toBeUndefined();
  expect(sent.engineProfile?.screening.activityEvidence).toBeUndefined();
  expect(sent.engineProfile?.screening.age45AdvisoryAck).toBeUndefined();
  expect(source).toEqual(before);
});
const request: AssistantRequest = {
  version: 'fitness-assistant-v2',
  requestId: id,
  conversationId: id,
  locale: 'zh',
  timeZone: 'Asia/Shanghai',
  adultConfirmed: true,
  context,
  consent: { body: false, history: false },
  messages: [{ role: 'user', content: '只练上肢' }],
};
const unchanged = <T>(value: T): EngineResult<T> => ({
  value,
  diff: [],
  summary: { zh: '', en: '' },
  noop: true,
  trace: [],
  notices: [],
  gates: [],
});
afterEach(() => vi.restoreAllMocks());

describe('training engine local and external boundaries', () => {
  it('preserves per-template duration targets through local proposal and health-free AI projection', () => {
    const templates = [
      { ...template, targetMinutes: 63, estimatedMinutes: 63 },
      { ...template, id: 'B', targetMinutes: 15, estimatedMinutes: 15 },
    ];
    const plan = existingEnginePlan({ weeklyTarget: 3, sessionMinutes: 63, templates });
    // A saved version's own fields stay out of the strict engine plan.
    expect(
      enginePlanSchema.safeParse(
        existingEnginePlan({ ...plan, goalText: 'x', scheduleOriginalText: 'x', reasons: ['x', 'x', 'x'] } as never),
      ).success,
    ).toBe(true);
    vi.spyOn(engine, 'generatePlan').mockReturnValue(plan);
    vi.spyOn(environment, 'applicableEnginePlan').mockReturnValue(true);
    const result = enginePlanProposal(coach, profile);
    expect(result.proposal?.sessionMinutes).toBe(63);
    expect(result.proposal?.templates.map(row => row.targetMinutes)).toEqual([63, 15]);
    const context: CoachRequest = {
      ...common,
      task: 'MODIFY_PLAN',
      target: { planId: id, versionId: id, revision: 0 },
      plan: result.proposal!,
      instruction: '调整',
    };
    const projected = sanitizeAssistantRequest({
      ...request,
      context,
      consent: { body: false, history: false, health: false },
    });
    expect(projected.context?.task).toBe('MODIFY_PLAN');
    if (projected.context?.task === 'MODIFY_PLAN')
      expect(projected.context.plan.templates.map(row => row.targetMinutes)).toEqual([63, 15]);
    expect(context.task === 'MODIFY_PLAN' && context.plan.sessionMinutes).toBe(63);
  });
  it('never turns a legacy adult checkbox or incomplete PARQ into negative answers', () => {
    const { screening: _screen, population: _population, healthStorageConsent: _consent, ...legacy } = coach;
    expect(toEngineProfile(legacy, { asOfDate: '2026-10-15' })).toBeUndefined();
    expect(
      toEngineProfile(
        { ...coach, screening: { ...profile.screening, parqAnswers: undefined } },
        { asOfDate: '2026-10-15' },
      ),
    ).toBeUndefined();
    const answers = [true, false, false, false, false, false, false];
    expect(
      toEngineProfile(
        { ...coach, screening: { ...profile.screening, parqAnswers: answers } },
        { asOfDate: '2026-10-15' },
      )?.screening.parqAllNo,
    ).toBe(false);
  });
  it('preserves legacy 120 minute facts while projecting a new supported input and keeps birth date independent', () => {
    const before = structuredClone(coach),
      mapped = toEngineProfile(coach, { asOfDate: '2026-10-15', ageYears: 19 });
    expect(mapped?.sessionMinutes).toBe(90);
    expect(mapped?.birthYearMonth).toBe('1990-01');
    expect(mapped?.ageYears).toBeUndefined();
    expect(coach).toEqual(before);
  });
  it('strips health and health-derived labels by default on both client and server', () => {
    const scoped = engineHealthScope(context);
    expect(scoped.engineProfile).toBeUndefined();
    expect(scoped.task === 'ADJUST_TODAY' && scoped.template.name).toBe('A');
    const cleaned = sanitizeAssistantRequest(request);
    expect(cleaned.context?.engineProfile).toBeUndefined();
    expect(JSON.stringify(cleaned)).not.toContain('孕20');
    expect(context.engineProfile).toEqual(profile);
  });
  it('strips persisted engine metadata after the remote flag is off without renaming ordinary templates', () => {
    const prescribed = {
      ...template,
      estimatedSeconds: 1800,
      items: template.items.map(item => ({
        ...item,
        prescription: {
          pattern: 'squat' as const,
          block: 'main' as const,
          rir: [3, 4] as [number, number],
          restSeconds: 60,
          loadDescription: { zh: '孕期轻负荷', en: 'Pregnancy light load' },
        },
      })),
    };
    const engineRequest: CoachRequest = {
      ...context,
      trainingEngine: undefined,
      engineProfile: undefined,
      template: prescribed,
    };
    const scoped = engineHealthScope(engineRequest);
    expect(scoped.task === 'ADJUST_TODAY' && scoped.template.name).toBe('A');
    expect(JSON.stringify(scoped)).not.toContain('孕期轻负荷');
    expect(JSON.stringify(scoped)).not.toContain('prescription');
    const ordinary = {
      ...context,
      trainingEngine: undefined,
      engineProfile: undefined,
      template: { ...template, name: '我的徒手训练' },
    };
    const old = engineHealthScope(ordinary);
    expect(old.task === 'ADJUST_TODAY' && old.template.name).toBe('我的徒手训练');
    expect(prescribed.items[0].prescription.loadDescription.zh).toBe('孕期轻负荷');
  });
  it('restores full local locked-item prescriptions while taking only sent request identity', () => {
    const source: CoachRequest = {
      ...context,
      template: {
        ...template,
        items: template.items.map(item => ({
          ...item,
          prescription: {
            pattern: 'squat' as const,
            block: 'main' as const,
            rir: [3, 4] as [number, number],
            restSeconds: 60,
          },
        })),
      },
    };
    const sent = { ...engineHealthScope(source), requestId: '22222222-2222-4222-8222-222222222222' };
    const local = localEngineContext(source, sent);
    expect(local.requestId).toBe(sent.requestId);
    expect(local.engineProfile).toEqual(profile);
    expect(local.task === 'ADJUST_TODAY' && local.template).toEqual(source.template);
    vi.spyOn(engine, 'adjustToday').mockImplementation(value => ({
      ...unchanged({ ...value, estimatedMinutes: 29 }),
      noop: false,
      diff: [{ kind: 'duration' }],
      summary: { zh: '预计29分钟', en: 'About 29 minutes' },
    }));
    const adjusted = engineAction(local, profile, { kind: 'adjust', request: { minutes: 29 } }, [0]);
    expect(adjusted.response?.type === 'today_adjustment' && adjusted.response.template.items[0]).toEqual(
      source.template.items[0],
    );
    expect(sent.task === 'ADJUST_TODAY' && sent.template.items[0].prescription).toBeUndefined();
  });
  it('does not let health consent imply body measurement consent', () => {
    const cleaned = sanitizeAssistantRequest({ ...request, consent: { body: false, history: false, health: true } });
    expect(cleaned.context?.engineProfile?.screening).toEqual(profile.screening);
    expect(cleaned.context?.engineProfile?.ageYears).toBeUndefined();
    expect(cleaned.context?.engineProfile?.birthYearMonth).toBeUndefined();
    expect(cleaned.context?.engineProfile?.bodyWeightKg).toBeUndefined();
  });
  it('refuses an adjustment that shifts a locked item before showing a card', () => {
    const value = { ...template, items: [template.items[1], template.items[0]] };
    vi.spyOn(engine, 'adjustToday').mockReturnValue({ ...unchanged(value), noop: false, diff: [{ kind: 'replace' }] });
    expect(engineAction(context, profile, { kind: 'adjust', request: { focus: 'upper' } }, [0])).toMatchObject({
      noop: true,
    });
    expect(
      engineAction(context, profile, { kind: 'adjust', request: { focus: 'upper' } }, [0]).response,
    ).toBeUndefined();
  });
  it('excludes the other template exercises from a single substitute candidate pool', () => {
    const spy = vi.spyOn(engine, 'substitute').mockReturnValue(unchanged(template.items[0]));
    engineAction(context, profile, { kind: 'substitute', itemIndex: 0, reason: 'equipment' });
    expect(spy.mock.calls[0][1].preferences.excludedExerciseIds).toContain(template.items[1].exerciseId);
  });
  it('maps AI add targets into engine exerciseId and preserves explicit lock inputs', () => {
    const planContext: CoachRequest = {
      ...common,
      task: 'MODIFY_PLAN',
      target: { planId: id, versionId: id, revision: 0 },
      instruction: '加一个动作',
      plan: {
        goalText: '活动',
        weeklyTarget: 3,
        sessionMinutes: 30,
        scheduleOriginalText: '',
        templates: [template],
        reasons: ['活动', '活动', '活动'],
      },
    };
    const spy = vi.spyOn(engine, 'modifyPlan').mockImplementation(plan => unchanged(plan));
    assembleEngineIntent(
      { kind: 'plan_modify', changes: [{ op: 'add', session: 'A', to: 'E1' }] },
      { ...request, context: planContext, engineCandidateIds: [exercises[2].id] },
    );
    expect(spy.mock.calls[0][2][0]).toMatchObject({ op: 'add', exerciseId: exercises[2].id });
  });
});

describe('versioned engine intent SSE', () => {
  const event = {
    type: 'engine_intent',
    version: 'fitness-engine-intent-v1',
    intent: { kind: 'today_adjust', minutes: 20 },
  };
  const finish = (success: boolean) => ({
    type: 'done',
    success,
    usage: { inputTokens: 1, outputTokens: 1 },
    promptVersion: 'test',
  });
  const fetcher = (events: unknown[]) => async () =>
    new Response(events.map(value => 'data: ' + JSON.stringify(value) + '\n\n').join(''), {
      headers: { 'content-type': 'text/event-stream' },
    });
  it('delivers an intent only after the whole stream has succeeded', async () => {
    const seen: AssistantStreamEvent[] = [];
    await sendAssistant(
      request,
      new AbortController().signal,
      event => seen.push(event),
      fetcher([event, finish(true)]),
    );
    expect(seen.map(value => value.type)).toEqual(['done', 'engine_intent']);
  });
  it('discards an intent after a failed stream and rejects unknown versions', async () => {
    const seen: AssistantStreamEvent[] = [];
    await sendAssistant(
      request,
      new AbortController().signal,
      event => seen.push(event),
      fetcher([event, finish(false)]),
    );
    expect(seen.some(value => value.type === 'engine_intent')).toBe(false);
    await expect(
      sendAssistant(
        request,
        new AbortController().signal,
        () => {},
        fetcher([{ ...event, version: 'other' }, finish(true)]),
      ),
    ).rejects.toThrow('INVALID_ENGINE_INTENT');
  });
});

describe('engine-only prompt and verbatim notices', () => {
  it('registers a separate engine version while retaining old selection behavior when disabled', () => {
    expect(assistantPromptRegistry.current).toBe('assistant-v3.1.0');
    expect(assistantPromptRegistry.previous).toBe('assistant-v3.0.0');
    expect(assistantPromptRegistry.legacy).toBe('assistant-v2.1.0');
    expect(selectAssistantPromptVersion(true)).toBe(ENGINE_ASSISTANT_PROMPT_VERSION);
    expect(selectAssistantPromptVersion(true, assistantPromptRegistry.current)).toBe(ENGINE_ASSISTANT_PROMPT_VERSION);
    for (const old of [
      assistantPromptRegistry.current,
      assistantPromptRegistry.previous,
      assistantPromptRegistry.legacy,
    ])
      expect(selectAssistantPromptVersion(false, old)).toBe(old);
    expect(selectAssistantPromptVersion(false, ENGINE_ASSISTANT_PROMPT_VERSION)).toBe(assistantPromptRegistry.current);
  });
  it('instructs engine intents to support ten minutes and omit invented numerical exercise prescriptions', () => {
    for (const stage of ['text', 'attachment'] as const) {
      const system = assistantPrompt(request, stage, ENGINE_ASSISTANT_PROMPT_VERSION)[0].content;
      expect(system).toContain('10 to 90 minutes, including 10-minute cards');
      expect(system).toContain('Never invent dose');
      expect(system).toContain('only when explicitly requested by the user');
      expect(system).toContain('otherwise omit');
      expect(system).toContain('only one minimal intention JSON object');
      expect(system).toContain('original approved rule copy verbatim');
      expect(system).toContain(
        'Do not claim that a specific exercise was replaced, a plan was applied, or a long-term preference was saved',
      );
      expect(system).toContain('A card is only a preview');
      expect(system).not.toContain('Applied plan templates support 15 to 120');
    }
  });
  it('rejects an engine legacy combination before either provider method is invoked', async () => {
    let outbound = 0;
    const provider = {
      async *streamText() {
        outbound++;
        yield { delta: 'unexpected' };
      },
      async generateAttachment() {
        outbound++;
        return { content: { kind: 'none' } };
      },
    };
    expect(() => selectAssistantPromptVersion(true, assistantPromptRegistry.legacy)).toThrow(
      'INCOMPATIBLE_ENGINE_PROMPT',
    );
    await expect(
      (async () => {
        for await (const _event of runAssistantModel(request, {
          provider,
          promptVersion: assistantPromptRegistry.legacy,
        })) {
          /* no event before protocol validation */
        }
      })(),
    ).rejects.toThrow('INVALID_PROMPT_VERSION');
    expect(outbound).toBe(0);
  });
  for (const noop of [false, true])
    it(`keeps original local rule notices intact when noop is ${noop}`, () => {
      const message = {
        zh: engineCopy('pain.copy.stop_exercise', 'zh'),
        en: engineCopy('pain.copy.stop_exercise', 'en'),
      };
      expect(message.zh.length).toBeGreaterThan(0);
      vi.spyOn(engine, 'adjustToday').mockReturnValue({
        ...unchanged(template),
        noop,
        diff: noop ? [] : [{ kind: 'duration' }],
        summary: { zh: '预计30分钟', en: 'About 30 minutes' },
        notices: [{ code: 'pain', ruleId: 'pain.copy', severity: 'warning', message }],
      });
      const assembled = assembleEngineIntent({ kind: 'today_adjust', minutes: 30 }, request);
      expect(assembled.notices).toEqual([message.zh]);
      if (noop) expect(assembled.attachment).toBeNull();
    });
});

describe('engine offline composer boundary', () => {
  it('never generates old regex cards or basic items with engine enabled, including missing context', () => {
    const basic = vi.spyOn(basicRules, 'basicItems');
    for (const value of [undefined, context])
      for (const message of ['今天只有15分钟', 'short less time', '换成徒手深蹲', '膝盖痛']) {
        const reply = localCoachReplyForMode(true, message, value, coach, 'zh');
        expect(reply.response).toBeUndefined();
        expect(reply.lines).toEqual([]);
      }
    expect(basic).not.toHaveBeenCalled();
  });
  it('retains read-only exercise guidance and meaningful review in engine mode', () => {
    const exercise = exercises[0];
    expect(localCoachReplyForMode(true, exercise.name.zh + '怎么做', context, coach, 'zh').guideExerciseId).toBe(
      exercise.id,
    );
    const review = localCoachReplyForMode(true, '本周回顾', context, coach, 'zh');
    expect(review.review).toBe(true);
    expect(review.lines.length).toBeGreaterThan(0);
    expect(review.response).toBeUndefined();
  });
  it('preserves the legacy flag-off reply', () => {
    expect(localCoachReplyForMode(false, '本周回顾', context, coach, 'zh').review).toBe(true);
  });
});

it('keeps streamed review text meaningful without requiring an adaptable plan', async () => {
  const reviewText = '本周已完成的训练可以作为回顾依据。';
  const provider = {
    async *streamText() {
      yield { delta: reviewText + '<<ATTACHMENT:review>>' };
    },
    async generateAttachment() {
      return { content: { kind: 'review', highlights: ['本周记录'] } };
    },
  };
  const events: AssistantStreamEvent[] = [];
  const { previousMovementCount: _previous, ...facts } = computeWeekFacts({
    from: '2026-10-05',
    to: '2026-10-11',
    timeZone: 'Asia/Shanghai',
    weeklyTarget: 2,
    workouts: [],
    activities: [],
    bodyWeights: [],
  });
  const review: CoachRequest = {
    ...common,
    task: 'PERIOD_REVIEW',
    target: context.target,
    kind: 'week',
    facts: { ...facts, improvements: [...facts.improvements] },
  };
  for await (const event of runAssistantModel(
    { ...request, context: review, messages: [{ role: 'user', content: '本周回顾' }] },
    { provider, promptVersion: ENGINE_ASSISTANT_PROMPT_VERSION },
  ))
    events.push(event);
  expect(
    events
      .filter(event => event.type === 'text_delta')
      .map(event => event.delta)
      .join(''),
  ).toBe(reviewText);
  expect(events.some(event => event.type === 'engine_intent' && event.intent.kind === 'review')).toBe(true);
  expect(events.some(event => event.type === 'done' && event.success)).toBe(true);
});

it('reads the task-authorized noop phrase from compiled product copy', () => {
  expect(engineCopy('assistant.copy.engine_noop', 'zh')).toBe('这次没能生成调整，点重试');
  expect(engineCopy('assistant.copy.engine_noop', 'en')).toBe('No adjustment was generated this time. Tap to retry.');
});
