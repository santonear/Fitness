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

import { estimatedDurationLabel } from '../../src/i18n/features/plan/labels';
import { PlanPage } from '../../src/ui/pages/plan/PlanPage';
describe('round4 shared actual duration display', () => {
  for (const locale of ['zh', 'en'] as const)
    for (const max of [30, 35])
      it(locale + ' range ' + max, () => {
        const input = request('调整计划');
        if (input.context?.task !== 'MODIFY_PLAN') throw Error('fixture');
        const proposal = structuredClone(input.context.plan);
        proposal.templates[0].estimatedMinutes = 30;
        proposal.templates[1].estimatedMinutes = max;
        const label = estimatedDurationLabel(proposal.templates, locale);
        expect(label).toBe(
          locale === 'zh' ? (max === 30 ? '30 分钟' : '30 分钟 – 35 分钟') : max === 30 ? '30 min' : '30 min – 35 min',
        );
        const response = {
          requestId: id,
          restoreGeneration: 0,
          mutationAllowed: false as const,
          type: 'change_proposal' as const,
          target: input.context.target,
          proposal,
          changes: ['调整训练量'],
        };
        const card = renderToStaticMarkup(
          createElement(AssistantAttachment, {
            candidate: { request: input.context, response, expectedRevision: 0 },
            locale,
          }),
        );
        const version = {
          ...proposal,
          id,
          planId: id,
          versionNumber: 1,
          createdAt: '2026-10-13T00:00:00Z',
          origin: 'onboard' as const,
          changeSummary: [],
        };
        const plan = renderToStaticMarkup(
          createElement(PlanPage, {
            version,
            currentVersionId: id,
            language: locale,
            exerciseName: id => id,
            onVersions: () => {},
            onExercises: () => {},
            onExercise: () => {},
          }),
        );
        expect(plan).toContain(label);
        expect(card).toContain(label);
        expect(card).toContain(locale === 'zh' ? '45 分钟/次' : '45 min/session');
      });
});
