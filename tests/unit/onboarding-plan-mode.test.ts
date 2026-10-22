import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HealthCheckWizard } from '../../src/ui/pages/onboarding/HealthCheckWizard';
import type { OnboardingAnswers } from '../../src/ui/pages/onboarding/OnboardingPage';
import { planModeCopy } from '../../src/i18n/features/onboarding/plan-mode';
import { checkCoachLanguage } from '../../src/application/rules/coach-language';
import { startDateCopy } from '../../src/i18n/features/plan/start-date';
import { exerciseToolsCopy } from '../../src/i18n/features/plan/exercise-tools';
import { themeEntryCopy } from '../../src/i18n/features/home/theme';
import { chatCopy } from '../../src/i18n/features/coach/chat';

const answers: OnboardingAnswers = {
  goalText: '想有些力量',
  scheduleOriginalText: '每周 3 次，每次 45 分钟',
  placeEquipmentText: '在家',
  adultConfirmed: true,
  cautions: [],
  safetyAnswered: true,
};
const render = (props: Partial<Parameters<typeof HealthCheckWizard>[0]>) =>
  renderToStaticMarkup(
    createElement(HealthCheckWizard, {
      locale: 'zh',
      answers,
      engineEnabled: false,
      bodyEnabled: false,
      mode: 'basic',
      busy: false,
      step: 4,
      total: 4,
      complete: true,
      sendFields: [],
      onChange: () => {},
      onExit: () => {},
      onGenerate: () => {},
      onManual: () => {},
      ...props,
    }),
  );

describe('onboarding AI-or-local and the ready screen', () => {
  it('asks AI or local only when AI exists in this deployment, honestly describing both', () => {
    const html = render({ aiAvailable: true, initialScreen: 'planMode' });
    const t = planModeCopy.zh;
    for (const text of [t.title, t.ai, t.aiDescription, t.local, t.localDescription]) expect(html).toContain(text);
    expect(render({ initialScreen: 'planMode' })).not.toContain(t.title);
  });
  it('never shows a grey 生成计划 without saying what is missing and how to fix it', () => {
    const html = render({
      complete: false,
      answers: { ...answers, adultConfirmed: false, scheduleOriginalText: '' },
      missingOuter: [{ key: 'schedule', step: 1 }],
      initialScreen: 'ready',
    });
    expect(html).toContain(planModeCopy.zh.missingTitle);
    expect(html).toContain(planModeCopy.zh.missing.schedule);
    expect(html).toContain(planModeCopy.zh.missing.adult);
    expect(html).toContain(planModeCopy.zh.fix);
    expect(render({ initialScreen: 'ready' })).not.toContain(planModeCopy.zh.missingTitle);
  });
  it('keeps 芽芽 copy within the voice rules', () => {
    const strings = (value: unknown): string[] =>
      typeof value === 'string'
        ? [value]
        : value && typeof value === 'object'
          ? Object.values(value).flatMap(strings)
          : [];
    for (const copy of [planModeCopy, startDateCopy, exerciseToolsCopy, themeEntryCopy, chatCopy])
      for (const text of strings(copy)) expect(checkCoachLanguage(text), text).toEqual([]);
  });
});
