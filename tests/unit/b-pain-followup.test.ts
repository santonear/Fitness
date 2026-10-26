vi.mock('../../src/ui/mainline/context', () => ({ useMainline: () => ({}), workflow: {} }));
import { it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { derivePainFollowup, painPromptAreas } from '../../src/application/pain-followup';
import { Rules } from '../../src/engine/data';
import type { WorkoutRecord } from '../../src/domain/v8/contracts';
import { SetFeedback } from '../../src/ui/pages/training/SetFeedback';
import { PainFollowupFields } from '../../src/ui/pages/training/PreTrainingCheckin';
const r = new Rules(),
  e = r.data.exercises.find(e => e.slug === 'bodyweight-squat')!,
  day = '2026-10-14';
const history: WorkoutRecord[] = [
  {
    id: 'real',
    startedAt: day + 'T00:00:00Z',
    endedAt: day + 'T01:00:00Z',
    localDate: day,
    timeZone: 'UTC',
    status: 'complete',
    plannedSetCount: 1,
    sets: [{ exerciseId: e.id, itemIndex: 0, setIndex: 0, reps: 8, completedAt: day + 'T00:30:00Z' }],
  },
];
const link = { workoutId: 'real', itemIndex: 0, painArea: 'knee' as const };
it('unknown and explicit negative follow-up answers never invent pain or adjustments', () => {
  expect(derivePainFollowup({}, history, r)).toBeUndefined();
  expect(
    derivePainFollowup({ painLastedToNextMorning: false, painOrStiffnessWorseThanLastWeek: false }, history, r),
  ).toBeUndefined();
});
it.each(['painLastedToNextMorning', 'painOrStiffnessWorseThanLastWeek'] as const)(
  'source %s independently resolves an actual performed pattern without a numeric pain score',
  key => {
    const before = structuredClone(history),
      out = derivePainFollowup({ [key]: true, painFollowup: link }, history, r);
    expect(out).toEqual({
      pattern: e.primary_pattern,
      sourceWorkoutId: 'real',
      cautionLevelDelta: r.get('pain.rule').bands.find((b: { action: string }) => b.action === 'drop_pattern')
        .caution_level_delta,
    });
    expect(history).toEqual(before);
  },
);
it('positive answers cannot guess missing, unperformed or unrelated joint links', () => {
  for (const painFollowup of [
    undefined,
    { ...link, workoutId: 'fake' },
    { ...link, itemIndex: 10 },
    { ...link, painArea: 'wrist' as const },
  ])
    expect(() => derivePainFollowup({ painLastedToNextMorning: true, painFollowup }, history, r)).toThrow(
      'PAIN_REVIEW_REQUIRED',
    );
});
it('every-set attention opens existing score and area controls without selecting discomfort or defaulting a score', () => {
  const props = {
    fact: history[0].sets[0],
    events: [],
    locale: 'zh' as const,
    busy: false,
    painAllowed: true,
    onAppend: () => {},
  };
  const plain = renderToStaticMarkup(createElement(SetFeedback, props)),
    prompted = renderToStaticMarkup(createElement(SetFeedback, { ...props, promptPainAreas: ['knee'] }));
  expect(plain).not.toContain('哪里不舒服？');
  expect(prompted).toContain('哪里不舒服？');
  expect(prompted).toContain('aria-label="右膝"');
  expect(prompted).not.toContain('aria-pressed="true"');
});
it('follow-up asks which training only after a lasting or worse pain kind, with no default', () => {
  const render = (answers: object) =>
    renderToStaticMarkup(
      createElement(PainFollowupFields, { answers, onChange: () => {}, locale: 'zh', workouts: history }),
    );
  expect(render({})).toBe('');
  expect(render({ painLastedToNextMorning: true })).toContain('value="" selected=""');
});

it('each-set prompt requires a real attention area and source joint load, never just the exercise name', () => {
  expect(painPromptAreas(e.id, ['knee'], r)).toEqual(['knee']);
  expect(painPromptAreas(e.id, ['wrist'], r)).toEqual([]);
  expect(painPromptAreas(e.id, [], r)).toEqual([]);
  expect(painPromptAreas('unknown', ['knee'], r)).toEqual([]);
});
