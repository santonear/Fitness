import { describe, expect, it } from 'vitest';
import type { PlanVersion, SessionTemplate, WorkoutRecord } from '../../src/domain/v8/contracts';
import type { MuscleLoad } from '../../src/domain/plan-upgrade';
import { DATA } from '../../src/engine/data';
import { exerciseMuscleGroups } from '../../src/application/rules/plan-upgrade';
import {
  fitTemplate,
  goalCheckDue,
  lastMissed,
  muscleTip,
  nextWeekTip,
  plannedDates,
  skipDayTip,
  yogaWeekLine,
} from '../../src/application/yaya-tips';
import { checkCoachLanguage, checkSafetyLanguage } from '../../src/application/rules/coach-language';
import { goalPhrase, yayaTipSafetyKeys, yayaTips } from '../../src/i18n/features/coach/yaya-tips';

const item = (exerciseId: string, sets = 3) => ({
  exerciseId,
  equipment: 'none',
  sets,
  target: { metricType: 'reps' as const, reps: 10 },
});
// Four items of 3 × 10 reps estimate at 30 minutes.
const template = (id: string, ids = ['a', 'b', 'c', 'd']): SessionTemplate => ({
  id,
  name: id,
  estimatedMinutes: 30,
  items: ids.map(x => item(x)),
});
const version: PlanVersion = {
  id: '10000000-0000-4000-8000-000000000001',
  planId: '10000000-0000-4000-8000-000000000002',
  versionNumber: 1,
  goalText: '想有些力量，不再容易累',
  weeklyTarget: 3,
  preferredDays: ['mon', 'wed', 'fri'],
  scheduleOriginalText: '',
  sessionMinutes: 30,
  startDate: '2026-09-01',
  templates: [template('A'), template('B'), template('C')],
  createdAt: '2026-09-01T08:00:00Z',
  origin: 'onboard',
  changeSummary: [],
};
const done = (localDate: string, patch: Partial<WorkoutRecord> = {}): WorkoutRecord => ({
  id: `w-${localDate}`,
  localDate,
  timeZone: 'UTC',
  status: 'complete',
  startedAt: `${localDate}T18:00:00Z`,
  endedAt: `${localDate}T18:30:00Z`,
  sets: [],
  plannedSetCount: 12,
  templateId: 'A',
  ...patch,
});
const today = '2026-10-26';
// Every planned Monday and Friday is trained; Wednesdays only when listed.
const week = (wednesdays: string[]) =>
  [
    '2026-09-28',
    '2026-10-02',
    '2026-10-05',
    '2026-10-09',
    '2026-10-12',
    '2026-10-16',
    '2026-10-19',
    '2026-10-23',
    ...wednesdays,
  ].map(date => done(date));

describe('shared plan edits', () => {
  it('fits a session to the minutes: sets first, then the last items, never in place', () => {
    const source = template('A');
    expect(fitTemplate(source, 20)).toMatchObject({ estimatedMinutes: 20, targetMinutes: 20 });
    expect(fitTemplate(source, 20)?.items.map(i => i.sets)).toEqual([2, 2, 2, 3]);
    const ten = fitTemplate(source, 10)!;
    expect([ten.estimatedMinutes, ten.targetMinutes, ten.items.length]).toEqual([10, 10, 1]);
    expect(source.items.map(i => i.sets)).toEqual([3, 3, 3, 3]);
    expect(fitTemplate({ ...source, estimatedMinutes: 10 }, 10)).toBeUndefined();
    expect(fitTemplate({ ...source, durationScope: 'untargeted' }, 10)).toBeUndefined();
  });
  it('reads planned dates from the version in use on each day, from the plan start', () => {
    const later: PlanVersion = {
      ...version,
      id: '10000000-0000-4000-8000-000000000003',
      versionNumber: 2,
      preferredDays: ['tue'],
      templates: [template('A')],
      createdAt: '2026-10-13T08:00:00Z',
    };
    expect(plannedDates([later, version], 'UTC', '2026-10-05', '2026-10-18')).toEqual([
      '2026-10-05',
      '2026-10-07',
      '2026-10-09',
      '2026-10-12',
      '2026-10-13',
    ]);
    expect(plannedDates([version], 'UTC', '2026-08-25', '2026-09-02')).toEqual(['2026-09-02']);
  });
  it('checks the last occurrences of a weekday', () => {
    const planned = ['2026-10-07', '2026-10-14', '2026-10-21'];
    expect(lastMissed(['2026-10-07'], planned, 3, 2)).toBe(true);
    expect(lastMissed(['2026-10-21'], planned, 3, 2)).toBe(false);
    expect(lastMissed([], planned, 3, 4)).toBe(false);
  });
});

describe('v5 §14 missed weekday on 今天', () => {
  const input = { version, versions: [version], timeZone: 'UTC', today };
  it('offers a 10-minute Wednesday after the last 3 Wednesdays were missed', () => {
    const tip = skipDayTip({ ...input, workouts: week(['2026-09-30']) })!;
    expect(tip.weekday).toBe('wed');
    const changed = tip.proposal.templates.find(t => t.id === 'B')!;
    expect([changed.estimatedMinutes, changed.targetMinutes]).toEqual([10, 10]);
    expect(tip.proposal.templates.find(t => t.id === 'A')).toEqual(version.templates[0]);
    expect(version.templates[1]!.items).toHaveLength(4);
    expect(tip.changes).toEqual([{ op: 'shorten', templateId: 'B', minutes: 10 }]);
  });
  it('stays quiet when the misses are not the last 3 in a row, or an activity filled the day', () => {
    expect(skipDayTip({ ...input, workouts: week(['2026-10-14']) })).toBeUndefined();
    expect(
      skipDayTip({ ...input, workouts: week(['2026-09-30']), activities: [{ localDate: '2026-10-21' }] }),
    ).toBeUndefined();
  });
  it('does not touch a session shared with another day or calendar-picked days', () => {
    const shared = { ...version, templates: [template('A')] };
    expect(
      skipDayTip({ ...input, version: shared, versions: [shared], workouts: week(['2026-09-30']) }),
    ).toBeUndefined();
    const picked = { ...version, trainingDates: ['2026-10-28'] };
    expect(skipDayTip({ ...input, version: picked, workouts: week(['2026-09-30']) })).toBeUndefined();
  });
});

describe('上周小结 · 下周怎么调', () => {
  const base = {
    from: '2026-10-19',
    to: '2026-10-25',
    target: 3,
    today,
    timeZone: 'UTC',
    version,
    versions: [version],
    followedUpWorkoutIds: [],
    planFirstStart: '2026-09-01',
    weekdayAskedThisWeek: false,
  };
  const full = [...week(['2026-10-14']), done('2026-10-21')];
  it('1. pain without a follow-up comes first and changes nothing', () => {
    const sore = done('2026-10-21', {
      setFeedbackEvents: [
        {
          id: 'e',
          itemIndex: 0,
          setIndex: 0,
          exerciseId: 'a',
          createdAt: '2026-10-21T18:10:00Z',
          effort: 'discomfort',
          painScore: 3,
          painArea: 'knee',
        },
      ],
    });
    const workouts = [...week(['2026-10-14']), sore];
    expect(nextWeekTip({ ...base, done: 3, workouts })).toEqual({ kind: 'pain', areas: ['knee'], exerciseIds: ['a'] });
    expect(nextWeekTip({ ...base, done: 3, workouts, followedUpWorkoutIds: [sore.id] })?.kind).toBe('on-track');
  });
  it('2. nothing last week: one 20-minute session a week', () => {
    const tip = nextWeekTip({ ...base, done: 0, workouts: [] });
    expect(tip?.kind).toBe('zero');
    if (tip?.kind !== 'zero') return;
    expect(tip.proposal.weeklyTarget).toBe(1);
    expect(tip.proposal.templates.every(t => t.estimatedMinutes === 20)).toBe(true);
  });
  it('3. the one missed weekday, also missed the week before; not repeated after 今天 asked', () => {
    const workouts = week(['2026-10-07']);
    const tip = nextWeekTip({ ...base, done: 2, workouts });
    expect(tip?.kind === 'weekday' && [tip.weekday, tip.minutes]).toEqual(['wed', 20]);
    expect(nextWeekTip({ ...base, done: 2, workouts, weekdayAskedThisWeek: true })).toBeUndefined();
  });
  it('4. sessions 10 minutes or more under plan: next week at actual + 5', () => {
    const workouts = full.map(w => ({ ...w, endedAt: `${w.localDate}T18:15:00Z` }));
    const tip = nextWeekTip({ ...base, done: 3, workouts });
    expect(tip?.kind === 'short' && [tip.actual, tip.gap, tip.minutes]).toEqual([15, 15, 20]);
  });
  it('5. more than planned after the first two weeks: one more a week', () => {
    const workouts = [...full, done('2026-10-24')];
    expect(nextWeekTip({ ...base, done: 4, workouts })).toMatchObject({ kind: 'overdone', extra: 1, next: 4 });
    expect(nextWeekTip({ ...base, done: 4, workouts, planFirstStart: '2026-10-12' })).toBeUndefined();
  });
  it('6. right on target', () => {
    expect(nextWeekTip({ ...base, done: 3, workouts: full })).toEqual({ kind: 'on-track' });
  });
});

describe('v5 §8 muscle-map tips', () => {
  const row = DATA.exercises.find(
    e => e.primary_pattern === 'pull_horizontal' && !e.review && exerciseMuscleGroups(e.id).primary.length,
  )!;
  const push = DATA.exercises.find(e => e.slug === 'archer-push-ups')!;
  const group = exerciseMuscleGroups(row.id).primary[0]!;
  const plan: PlanVersion = {
    ...version,
    templates: [
      { ...template('A', [push.id]), estimatedMinutes: 15 },
      { ...template('B', [row.id]), estimatedMinutes: 15 },
    ],
  };
  const loads = (patch: Partial<Record<MuscleLoad['group'], number>>): MuscleLoad[] =>
    (['chest', 'triceps', 'quads', 'glutes', 'abs', group] as const).map(g => ({
      group: g,
      sets: patch[g] ?? 12,
      level: 'ok',
    }));
  it('fills a short group in today’s session, borrowing a plan exercise when needed', () => {
    const tip = muscleTip({ version: plan, templateId: 'A', weekLoads: loads({ [group]: 6 }), weekSets: [] });
    expect(tip?.kind === 'gap' && [tip.group, tip.sets]).toEqual([group, 4]);
    expect(tip?.template.items.at(-1)).toMatchObject({ exerciseId: row.id, sets: 4 });
    expect(plan.templates[0]!.items).toHaveLength(1);
    expect(tip?.changes).toContainEqual({ op: 'add', templateId: 'A', exerciseId: row.id });
    expect(tip?.changes).toContainEqual({ op: 'set_volume', templateId: 'A', exerciseId: row.id, sets: 4 });
  });
  it('a well-rounded week only: fewer than 4 trained groups says nothing', () => {
    const few = loads({ [group]: 6 }).map((load, index) => (index < 3 ? { ...load, sets: 0 } : load));
    expect(muscleTip({ version: plan, templateId: 'A', weekLoads: few, weekSets: [] })).toBeUndefined();
  });
  it('more push than pull adds one set of rows', () => {
    const tip = muscleTip({
      version: plan,
      templateId: 'B',
      weekLoads: loads({}),
      weekSets: [{ exerciseId: push.id, completedSets: 6 }],
    });
    expect(tip?.kind).toBe('push-pull');
    expect(tip?.template.items[0]?.sets).toBe(4);
    expect(tip?.changes).toEqual([{ op: 'set_volume', templateId: 'B', itemIndex: 0, sets: 4 }]);
    expect(muscleTip({ version: plan, templateId: 'B', weekLoads: loads({}), weekSets: [] })).toBeUndefined();
  });
});

describe('approved wording and the monthly goal check', () => {
  const strings = (value: unknown): string[] =>
    typeof value === 'string'
      ? [value]
      : value && typeof value === 'object'
        ? Object.values(value).flatMap(strings)
        : [];
  it('every line passes the coach language check; the pain line has no emoji', () => {
    for (const text of strings(yayaTips)) expect(checkCoachLanguage(text), text).toEqual([]);
    for (const locale of ['zh', 'en'] as const)
      for (const key of yayaTipSafetyKeys) expect(checkSafetyLanguage(yayaTips[locale][key]), key).toEqual([]);
    expect(Object.keys(yayaTips.en).sort()).toEqual(Object.keys(yayaTips.zh).sort());
  });
  it('asks 30 days after the plan start or the last ask', () => {
    expect(goalCheckDue('2026-09-26', undefined, today)).toBe(true);
    expect(goalCheckDue('2026-09-27', undefined, today)).toBe(false);
    expect(goalCheckDue('2026-08-01', '2026-10-01', today)).toBe(false);
    expect(goalCheckDue(undefined, undefined, today)).toBe(false);
  });
  it('fits the goal into the sentence', () => {
    expect(goalPhrase('想瘦下来，身体轻一点', 'zh')).toBe('瘦下来，身体轻一点');
    expect(goalPhrase('I’d like more strength and energy', 'en')).toBe('more strength and energy');
    expect(goalPhrase('x'.repeat(45), 'zh', false)).toHaveLength(41);
  });
});

describe("回顾: the week's yoga", () => {
  const stages = ['center', 'warm', 'sun', 'stand', 'balance', 'twist', 'hip', 'rest'];
  const yoga: SessionTemplate = {
    id: 'Y',
    name: 'Y',
    estimatedMinutes: 45,
    items: stages.map(stage => ({
      ...item(`pose-${stage}`, 1),
      prescription: { sourcePosition: `yoga_${stage}_1` } as SessionTemplate['items'][number]['prescription'],
    })),
  };
  const sets = (count: number) =>
    Array.from({ length: count }, (_, itemIndex) => ({ itemIndex })) as unknown as WorkoutRecord['sets'];
  it('counts yoga sessions and minutes, and says where a half-done one could end', () => {
    const rows = [
      done('2026-10-19', { templateSnapshot: yoga, sets: sets(8) }),
      done('2026-10-21', { templateSnapshot: yoga, status: 'partial', sets: sets(6) }),
      done('2026-10-23', { templateSnapshot: yoga, sets: sets(8) }),
      done('2026-10-24'),
    ];
    expect(yogaWeekLine(rows, '2026-10-19', '2026-10-25', 'zh')).toBe(
      '这周练了 3 次瑜伽，共 90 分钟。节奏在慢慢稳下来。第 2 次后半段没练上，下次可以练到扭转就收尾。',
    );
  });
  it('says nothing about stopping when a session ended early in its first half, and nothing without yoga', () => {
    const rows = [done('2026-10-21', { templateSnapshot: yoga, status: 'partial', sets: sets(2) })];
    expect(yogaWeekLine(rows, '2026-10-19', '2026-10-25', 'zh')).toBe('这周练了 1 次瑜伽，共 30 分钟。');
    expect(yogaWeekLine([done('2026-10-21')], '2026-10-19', '2026-10-25', 'zh')).toBeUndefined();
  });
});
