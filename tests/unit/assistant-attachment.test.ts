import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { AssistantAttachment } from '../../src/ui/components/AssistantAttachment';
import type { CoachApplication } from '../../src/ui/components/CoachPanel';
import { EXERCISE_IDS } from '../../src/catalog/exercise-ids';

const item = (exerciseId: string) => ({ exerciseId, equipment: 'none', sets: 2, target: { kind: 'reps', reps: 10 } });
const template = (items: ReturnType<typeof item>[]) => ({ id: 'template-a', name: 'A', estimatedMinutes: 30, items });

describe('assistant attachment preview', () => {
  it('shows only changed exercises and collapses unchanged items', () => {
    const original = template([item(EXERCISE_IDS.bodyweightSquat), item(EXERCISE_IDS.plank)]);
    const changed = template([item(EXERCISE_IDS.gobletSquat), item(EXERCISE_IDS.plank)]);
    const candidate = {
      request: { task: 'MODIFY_PLAN', plan: { weeklyTarget: 2, sessionMinutes: 30, templates: [original] } },
      response: {
        type: 'change_proposal',
        proposal: { goalText: '练力量', weeklyTarget: 2, sessionMinutes: 30, templates: [changed] },
      },
    } as unknown as CoachApplication;
    const html = renderToStaticMarkup(createElement(AssistantAttachment, { candidate, locale: 'zh' }));
    expect(html).toContain('data-change="replaced"');
    expect(html).toContain('其余 1 个动作不变');
    expect(html).not.toContain('调整前');
    const english = renderToStaticMarkup(createElement(AssistantAttachment, { candidate, locale: 'en' }));
    expect(english).toContain('Guide for the replacement exercise');
    expect(english).toContain('Goblet squat');
    expect(english).not.toContain('Original exercise reference targets');
  });
});
