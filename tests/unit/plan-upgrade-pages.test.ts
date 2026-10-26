import { describe, expect, it } from 'vitest';
import { checkCoachLanguage, checkSafetyLanguage } from '../../src/application/rules/coach-language';
import { yayaSafetyKeys, yayaThemeTone, yayaV5, fillLine } from '../../src/i18n/features/coach/yaya-v5';
import { planPagesCopy } from '../../src/i18n/features/plan-upgrade/pages';
import { EVIDENCE } from '../../src/ui/pages/plan-upgrade/Evidence';
import {
  bodyChangeLine,
  bodyRoute,
  shownBodyChanges,
  spokenBefore,
  breathingCycles,
  breathingPhase,
  figureSex,
  figureShape,
  ghostWeight,
  localVoices,
  nowCoachLine,
  remindersUnused,
  returnLine,
  shownFocus,
  testItemsFor,
  usedMinutes,
  weekSetEntries,
  liftHistory,
  isTestItem,
  shiftLocalDate,
} from '../../src/ui/pages/plan-upgrade/logic';

const strings = (value: unknown): string[] =>
  typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];

describe('V9.14 copy', () => {
  it('every 芽芽 v5 line and page label passes the coach language check in both languages', () => {
    for (const text of [...strings(yayaV5), ...strings(yayaThemeTone), ...strings(planPagesCopy)])
      expect(checkCoachLanguage(text), text).toEqual([]);
  });
  it('safety, pain and low-mood lines carry no emoji', () => {
    for (const locale of ['zh', 'en'] as const)
      for (const key of yayaSafetyKeys) expect(checkSafetyLanguage(yayaV5[locale][key]), key).toEqual([]);
  });
  it('zh and en have the same keys', () => {
    expect(Object.keys(yayaV5.en).sort()).toEqual(Object.keys(yayaV5.zh).sort());
    expect(Object.keys(planPagesCopy.en).sort()).toEqual(Object.keys(planPagesCopy.zh).sort());
  });
  it('filled lines match v5 verbatim', () => {
    expect(fillLine(yayaV5.zh.strongerTest, { item: '俯卧撑', from: '8 个', to: '15 个' })).toBe(
      '俯卧撑从 8 个到 15 个，这可不是运气 📊',
    );
    expect(fillLine(yayaV5.zh.nowFill, { minutes: 15, group: '后背', sets: 4 })).toBe(
      '我算了一下，15 分钟刚好把后背这 4 组补上 🎯',
    );
  });
  it('never says how many days were missed', () => {
    for (const text of strings(yayaV5)) expect(text).not.toMatch(/\d+\s*天没练|days? (without|since)/);
  });
});

describe('V9.14 page logic', () => {
  it('figure sex follows the profile, else the last toggle, else male', () => {
    expect(figureSex('女性', 'male')).toBe('female');
    expect(figureSex('不愿透露', 'female')).toBe('female');
    expect(figureSex(undefined, undefined)).toBe('male');
    expect(figureShape({ heightCm: 170 }, 'male', 66)).toEqual({ sex: 'male', heightCm: 170, weightKg: 66 });
  });
  it('ghost weight is about a month before the latest record', () => {
    const rows = [
      { localDate: '2026-08-01', weightGrams: 75000 },
      { localDate: '2026-09-20', weightGrams: 72000 },
      { localDate: '2026-10-10', weightGrams: 71000 },
      { localDate: '2026-10-20', weightGrams: 70000 },
    ];
    expect(ghostWeight(rows)?.weightGrams).toBe(72000);
    expect(ghostWeight([{ localDate: '2026-10-20', weightGrams: 70000 }])).toBeUndefined();
  });
  const week = ['2026-10-19', '2026-10-20', '2026-10-21'];
  const workouts = [
    {
      localDate: '2026-10-19',
      status: 'complete',
      startedAt: '2026-10-19T10:00:00Z',
      endedAt: '2026-10-19T10:30:00Z',
      sets: [{ exerciseId: 'a' }, { exerciseId: 'a' }, { exerciseId: 'b' }],
    },
    { localDate: '2026-10-20', status: 'abandoned', startedAt: '2026-10-20T10:00:00Z', sets: [{ exerciseId: 'a' }] },
  ];
  it('counts this week’s finished sets and minutes', () => {
    expect(weekSetEntries(workouts, week)).toEqual([
      { exerciseId: 'a', completedSets: 2 },
      { exerciseId: 'b', completedSets: 1 },
    ]);
    expect(usedMinutes(workouts, week)).toBe(30);
  });
  it('welcome-back lines depend on the gap but never show it', () => {
    expect(returnLine(workouts, '2026-10-21')).toBeUndefined();
    expect(returnLine(workouts, '2026-10-27')).toBe('returnEasy');
    expect(returnLine(workouts, '2026-11-10')).toBe('returnHello');
    expect(returnLine([], '2026-11-10')).toBeUndefined();
  });
  it('home coach line follows v5 §4', () => {
    expect(nowCoachLine(5, 3, [], 'zh')).toBe('5 分钟也有用，我挑了 3 个最划算的动作 ⚡');
    expect(nowCoachLine(15, 4, [{ group: 'lats', sets: 6, level: 'low' }], 'zh')).toBe(
      '我算了一下，15 分钟刚好把背阔肌这 4 组补上 🎯',
    );
    expect(nowCoachLine(30, 4, [], 'zh')).toBe(yayaV5.zh.nowAsk);
  });
  it('home coach line only fills a gap this session trains, and never before any training', () => {
    const none = [{ group: 'lats', sets: 0, level: 'none' }] as const;
    expect(nowCoachLine(40, 4, none, 'zh', ['lats'])).toBe(yayaV5.zh.nowAsk);
    const low = [
      { group: 'traps', sets: 0, level: 'none' },
      { group: 'quads', sets: 3, level: 'low' },
    ] as const;
    expect(nowCoachLine(40, 4, low, 'zh', ['quads'])).toContain('股四头');
  });
  it('a tapped exercise card shows only its groups', () => {
    const focus = {
      primary: ['lats', 'calves'] as const,
      secondary: ['biceps'] as const,
      byExercise: { row: ['lats', 'biceps'] as const },
    };
    expect(shownFocus(focus as never, 'row')).toEqual({ primary: ['lats'], secondary: ['biceps'] });
    expect(shownFocus(focus as never, undefined).primary).toEqual(['lats', 'calves']);
  });
  it('chair stand only from 60', () => {
    expect(testItemsFor(45)).not.toContain('chairStand30s');
    expect(testItemsFor(62)).toContain('chairStand30s');
  });
  it('body-change lines: route from the goal, care replaces praise, today stays on screen', () => {
    expect(bodyRoute('想瘦下来，身体轻一点', undefined)).toBe('shape');
    expect(bodyRoute('想有些力量，不再容易累', undefined)).toBe('health');
    expect(bodyRoute('减脂', { kind: 'postpartum' })).toBe('postpartum');
    const stronger = { kind: 'stronger' as const, metric: 'x', delta: 5, sinceLocalDate: '2026-09-20' };
    const care = { kind: 'care-fast-loss' as const, metric: 'weightKg', delta: -1, sinceLocalDate: '2026-10-10' };
    expect(shownBodyChanges([stronger, care])).toEqual([care]);
    expect(shownBodyChanges([stronger])).toEqual([stronger]);
    expect(spokenBefore({ stronger: '2026-10-26', lighter: '2026-10-20' }, '2026-10-26')).toEqual({
      lighter: '2026-10-20',
    });
  });
  it('reminders ask to move or stop only when on and three in a row went unused', () => {
    const records = [1, 2, 3].map(shownAt => ({ kind: 'workout', status: 'dismissed', shownAt }));
    expect(remindersUnused(true, records)).toBe(true);
    expect(remindersUnused(false, records)).toBe(false);
    expect(remindersUnused(true, [...records, { kind: 'workout', status: 'opened', shownAt: 4 }])).toBe(false);
  });
  it('voice cues use on-device voices only', () => {
    expect(
      localVoices(
        [
          { localService: true, lang: 'zh-CN' },
          { localService: false, lang: 'zh-CN' },
          { localService: true, lang: 'en-US' },
        ],
        'zh',
      ),
    ).toEqual([{ localService: true, lang: 'zh-CN' }]);
  });
  it('breathing lasts 3–5 minutes', () => {
    expect(breathingCycles(1).totalSeconds).toBe(180);
    expect(breathingCycles(9).totalSeconds).toBe(300);
    expect([breathingPhase(0), breathingPhase(5)]).toEqual(['inhale', 'exhale']);
  });
  it('body-change lines: data lines from v5, care lines without emoji', () => {
    expect(
      bodyChangeLine({ kind: 'stronger', metric: 'squat', delta: 7.5, sinceLocalDate: '2026-09-21' }, 'zh', {
        metric: '深蹲',
      }),
    ).toBe('我看了下，深蹲比一个月前多了 7.5kg。你是真的变强了 💪');
    const care = bodyChangeLine(
      { kind: 'care-fast-loss', metric: 'weightKg', delta: -2, sinceLocalDate: '2026-10-14' },
      'zh',
      { metric: '' },
    )!;
    expect(checkSafetyLanguage(care)).toEqual([]);
  });
  it('lift history keeps weighted sets of finished workouts only', () => {
    const rows = liftHistory([
      {
        localDate: '2026-10-01',
        status: 'complete',
        startedAt: '',
        sets: [
          { exerciseId: 'squat', reps: 8, loadGrams: 45000 },
          { exerciseId: 'plank', reps: 0, loadGrams: null },
        ],
      },
      {
        localDate: '2026-10-02',
        status: 'abandoned',
        startedAt: '',
        sets: [{ exerciseId: 'squat', reps: 8, loadGrams: 50000 }],
      },
    ]);
    expect(rows).toEqual([{ exerciseId: 'squat', localDate: '2026-10-01', weightKg: 45, reps: 8 }]);
    expect(isTestItem('pushup')).toBe(true);
    expect(shiftLocalDate('2026-10-21', -28)).toBe('2026-09-23');
  });
  it('evidence notes are the fixed v5 §16 lines with their labels', () => {
    expect(yayaV5.zh[EVIDENCE.strength.key]).toBe('一周练两次力量，是世卫组织的推荐，证据很扎实 📊');
    expect(planPagesCopy.zh.evidence[EVIDENCE.fragment.level]).toBe('中等把握');
  });
});
