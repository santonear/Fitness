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

import { manualTrainingItems } from '../../src/application/rules/manual-items';
import { sameExerciseFamily } from '../../src/catalog/exercise-family';
function fixture(message = '把哑铃地板推举换掉') {
  const input = request(message);
  if (input.context?.task !== 'MODIFY_PLAN') throw Error('fixture');
  const plan = input.context.plan;
  const floor = exercises.find(e => e.name.zh === '哑铃地板推举')!;
  const item = {
    exerciseId: floor.id,
    equipment: floor.equipment,
    sets: 4,
    target: { metricType: 'reps_load' as const, reps: 8, loadGrams: 10000 },
  };
  plan.templates[0].items[0] = structuredClone(item);
  plan.templates[1].items[0] = { ...structuredClone(item), sets: 3 };
  const candidate = applicableAssistantCandidates(input).find(
    row =>
      row.mode === 'push' &&
      row.exercise.metricType === 'reps_load' &&
      row.exercise.id !== floor.id &&
      !plan.templates
        .flatMap(t => t.items)
        .some(
          i =>
            i.exerciseId !== floor.id &&
            sameExerciseFamily(
              exercises.find(e => e.id === i.exerciseId)!,
              row.exercise,
            ),
        ),
  )!;
  if (!candidate) throw Error('candidate');
  return { input, plan, floor, candidate };
}
describe('round5 replacement volume', () => {
  it('preserves four sets and eight reps, resets only load and renders the inherited volume', () => {
    const { input, floor, candidate } = fixture('把 A 里的哑铃地板推举换掉');
    const card = assembleAssistantIntent(
      { kind: 'plan_modify', changes: [{ op: 'replace', from: floor.id, to: candidate.code, session: 'A' }] },
      input,
    ).attachment;
    if (card?.type !== 'change_proposal') throw Error('card');
    expect(card.proposal.templates[0].items[0]).toMatchObject({
      sets: 4,
      target: { metricType: 'reps_load', reps: 8, loadGrams: 0 },
    });
    expect(() => adaptCoachResponse(input.context!, card)).not.toThrow();
    const html = renderToStaticMarkup(
      createElement(AssistantAttachment, {
        candidate: { request: input.context!, response: card, expectedRevision: 0 },
        locale: 'zh',
      }),
    );
    expect(html).toContain('4 组');
    expect(html).toContain('8 次');
    expect(html).toContain('选择你的重量');
  });
  it('inherits each session own set count', () => {
    const { input, floor, candidate } = fixture();
    const card = assembleAssistantIntent(
      { kind: 'plan_modify', changes: [{ op: 'replace', from: floor.id, to: candidate.code }] },
      input,
    ).attachment;
    if (card?.type !== 'change_proposal') throw Error('card');
    expect(card.proposal.templates.map(t => t.items[0].sets)).toEqual([4, 3]);
  });
  it('ignores model duration parameters when the replacement request states no duration', () => {
    const { input, plan, floor, candidate } = fixture();
    if (input.context?.task !== 'MODIFY_PLAN') throw Error('context');
    const { plan: _plan, instruction: _instruction, ...common } = input.context;
    const context = {
      ...common,
      task: 'ADJUST_TODAY' as const,
      template: plan.templates[0],
      instruction: '把哑铃地板推举换掉',
    };
    const card = assembleAssistantIntent(
      { kind: 'today_adjust', minutes: 15, changes: [{ op: 'replace', from: floor.id, to: candidate.code }] },
      { ...input, context },
    ).attachment;
    if (card?.type !== 'today_adjustment') throw Error('card');
    expect(card.template.items[0]).toMatchObject({ sets: 4, target: { reps: 8, loadGrams: 0 } });
    expect(card.template.items.slice(1)).toEqual(context.template.items.slice(1));
    expect(() => adaptCoachResponse(context, card)).not.toThrow();
  });
  it('uses registered manual selection defaults on metric conversion, keeping sets', () => {
    const { input, plan } = fixture('把农夫行走换掉');
    const carry = exercises.find(e => e.name.zh === '哑铃农夫行走')!;
    plan.templates[0].items[0] = {
      exerciseId: carry.id,
      equipment: carry.equipment,
      sets: 4,
      target: { metricType: 'reps_load', reps: 8, loadGrams: 10000 },
    };
    const card = assembleAssistantIntent(
      { kind: 'plan_modify', changes: [{ session: 'A', op: 'replace', from: carry.id, to: '平板支撑' }] },
      input,
    ).attachment;
    if (card?.type !== 'change_proposal') throw Error('card');
    const next = card.proposal.templates[0].items[0];
    expect(next.sets).toBe(4);
    expect(next.target).toEqual({ metricType: 'duration', ...manualTrainingItems([next.exerciseId])[0].target });
    expect(() => adaptCoachResponse(input.context!, card)).not.toThrow();
  });
  it('fits only an explicitly requested duration and renders the actual reduced set count', () => {
    const { input, plan, floor, candidate } = fixture('今天只练30分钟，把哑铃地板推举换掉');
    const template = plan.templates[0];
    for (const item of template.items) {
      item.sets = 4;
      if ('reps' in item.target) item.target.reps = 20;
    }
    if (input.context?.task !== 'MODIFY_PLAN') throw Error('context');
    const { plan: _plan, instruction: _instruction, ...common } = input.context;
    const context = { ...common, task: 'ADJUST_TODAY' as const, template, instruction: input.messages[0].content };
    const card = assembleAssistantIntent(
      { kind: 'today_adjust', minutes: 30, changes: [{ op: 'replace', from: floor.id, to: candidate.code }] },
      { ...input, context },
    ).attachment;
    if (card?.type !== 'today_adjustment') throw Error('card');
    expect(card.template.items.some(i => i.sets < 4)).toBe(true);
    expect(card.template.estimatedMinutes).toBeGreaterThanOrEqual(27);
    expect(card.template.estimatedMinutes).toBeLessThanOrEqual(33);
    expect(() => adaptCoachResponse(context, card)).not.toThrow();
    const html = renderToStaticMarkup(
      createElement(AssistantAttachment, {
        candidate: { request: context, response: card, expectedRevision: 0 },
        locale: 'zh',
      }),
    );
    for (const item of card.template.items.filter(i => i.sets < 4)) expect(html).toContain(item.sets + ' 组');
  });
});
