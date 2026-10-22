import { describe, it, expect } from 'vitest';
import { localProfile } from '../../src/application/rules/local-profile';
import { basicProposal } from '../../src/application/v8-workflow';
import { exercises } from '../../src/catalog/exercises';
import { assistantMovement, selectAssistantCandidates } from '../../src/catalog/ai-catalog';
import { coachV8Exercises } from '../../src/coach/response-adapter';
import { assembleAssistantIntent, resolveAssistantExercise } from '../../src/backend/assistant/assemble';
import type { AssistantRequest } from '../../src/assistant/contracts';
import { runAssistantModel } from '../../src/backend/assistant/model';
import { createFitnessWorker, type FitnessWorkerEnv } from '../../src/backend/fitness-worker';
const id = '11111111-1111-4111-8111-111111111111';
const profile = localProfile({
  goalText: '减脂',
  scheduleOriginalText: '每周4次，每次15分钟，可以延长到1小时',
  placeEquipmentText: '在家，有哑铃',
  adultConfirmed: true,
  cautions: [],
});
const common = {
  version: 'fitness-coach-v8' as const,
  requestId: id,
  conversationId: id,
  restoreGeneration: 0,
  inputSnapshot: 'snapshot',
  sendConfirmation: 'confirmed',
  locale: 'zh' as const,
  timeZone: 'Asia/Shanghai',
  adultConfirmed: true as const,
  messages: [],
};
const plan = basicProposal(profile)!;
function modification(text: string): AssistantRequest {
  return {
    version: 'fitness-assistant-v2',
    requestId: id,
    conversationId: id,
    locale: 'zh',
    timeZone: 'Asia/Shanghai',
    adultConfirmed: true,
    messages: [{ role: 'user', content: text }],
    context: {
      ...common,
      task: 'MODIFY_PLAN',
      instruction: text,
      target: { planId: id, versionId: id, revision: 0 },
      plan,
      candidateContext: { equipment: ['none', 'dumbbell'], cautions: ['knee'] },
    },
  };
}
describe('round six regression', () => {
  it('retries prohibited prose once and includes both usages', async () => {
    const request = modification('你好');
    let calls = 0;
    const events = [];
    for await (const event of runAssistantModel(
      { ...request, context: undefined },
      {
        provider: {
          async *streamText() {
            calls++;
            yield {
              delta: calls === 1 ? '你必须继续。<<ATTACHMENT:none>>' : '可以一起看看训练安排。<<ATTACHMENT:none>>',
              usage: { inputTokens: 10, outputTokens: 5 },
            };
          },
          async generateAttachment() {
            throw Error('unexpected attachment');
          },
        },
      },
    ))
      events.push(event);
    expect(calls).toBe(2);
    expect(events.at(-1)).toMatchObject({
      success: true,
      usage: { inputTokens: 20, outputTokens: 10 },
      result: 'repaired',
    });
    expect(
      events
        .filter(e => e.type === 'text_delta')
        .map(e => e.delta)
        .join(''),
    ).not.toContain('必须');
  });
  it('retires old coach requests without contacting their provider', async () => {
    let calls = 0;
    const gateway = createFitnessWorker({
      fetch: async () => {
        calls++;
        return new Response();
      },
    } as never);
    for (const path of ['/api/v1/coach', '/api/v1/plans/generate', '/api/v1/stages/summarize']) {
      const response = await gateway.fetch(
        new Request(`https://example.test${path}`, {
          method: 'POST',
          body: JSON.stringify({ coach: { task: 'ONBOARD_PLAN' } }),
        }),
        {} as FitnessWorkerEnv,
      );
      expect(response.status).toBe(410);
    }
    expect(calls).toBe(0);
  });
  it('retains original equipment words separately from stable equipment IDs', () => {
    expect(profile.sessionMinutes).toBe(60);
    expect(profile.equipment).toContain('dumbbell');
    expect(profile.equipment).not.toContain('在家，有哑铃');
    expect(profile.placeEquipmentOriginalText).toBe('在家，有哑铃');
  });
  it('makes the extended duration real and keeps two templates with cardio and push', () => {
    expect(plan.templates).toHaveLength(2);
    for (const template of plan.templates) {
      expect(template.estimatedMinutes).toBeGreaterThanOrEqual(54);
      expect(template.estimatedMinutes).toBeLessThanOrEqual(66);
      expect(template.items.some(i => i.equipment === 'dumbbell')).toBe(true);
      expect(template.items.some(i => assistantMovement(exercises.find(e => e.id === i.exerciseId)!) === 'push')).toBe(
        true,
      );
      expect(
        template.items.some(i => assistantMovement(exercises.find(e => e.id === i.exerciseId)!) === 'cardio'),
      ).toBe(true);
    }
  });
  it('uses one reproducible safety filtered candidate table', () => {
    const request = modification('加一个哑铃卧推');
    const candidates = selectAssistantCandidates(request);
    const accepted = new Set(coachV8Exercises(request.context!).map(e => e.id));
    expect(candidates.every(c => accepted.has(c.exercise.id))).toBe(true);
    expect(candidates.some(c => c.exercise.name.zh === '哑铃卧推')).toBe(true);
    expect(candidates.every(c => !/squat|lunge|leg.press/i.test(c.exercise.name.en))).toBe(true);
  });
  it('adds the exact named dumbbell bench press', () => {
    const request = modification('加一个哑铃卧推');
    const result = assembleAssistantIntent(
      { kind: 'plan_modify', changes: [{ op: 'add', to: '哑铃卧推' }] },
      request,
    ).attachment;
    expect(result?.type).toBe('change_proposal');
    if (result?.type === 'change_proposal')
      expect(
        result.proposal.templates.some(t =>
          t.items.some(i => exercises.find(e => e.id === i.exerciseId)?.name.zh === '哑铃卧推'),
        ),
      ).toBe(true);
  });
  it('does not guess a different movement by edit distance', () => {
    const request = modification('加一个哑铃卧推');
    expect(resolveAssistantExercise('哑铃卧鸟', selectAssistantCandidates(request))).toBeUndefined();
  });
  it('classifies curls as pull and bicycle crunch as core', () => {
    for (const [pattern, mode] of [
      [/biceps? curl/i, 'pull'],
      [/bicycle crunch/i, 'core'],
    ] as const) {
      const exercise = exercises.find(e => pattern.test(e.name.en));
      expect(exercise).toBeDefined();
      expect(assistantMovement(exercise!)).toBe(mode);
    }
  });
  it('preserves completed indices during upper-body focus', () => {
    const request = modification('今天只练上半身，30分钟');
    if (request.context?.task !== 'MODIFY_PLAN') throw Error('context');
    const template = structuredClone(plan.templates[0]);
    request.context = {
      ...common,
      task: 'ADJUST_TODAY',
      instruction: '今天只练上半身，30分钟',
      target: { planId: id, versionId: id, revision: 0 },
      workoutId: id,
      template,
      candidateContext: { equipment: ['none', 'dumbbell'], cautions: [] },
    };
    request.currentWorkout = {
      completedSets: [{ itemIndex: 1, setIndex: 0, exerciseId: template.items[1].exerciseId, reps: 8 }],
      remainingSets: 20,
    };
    const result = assembleAssistantIntent({ kind: 'today_adjust', focus: 'upper', minutes: 30 }, request).attachment;
    expect(result?.type).toBe('today_adjustment');
    if (result?.type === 'today_adjustment') expect(result.template.items[1]).toEqual(template.items[1]);
  });
  it('replaces an unfinished squat on knee discomfort without claiming safety over a remaining squat', () => {
    const request = modification('今天膝盖不舒服');
    if (request.context?.task !== 'MODIFY_PLAN') throw Error('context');
    const template = structuredClone(plan.templates[0]);
    const squat = exercises.find(e => e.name.en === 'Bodyweight squat')!;
    template.items[0] = { exerciseId: squat.id, equipment: 'none', sets: 2, target: { metricType: 'reps', reps: 8 } };
    request.context = {
      ...common,
      task: 'ADJUST_TODAY',
      instruction: '今天膝盖不舒服',
      target: { planId: id, versionId: id, revision: 0 },
      template,
      candidateContext: { equipment: ['none', 'dumbbell'], cautions: ['knee'] },
    };
    const result = assembleAssistantIntent({ kind: 'today_adjust', changes: [] }, request).attachment;
    expect(result?.type).toBe('today_adjustment');
    if (result?.type === 'today_adjustment') {
      expect(
        result.template.items.every(
          i => !/squat|lunge|leg.press/i.test(exercises.find(e => e.id === i.exerciseId)!.name.en),
        ),
      ).toBe(true);
      expect(result.summary).toContain('已避开');
    }
  });
});
