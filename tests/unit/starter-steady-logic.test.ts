import { describe, expect, it } from 'vitest';
import {
  starterAvailable,
  starterComparison,
  starterProgress,
  starterTemplate,
} from '../../src/application/starter-program';
import { steadyLine, steadyTestLines, testItemsFor } from '../../src/ui/pages/plan-upgrade/logic';
import { steadyStarterCopy, steadyStarterSafetyKeys } from '../../src/i18n/features/coach/yaya-steady-starter';
import { checkCoachLanguage, checkSafetyLanguage } from '../../src/application/rules/coach-language';
import { legacyAgePopulation, toEngineProfile } from '../../src/application/engine-profile';
import { DATA } from '../../src/engine/data';
import type { SessionTemplate } from '../../src/domain/v8/contracts';

const program = { id: 'starter-4w' as const, startDate: '2026-11-02' };
const done = (localDate: string) => ({ localDate, status: 'complete' });

describe('新手 4 周 week table', () => {
  it('moves on after a week with a workout and repeats a missed week without catching up', () => {
    expect(starterProgress(program, [], '2026-11-01')).toMatchObject({ week: 1, missedLastWeek: false });
    expect(starterProgress(program, [done('2026-11-03')], '2026-11-08')).toMatchObject({ week: 1 });
    const two = starterProgress(program, [done('2026-11-03'), done('2026-11-05')], '2026-11-09');
    expect(two).toMatchObject({ week: 2, lastWeekSessions: 2, missedLastWeek: false, sessions: 2 });
    // Nothing in the second period: still week 2, said once, nothing owed.
    const missed = starterProgress(program, [done('2026-11-03')], '2026-11-17');
    expect(missed).toMatchObject({ week: 2, missedLastWeek: true, lastWeekSessions: 0 });
    const all = ['2026-11-03', '2026-11-10', '2026-11-17', '2026-11-24'].map(done);
    expect(starterProgress(program, all, '2026-11-30')).toMatchObject({ week: 5, finished: true, sessions: 4 });
    expect(starterProgress(program, [{ localDate: '2026-11-03', status: 'abandoned' }], '2026-11-09').week).toBe(1);
  });

  const template = (sets: number[]): SessionTemplate => ({
    id: 't',
    name: 'A',
    estimatedMinutes: 30,
    items: [
      ...sets.map((count, index) => ({
        exerciseId: `e${index}`,
        equipment: 'none',
        sets: count,
        target: { metricType: 'reps' as const, reps: 10 },
      })),
      {
        exerciseId: 'walk',
        equipment: 'none',
        sets: 1,
        target: { metricType: 'duration' as const, durationSeconds: 300 },
      },
    ],
  });
  const history = [done('2026-10-01')]; // engine new-user week 3+ by November

  it('adds one set in week 3 within the new-user cap and takes one off in week 4', () => {
    const base = template([2, 3]);
    expect(starterTemplate(base, { week: 1, finished: false }, history, '2026-11-20')).toBe(base);
    const third = starterTemplate(base, { week: 3, finished: false }, history, '2026-11-20');
    expect(third.items.map(item => item.sets)).toEqual([3, 3, 1]);
    const fourth = starterTemplate(template([1, 3]), { week: 4, finished: false }, history, '2026-11-20');
    expect(fourth.items.map(item => item.sets)).toEqual([1, 2, 1]);
    expect(starterTemplate(base, { week: 5, finished: true }, history, '2026-11-20')).toBe(base);
  });

  it('never goes past the cap of the engine week counted from the first workout', () => {
    const cap = DATA.rules.find(row => row.id === 'progression.new.week_caps')!.value!.week_2.sets_per_exercise;
    const third = starterTemplate(template([2]), { week: 3, finished: false }, [done('2026-11-10')], '2026-11-18');
    expect(third.items[0]!.sets).toBe(cap);
  });

  it('is offered on by-day plans without a running program only', () => {
    expect(starterAvailable({})).toBe(true);
    expect(starterAvailable({ weeklyBudget: { mode: 'by-day' } })).toBe(true);
    expect(starterAvailable({ weeklyBudget: { mode: 'budget' } })).toBe(false);
    expect(starterAvailable({ starterProgram: program })).toBe(false);
    expect(starterAvailable(undefined)).toBe(false);
  });

  it('compares the test before the start with the latest one, preferring an improved item', () => {
    const tests = [
      { localDate: '2026-10-30', createdAt: '2026-10-30T00:00:00.000Z', results: { pushup: 8, situp60s: 20 } },
      { localDate: '2026-11-28', createdAt: '2026-11-28T00:00:00.000Z', results: { pushup: 8, situp60s: 24 } },
    ];
    expect(starterComparison(tests, program.startDate)).toEqual({ item: 'situp60s', from: 20, to: 24 });
    expect(starterComparison(tests.slice(0, 1), program.startDate)).toBeUndefined();
  });
});

describe('稳健 route', () => {
  it('starts the older-adult module at 60 and keeps an explicit 稳健 choice below it', () => {
    expect(DATA.rules.find(row => row.id === 'older.activation')!.value!.trigger.any[0].gte).toBe(60);
    const older = { kind: 'older_adult' as const };
    expect(legacyAgePopulation(older, '1966-01', '2026-10-25')).toEqual(older);
    expect(legacyAgePopulation(older, '1970-01', '2026-10-25')).toEqual({ kind: 'general' });
  });

  it('keeps the opted-in older module in the engine profile', () => {
    const profile = {
      goalText: '腿有劲',
      weeklyTarget: 2,
      sessionMinutes: 30,
      scheduleOriginalText: '每周 2 次',
      place: 'home' as const,
      equipment: ['none'],
      adultConfirmed: true,
      cautions: [],
      confirmedAt: '2026-10-25T00:00:00.000Z',
      birthYearMonth: '1970-01',
      population: { kind: 'older_adult' as const },
      healthStorageConsent: { acceptedAt: '2026-10-25T00:00:00.000Z' },
      screening: {
        parqAllNo: true,
        knownCondition: false,
        symptoms: false,
        completedAt: '2026-10-25T00:00:00.000Z',
        parqAnswers: [false, false, false, false, false, false, false],
      },
    };
    const options = { asOfDate: '2026-10-25', history: [], notes: [] };
    expect(toEngineProfile({ ...profile, route: 'steady' }, options)?.population.kind).toBe('older_adult');
    expect(toEngineProfile(profile, options)?.population.kind).toBe('general');
  });

  it('swaps the eyes-closed stand for the chair-supported one at 60+ or on 稳健', () => {
    expect(testItemsFor(40)).toContain('singleLegStandEyesClosedS');
    expect(testItemsFor(40)).not.toContain('chairStand30s');
    for (const items of [testItemsFor(62), testItemsFor(40, true)]) {
      expect(items).toContain('chairStand30s');
      expect(items).toContain('singleLegStandChairS');
      expect(items).not.toContain('singleLegStandEyesClosedS');
    }
  });

  it('words chair stands against the last test and the chair stand against the first', () => {
    const tests = [
      { localDate: '2026-10-01', results: { chairStand30s: 10, singleLegStandChairS: 8 } },
      { localDate: '2026-10-15', results: { chairStand30s: 11 } },
      { localDate: '2026-10-29', results: { chairStand30s: 13, singleLegStandChairS: 15 } },
    ];
    expect(steadyTestLines(tests, 'zh')).toEqual([
      '30 秒站起来 13 次，比上次多 2 次 📈',
      '扶椅单脚站，从 8 秒到现在 15 秒了 📈',
    ]);
    expect(steadyTestLines(tests.slice(0, 1), 'en')).toEqual([]);
  });

  it('shows the week 4 and 12 milestones in that week only, and stage 8 only past stage 1', () => {
    const base = { planStart: '2026-10-01', trained: true, minutes: 25 };
    expect(steadyLine({ ...base, today: '2026-10-02' }, 'zh')).toBe('今天练腿力和平衡，大约 25 分钟 🌱');
    expect(steadyLine({ ...base, today: '2026-10-29' }, 'zh')).toBe(steadyStarterCopy.zh.steadyWeek4);
    expect(steadyLine({ ...base, today: '2026-10-29', trained: false }, 'en')).toBe(
      'Today: leg strength and balance, about 25 min 🌱',
    );
    expect(steadyLine({ ...base, today: '2026-11-26' }, 'zh')).toContain('今天练腿力');
    expect(steadyLine({ ...base, today: '2026-11-26', balanceStage: 2 }, 'zh')).toBe('8 周了，平衡练习升到第 2 阶 📈');
    expect(steadyLine({ ...base, today: '2026-12-24' }, 'zh')).toBe(steadyStarterCopy.zh.steadyWeek12);
  });

  it('keeps every line within the 芽芽 wording rules; safety lines carry no emoji', () => {
    for (const locale of ['zh', 'en'] as const) {
      const copy = steadyStarterCopy[locale];
      for (const [key, value] of Object.entries(copy))
        for (const text of [value].flat()) {
          expect(checkCoachLanguage(text), `${locale}.${key}`).toEqual([]);
          if ((steadyStarterSafetyKeys as readonly string[]).includes(key))
            expect(checkSafetyLanguage(text), `${locale}.${key}`).toEqual([]);
        }
      expect(copy.starterWeeks).toHaveLength(4);
    }
  });
});
