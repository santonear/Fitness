import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import { SettingsPage } from '../../src/ui/pages/settings/SettingsPage';
import { EngineProfileEditor } from '../../src/ui/pages/settings/EngineProfileEditor';
import { TrainingCheckinFields } from '../../src/ui/pages/training/PreTrainingCheckin';
import { engineCopy, engineCopyList } from '../../src/coach/engine-copy';
import { baseProfile } from '../../tools/eval/training-engine-profiles';
import { EXERCISE_IDS } from '../../src/catalog/exercise-ids';
import type { WorkoutRecord } from '../../src/domain/v8/contracts';
const context = vi.hoisted(() => ({
  enabled: true,
  locale: 'zh' as 'zh' | 'en',
  data: undefined as unknown,
}));
vi.mock('../../src/i18n', () => ({ default: { changeLanguage: vi.fn() } }));
vi.mock('react-router-dom', () => ({ useLocation: () => ({ hash: '' }) }));
vi.mock('../../src/ui/useFeature', () => ({
  useFeature: (name: string) => name === 'trainingEngine' && context.enabled,
}));
vi.mock('../../src/ui/mainline/context', () => ({
  workflow: {},
  useMainline: () => ({
    locale: context.locale,
    data: context.data,
    t: { settings: '设置' },
    navigate: vi.fn(),
    run: vi.fn(),
    busy: false,
    restartPlanning: vi.fn(),
    appearance: { theme: 'pop', change: vi.fn() },
  }),
}));
vi.mock('../../src/ui/components/AccessStatusCard', () => ({
  AccessStatusCard: () => null,
}));
vi.mock('../../src/ui/pages/settings/SystemNotifications', () => ({
  SystemNotifications: () => null,
}));
beforeEach(() => {
  context.enabled = true;
  context.locale = 'zh';
  context.data = undefined;
});
const closed: WorkoutRecord = {
  id: 'closed-training',
  templateId: 'training',
  startedAt: '2026-10-14T00:00:00Z',
  endedAt: '2026-10-14T01:00:00Z',
  localDate: '2026-10-14',
  timeZone: 'UTC',
  status: 'complete',
  plannedSetCount: 1,
  sets: [
    {
      exerciseId: EXERCISE_IDS.bodyweightSquat,
      itemIndex: 0,
      setIndex: 0,
      reps: 8,
      completedAt: '2026-10-14T00:01:00Z',
    },
  ],
};
const checkin = (workouts: WorkoutRecord[] = [], answers = {}) =>
  renderToStaticMarkup(
    createElement(TrainingCheckinFields, {
      answers,
      workouts,
      locale: 'zh',
      disabled: false,
      onChange: () => {},
    }),
  );
it.each(['zh', 'en'] as const)(
  'keeps screening settings discoverable when enabled or existing health facts remain (%s)',
  locale => {
    context.locale = locale;
    const label = locale === 'zh' ? '运动前自查与训练偏好' : 'Screening and training preferences';
    expect(renderToStaticMarkup(createElement(SettingsPage))).toContain(label);
    context.enabled = false;
    expect(renderToStaticMarkup(createElement(SettingsPage))).not.toContain(label);
    context.data = {
      state: {
        coachProfile: { healthStorageConsent: { acceptedAt: '2026-10-01' } },
      },
    };
    expect(renderToStaticMarkup(createElement(SettingsPage))).toContain(label);
  },
);
it.each(['zh', 'en'] as const)(
  'keeps all relative pregnancy questions with verification suffixes removed at the source (%s)',
  locale => {
    const p = baseProfile({
        population: {
          kind: 'pregnant',
          week: 12,
          providerCleared: true,
          prenatalCareConfirmed: true,
          contraindicationsConfirmedNone: true,
          lastScreenedWeek: 12,
        },
      }),
      html = renderToStaticMarkup(
        createElement(EngineProfileEditor, {
          value: {
            ...p,
            healthStorageConsent: { acceptedAt: p.screening.completedAt! },
          },
          locale,
          onChange: () => {},
        }),
      );
    const source = engineCopyList('pregnancy.gate.copy.relative_list', locale),
      marked = source.filter(row => /待核实|to verify/.test(row.text));
    expect(marked).toHaveLength(0);
    expect(source).toHaveLength(13);
    expect(html).not.toMatch(/待核实|to verify/);
    for (const row of source)
      expect(html).toContain(
        renderToStaticMarkup(
          createElement('span', null, row.text.replace(/\s*(?:（待核实）|\(to verify\))/g, '')),
        ).replace(/^<span>|<\/span>$/g, ''),
      );
    expect(engineCopyList('pregnancy.gate.copy.relative_list', locale)).toEqual(source);
  },
);
it('keeps older screening age-derived while the pregnancy selector contains only pregnancy states', () => {
  const value = {
      healthStorageConsent: { acceptedAt: '2026-10-01' },
      population: { kind: 'general' as const },
    },
    render = (ageYears: number) =>
      renderToStaticMarkup(
        createElement(EngineProfileEditor, {
          value,
          ageYears,
          locale: 'zh',
          onChange: () => {},
        }),
      );
  expect(render(59)).not.toContain(engineCopy('older.screen.copy.intro', 'zh'));
  expect(render(60)).toContain(engineCopy('older.screen.copy.intro', 'zh'));
  const persisted = renderToStaticMarkup(
    createElement(EngineProfileEditor, {
      value: {
        ...value,
        population: {
          kind: 'older_adult',
          fallsAnswers: [false, false, false, false],
        },
      },
      ageYears: 65,
      locale: 'zh',
      onChange: () => {},
    }),
  );
  expect(persisted).not.toContain('<option value="older_adult"');
  expect(persisted).toContain('<option value="general" selected=""');
  expect(persisted).toContain(engineCopy('older.screen.copy.intro', 'zh'));
});
it('asks only current safety and energy questions before a first real completed training', () => {
  for (const workouts of [
    [],
    [{ ...closed, status: 'in_progress' as const, endedAt: undefined }],
    [{ ...closed, status: 'not_started' as const, sets: [] }],
  ]) {
    const html = checkin(workouts);
    expect(html).toContain(engineCopy('deload.copy.checkin.0', 'zh'));
    expect(html).toContain(engineCopy('deload.copy.checkin.3', 'zh'));
    for (const key of ['deload.copy.checkin.1', 'deload.copy.checkin.2'])
      expect(html).not.toContain(engineCopy(key, 'zh'));
    expect(html).not.toContain('上次的疼痛');
    expect(html).not.toContain('疼痛或僵硬是否比上周更重');
    expect(html).not.toContain('value="false" selected');
  }
  const currentPain = checkin([], { newOrWorseJointPain: true });
  expect(currentPain).toContain(engineCopy('pain.copy.stop_exercise', 'zh'));
  expect(currentPain).toContain('哪里不舒服？');
});
it.each(['complete', 'partial'] as const)(
  'preserves unanswered previous-training questions with real %s history',
  status => {
    const html = checkin([{ ...closed, status }]);
    expect(html).toContain('上次的疼痛');
    expect(html).toContain(engineCopy('deload.copy.checkin.1', 'zh'));
    expect(html).toContain(engineCopy('deload.copy.checkin.2', 'zh'));
    expect(html).not.toContain('value="false" selected');
  },
);
