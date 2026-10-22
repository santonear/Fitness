import { describe, it, expect } from 'vitest';
import { basicProposal } from '../../src/application/v8-workflow';
import { assembleAssistantIntent } from '../../src/backend/assistant/assemble';
import { runAssistantModel, type AssistantProvider } from '../../src/backend/assistant/model';
import { adaptCoachResponse, coachV8Exercises } from '../../src/coach/response-adapter';
import { exercises } from '../../src/catalog/exercises';
import type { AssistantRequest } from '../../src/assistant/contracts';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AssistantAttachment } from '../../src/ui/components/AssistantAttachment';
import { applicableAssistantCandidates, lowerBodyAddition } from '../../src/backend/assistant/applicable-candidates';
import { assistantMovement } from '../../src/catalog/ai-catalog';

const id = '11111111-1111-4111-8111-111111111111';
function request(message: string, bodyweightOnly = false): AssistantRequest {
  const plan = basicProposal(
    {
      goalText: '增强体能',
      weeklyTarget: 3,
      sessionMinutes: 45,
      scheduleOriginalText: '周一三五每次45分钟',
      place: 'home',
      equipment: ['none', 'dumbbell'],
      adultConfirmed: true,
      cautions: ['knee'],
      confirmedAt: '2026-10-12T00:00:00Z',
    },
    'zh',
  )!;
  const names = bodyweightOnly
    ? [
        ['蚌式开合', '靠墙俯卧撑', '自阻力划船', '死虫式'],
        ['靠墙俯卧撑', '自阻力划船', '平板支撑', '蚌式开合'],
      ]
    : [
        ['蚌式开合', '靠墙俯卧撑', '俯身哑铃划船', '死虫式'],
        ['哑铃地板推举', '自阻力划船', '平板支撑', '蚌式开合'],
      ];
  plan.templates = names.map((list, index) => ({
    id: index ? 'B' : 'A',
    name: index ? 'B' : 'A',
    estimatedMinutes: 45,
    items: list.map(name => {
      const exercise = exercises.find(e => e.name.zh === name)!;
      if (!exercise) throw Error(`fixture exercise missing: ${name}`);
      const target =
        exercise.metricType === 'duration'
          ? { metricType: 'duration' as const, durationSeconds: 30 }
          : exercise.metricType === 'reps_load'
            ? { metricType: 'reps_load' as const, reps: 8, loadGrams: 0 }
            : { metricType: 'reps' as const, reps: 8 };
      return { exerciseId: exercise.id, equipment: exercise.equipment, sets: 3, target };
    }),
  }));
  return {
    version: 'fitness-assistant-v2',
    requestId: id,
    conversationId: id,
    locale: 'zh',
    timeZone: 'Asia/Shanghai',
    adultConfirmed: true,
    messages: [{ role: 'user', content: message }],
    preferences: [{ kind: 'caution_area', value: 'knee' }],
    context: {
      version: 'fitness-coach-v8',
      requestId: id,
      conversationId: id,
      restoreGeneration: 0,
      inputSnapshot: 'snapshot',
      sendConfirmation: 'confirmed',
      locale: 'zh',
      timeZone: 'Asia/Shanghai',
      adultConfirmed: true,
      messages: [],
      task: 'MODIFY_PLAN',
      target: { planId: id, versionId: id, revision: 0 },
      instruction: message,
      plan,
    },
  };
}
const clamshell = exercises.find(e => e.name.zh === '蚌式开合')!.id;
describe('round 3 client-applicable cards', () => {
  it.each([{ cautions: [] }, { cautions: ['knee'] as const }])(
    'onboarding is accepted by the same client vocabulary, cautions=$cautions',
    ({ cautions }) => {
      const base = request('Monday Wednesday Friday evenings; maybe weekends, 40 minutes each');
      if (base.context?.task !== 'MODIFY_PLAN') throw Error('fixture');
      const { target: _target, instruction: _instruction, plan: _plan, ...common } = base.context;
      const context = {
        ...common,
        task: 'ONBOARD_PLAN' as const,
        profile: {
          goalText: 'fitness',
          weeklyTarget: 3,
          sessionMinutes: 40,
          scheduleOriginalText: 'Monday Wednesday Friday evenings',
          place: 'home' as const,
          equipment: ['none'],
          adultConfirmed: true as const,
          cautions: [...cautions],
        },
      };
      const input = { ...base, preferences: [], context };
      const card = assembleAssistantIntent({ kind: 'plan_new', params: { daysPerWeek: 3 } }, input).attachment;
      const allowed = new Set(coachV8Exercises(context).map(e => e.id));
      if (card?.type === 'plan_proposal') {
        const rejected = card.proposal.templates
          .flatMap(t => t.items)
          .filter(i => !allowed.has(i.exerciseId))
          .map(i => {
            const e = exercises.find(e => e.id === i.exerciseId)!;
            return { id: e.id, name: e.name.zh, mode: assistantMovement(e), equipment: e.equipment };
          });
        if (rejected.length) console.log('outside client catalog', rejected);
        if (cautions.length)
          for (const t of card.proposal.templates)
            for (const i of t.items)
              expect(exercises.find(e => e.id === i.exerciseId)?.name.en).not.toMatch(
                /squat|lunge|leg.press|jump|hop|burpee/i,
              );
      }
      expect(() => adaptCoachResponse(context, card)).not.toThrow();
    },
  );
  it.each(['以后别安排蚌式开合，把计划里的换掉', '把蚌式开合换掉', '给我加一个练腿的动作'])(
    'assembly and deterministic fallback pass the client validator: %s',
    async message => {
      const input = request(message);
      const intent = message.includes('加')
        ? { kind: 'plan_modify', changes: [{ op: 'add', to: '徒手早安式' }] }
        : { kind: 'plan_modify', changes: [{ op: 'replace', from: clamshell, to: '徒手早安式' }] };
      const assembled = assembleAssistantIntent(intent, input).attachment;
      expect(assembled).not.toBeNull();
      expect(() => adaptCoachResponse(input.context!, assembled)).not.toThrow();
      const provider: AssistantProvider = {
        async *streamText() {
          yield { delta: '我先看看。<<ATTACHMENT:change>>', usage: { inputTokens: 10, outputTokens: 10 } };
        },
        async generateAttachment() {
          return { content: { kind: 'none' }, usage: { inputTokens: 10, outputTokens: 10 } };
        },
      };
      const events = [];
      for await (const event of runAssistantModel(input, { provider, promptVersion: 'assistant-v3.1.0' }))
        events.push(event);
      const card = events.find(e => e.type === 'attachment');
      expect(card).toBeDefined();
      if (card?.type === 'attachment') expect(() => adaptCoachResponse(input.context!, card.attachment)).not.toThrow();
    },
  );
  it.each([false, true])('validates every emitted card for all three requests, bodyweightOnly=%s', async only => {
    for (const message of ['以后别安排蚌式开合，把计划里的换掉', '把蚌式开合换掉', '给我加一个练腿的动作']) {
      const input = request(message, only);
      const provider: AssistantProvider = {
        async *streamText() {
          yield { delta: '我先看看。<<ATTACHMENT:change>>', usage: { inputTokens: 10, outputTokens: 10 } };
        },
        async generateAttachment() {
          return { content: { kind: 'none' }, usage: { inputTokens: 10, outputTokens: 10 } };
        },
      };
      const events = [];
      for await (const event of runAssistantModel(input, { provider, promptVersion: 'assistant-v3.1.0' }))
        events.push(event);
      const card = events.find(e => e.type === 'attachment');
      if (card?.type === 'attachment') expect(() => adaptCoachResponse(input.context!, card.attachment)).not.toThrow();
      if (message.includes('加')) {
        const choice = lowerBodyAddition(input);
        if (!choice) {
          expect(card).toBeUndefined();
          expect(events.at(-1)).toMatchObject({ result: 'no_change' });
          continue;
        }
        expect(card?.type === 'attachment' && card.attachment.type === 'change_proposal').toBe(true);
        if (
          card?.type === 'attachment' &&
          card.attachment.type === 'change_proposal' &&
          input.context?.task === 'MODIFY_PLAN'
        ) {
          const old = new Set(input.context.plan.templates.flatMap(t => t.items.map(i => i.exerciseId)));
          const added = card.attachment.proposal.templates.flatMap(t => t.items).filter(i => !old.has(i.exerciseId));
          expect(added).toHaveLength(1);
          const e = exercises.find(e => e.id === added[0].exerciseId)!;
          expect(assistantMovement(e) === 'hinge' || /提踵|calf.?raise/i.test(`${e.name.zh} ${e.name.en}`)).toBe(true);
          expect(`${e.name.zh} ${e.name.en}`).not.toMatch(
            /squat|lunge|leg.press|walk|carry|jump|hop|burpee|深蹲|弓步|腿举|行走|跳跃/i,
          );
        }
      }
    }
  });
});
