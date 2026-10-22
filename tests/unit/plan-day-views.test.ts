import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DATABASE_VERSION, BACKUP_VERSION } from '../../src/domain/storage-version';
import { createV8Workflow } from '../../src/application/v8-workflow';
import { createRepository } from '../../src/persistence/repository';
import type { FitnessDatabase } from '../../src/persistence/db';
import { v8WorkoutSchema } from '../../src/domain/schemas';
import type { PlanVersion, SessionTemplate, WorkoutRecord } from '../../src/domain/v8/contracts';
import {
  monthCalendar,
  monthCounts,
  monthGridDates,
  shiftMonth,
  weekDoneDays,
} from '../../src/application/plan-calendar';
import {
  clockIn,
  defaultStartClock,
  itemActualTimes,
  sessionTimeline,
  stepClock,
  workoutTimes,
  zonedInstant,
} from '../../src/application/day-timeline';
import { checkCoachLanguage } from '../../src/application/rules/coach-language';
import { planCalendarCopy } from '../../src/i18n/features/plan/calendar';
import { dayViewCopy } from '../../src/i18n/features/home/day-view';

/** In-memory tables over the real v8.0.7 mainline backup sample (same pattern as plan-start-date.test.ts). */
function setup() {
  const source = JSON.parse(
    readFileSync(new URL('../fixtures/legacy-backups/v807-mainline.json', import.meta.url), 'utf8'),
  );
  source.schemaVersion = BACKUP_VERSION;
  source.data.metadata.schemaVersion = DATABASE_VERSION;
  let rows: Record<string, any[]> = {};
  for (const [key, value] of Object.entries(source.data)) if (Array.isArray(value)) rows[key] = structuredClone(value);
  rows.metadata = [source.data.metadata];
  for (const key of ['plans', 'planVersions', 'workouts', 'activities', 'planReferences'])
    rows['v8' + key[0].toUpperCase() + key.slice(1)] = structuredClone(source.data.v8[key] ?? []);
  rows.v8State = [source.data.v8.state];
  const key = (r: any) => r.id ?? r.localProfileId ?? r.schemaVersion;
  const table = (name: string) => ({
    name,
    toArray: async () => structuredClone(rows[name]),
    get: async (id: string) => structuredClone(rows[name].find(r => key(r) === id)),
    put: async (v: any) => {
      rows[name] = rows[name].filter(r => key(r) !== key(v));
      rows[name].push(structuredClone(v));
    },
    add: async (v: any) => {
      rows[name].push(structuredClone(v));
    },
    toCollection: () => ({ first: async () => structuredClone(rows[name][0]) }),
    where: (field: string) => ({
      equals: (value: string) => ({
        toArray: async () => structuredClone(rows[name].filter(r => r[field] === value)),
        count: async () => rows[name].filter(r => r[field] === value).length,
      }),
    }),
  });
  const db: any = {
    tables: [],
    transaction: async (_m: unknown, _t: unknown, fn: () => Promise<unknown>) => {
      const before = structuredClone(rows);
      try {
        return await fn();
      } catch (e) {
        rows = before;
        throw e;
      }
    },
  };
  for (const name of Object.keys(rows)) {
    db[name] = table(name);
    db.tables.push(db[name]);
  }
  return {
    workflow: createV8Workflow(createRepository(db as FitnessDatabase)),
    rows: () => rows,
    revision: () => rows.metadata[0].dataRevision as number,
  };
}

const item = (
  exerciseId: string,
  block: 'warmup' | 'main' | 'cooldown' | undefined,
  sets: number,
  target: SessionTemplate['items'][number]['target'],
  restSeconds = 60,
) => ({
  exerciseId,
  equipment: 'none',
  sets,
  target,
  ...(block ? { prescription: { pattern: 'squat', block, rir: [2, 3], restSeconds } as never } : {}),
});
const plan = (templates: SessionTemplate[], preferredDays: PlanVersion['preferredDays'] = ['mon', 'wed', 'fri']) => ({
  weeklyTarget: preferredDays!.length,
  preferredDays,
  templates,
});
const template = (id: string, items: SessionTemplate['items'], estimatedMinutes = 30): SessionTemplate => ({
  id,
  name: '训练',
  estimatedMinutes,
  items,
});
const workout = (
  localDate: string,
  status: WorkoutRecord['status'],
  extra: Partial<WorkoutRecord> = {},
): WorkoutRecord => ({
  id: crypto.randomUUID(),
  startedAt: `${localDate}T01:00:00.000Z`,
  endedAt: `${localDate}T01:40:00.000Z`,
  localDate,
  timeZone: 'Asia/Shanghai',
  status,
  sets: [],
  plannedSetCount: 6,
  ...extra,
});

describe('计划 › 月 calendar', () => {
  it('covers whole Monday-first weeks of the month', () => {
    const dates = monthGridDates('2026-10');
    expect(dates[0]).toBe('2026-09-28');
    expect(dates.at(-1)).toBe('2026-11-01');
    expect(dates.length % 7).toBe(0);
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(() => monthGridDates('2026-13')).toThrow();
  });
  it('marks done / partial from records, planned from the schedule, missed before today, nothing before the start date', () => {
    const a = template('a', [item('x', undefined, 3, { metricType: 'reps', reps: 10 })]);
    const days = monthCalendar({
      plan: plan([a]),
      month: '2026-10',
      today: '2026-10-14',
      startDate: '2026-10-05',
      workouts: [
        workout('2026-10-05', 'complete'),
        workout('2026-10-07', 'partial'),
        workout('2026-10-08', 'abandoned'),
        workout('2026-10-10', 'complete'),
      ],
    });
    const state = (date: string) => days.find(day => day.date === date)!.state;
    expect(state('2026-10-02')).toBe('rest'); // Friday before the start
    expect(state('2026-10-05')).toBe('done');
    expect(state('2026-10-07')).toBe('partial');
    expect(state('2026-10-09')).toBe('missed'); // planned Friday, no record
    expect(state('2026-10-10')).toBe('done'); // unplanned Saturday still shows what was trained
    expect(state('2026-10-14')).toBe('planned'); // today, not yet trained
    expect(state('2026-10-16')).toBe('planned');
    expect(state('2026-10-08')).toBe('rest'); // abandoned is not a training record
    expect(days.find(day => day.date === '2026-10-16')!.templateId).toBe('a');
    expect(monthCounts(days)).toEqual({ done: 2, partial: 1, planned: 8, missed: 2 }); // Fri 9, Mon 12
  });
  it('week marks follow the Monday week of today', () => {
    expect(
      weekDoneDays(
        [
          workout('2026-10-12', 'partial'),
          workout('2026-10-12', 'complete'),
          workout('2026-10-14', 'partial'),
          workout('2026-10-05', 'complete'),
        ],
        '2026-10-15',
      ),
    ).toEqual({ mon: 'done', wed: 'partial' });
  });
});

describe('今天 › 日视图 timeline', () => {
  const warm = item('w', 'warmup', 1, { metricType: 'duration', durationSeconds: 300 }, 0);
  const squat = item('s', 'main', 3, { metricType: 'reps_load', reps: 8, loadGrams: 10000 }, 90);
  const plank = item('p', 'main', 2, { metricType: 'duration', durationSeconds: 30 }, 60);
  const cool = item('c', 'cooldown', 1, { metricType: 'duration', durationSeconds: 240 }, 0);
  it('keeps the session order, numbers the steps and fits the estimated length', () => {
    const timeline = sessionTimeline(template('t', [warm, squat, plank, cool], 25));
    expect(timeline.steps.map(step => [step.number, step.kind, step.itemIndex, step.phase])).toEqual([
      [1, 'item', 0, 'warmup'],
      [2, 'item', 1, 'main'],
      [3, 'item', 2, 'main'],
      [4, 'item', 3, 'cooldown'],
    ]);
    expect(Math.abs(timeline.totalSeconds - 25 * 60)).toBeLessThanOrEqual(4);
    for (let index = 1; index < timeline.steps.length; index++)
      expect(timeline.steps[index].startOffset).toBeGreaterThanOrEqual(
        timeline.steps[index - 1].startOffset + timeline.steps[index - 1].durationSeconds,
      );
  });
  it('adds light prepare / stretch steps only from time the estimate leaves free', () => {
    const basic = sessionTimeline(
      template(
        'b',
        [
          item('x', undefined, 3, { metricType: 'reps', reps: 10 }),
          item('y', undefined, 3, { metricType: 'reps', reps: 10 }),
        ],
        20,
      ),
    );
    expect(basic.steps[0]).toMatchObject({ kind: 'prepare', number: 1, phase: 'warmup' });
    expect(basic.steps.at(-1)).toMatchObject({ kind: 'stretch', phase: 'cooldown' });
    expect(basic.steps.filter(step => step.kind === 'item').map(step => step.number)).toEqual([2, 3]);
    // No free time: no framing steps are invented.
    const tight = sessionTimeline(
      template('c', [item('x', undefined, 6, { metricType: 'duration', durationSeconds: 300 })], 15),
    );
    expect(tight.steps.map(step => step.kind)).toEqual(['item']);
  });
  it('turns a planned start into clock times, wrapping past midnight', () => {
    expect(stepClock('18:30', 0)).toBe('18:30');
    expect(stepClock('18:30', 25 * 60)).toBe('18:55');
    expect(stepClock('23:50', 20 * 60)).toBe('00:10');
    expect(defaultStartClock('Asia/Shanghai', new Date('2026-10-19T10:02:00Z'))).toBe('18:05');
    expect(defaultStartClock('Asia/Shanghai', new Date('2026-10-19T10:05:00Z'))).toBe('18:05');
  });
  it('converts a wall-clock time in a zone to UTC and back', () => {
    expect(zonedInstant('2026-10-19', '07:30', 'Asia/Shanghai')).toBe('2026-10-18T23:30:00.000Z');
    expect(zonedInstant('2026-07-01', '09:00', 'America/New_York')).toBe('2026-07-01T13:00:00.000Z');
    expect(clockIn('Asia/Shanghai', '2026-10-18T23:30:00.000Z')).toBe('07:30');
  });
  it('actual times come from the record; the latest correction wins for display only', () => {
    const record = workout('2026-10-19', 'complete', {
      sets: [
        { exerciseId: 's', itemIndex: 1, setIndex: 0, reps: 8, completedAt: '2026-10-19T01:10:00.000Z' },
        { exerciseId: 's', itemIndex: 1, setIndex: 1, reps: 8, completedAt: '2026-10-19T01:14:00.000Z' },
      ],
    });
    expect(workoutTimes(record)).toMatchObject({
      startedAt: record.startedAt,
      endedAt: record.endedAt,
      corrected: false,
    });
    expect(itemActualTimes(record).get(1)).toEqual({
      first: '2026-10-19T01:10:00.000Z',
      last: '2026-10-19T01:14:00.000Z',
      sets: 2,
    });
    const corrected = {
      ...record,
      timeCorrections: [
        {
          startedAt: '2026-10-19T00:50:00.000Z',
          endedAt: '2026-10-19T01:45:00.000Z',
          createdAt: '2026-10-19T02:00:00.000Z',
        },
      ],
    };
    expect(workoutTimes(corrected)).toMatchObject({
      startedAt: '2026-10-19T00:50:00.000Z',
      endedAt: '2026-10-19T01:45:00.000Z',
      corrected: true,
      recorded: { startedAt: record.startedAt },
    });
  });
  it('copy follows the coach language rules in both languages', () => {
    const strings = (value: unknown): string[] =>
      typeof value === 'string'
        ? [value]
        : value && typeof value === 'object'
          ? Object.values(value).flatMap(strings)
          : [];
    for (const text of [...strings(planCalendarCopy), ...strings(dayViewCopy)])
      expect(checkCoachLanguage(text)).toEqual([]);
    expect(Object.keys(planCalendarCopy.en)).toEqual(Object.keys(planCalendarCopy.zh));
    expect(Object.keys(dayViewCopy.en)).toEqual(Object.keys(dayViewCopy.zh));
  });
});

describe('workout time correction', () => {
  it('appends a correction and leaves every recorded fact unchanged', async () => {
    const s = setup(),
      before = structuredClone(s.rows().v8Workouts[0]);
    const startedAt = new Date(Date.parse(before.startedAt) - 30 * 60000).toISOString(),
      endedAt = new Date(Date.parse(before.startedAt) + 20 * 60000).toISOString();
    const next = await s.workflow.correctWorkoutTimes({
      workoutId: before.id,
      startedAt,
      endedAt,
      expectedRevision: s.revision(),
    });
    expect(next.timeCorrections).toHaveLength(1);
    const stored = s.rows().v8Workouts[0];
    const { timeCorrections, ...rest } = stored;
    expect(rest).toEqual(before);
    expect(timeCorrections[0]).toMatchObject({ startedAt, endedAt });
    expect(() => v8WorkoutSchema.parse(stored)).not.toThrow();
    // A second correction is appended, never replacing the first.
    await s.workflow.correctWorkoutTimes({
      workoutId: before.id,
      startedAt,
      endedAt: new Date(Date.parse(endedAt) + 60000).toISOString(),
      expectedRevision: s.revision(),
    });
    expect(s.rows().v8Workouts[0].timeCorrections).toHaveLength(2);
    expect(s.rows().v8Workouts[0].timeCorrections[0]).toEqual(timeCorrections[0]);
  });
  it('rejects reversed, future, over-long and stale corrections without writing', async () => {
    const s = setup(),
      id = s.rows().v8Workouts[0].id,
      base = Date.parse(s.rows().v8Workouts[0].startedAt);
    const iso = (offsetMinutes: number) => new Date(base + offsetMinutes * 60000).toISOString();
    for (const [startedAt, endedAt] of [
      [iso(30), iso(10)],
      [iso(0), new Date(Date.now() + 3600000).toISOString()],
      [iso(0), iso(13 * 60)],
      ['nope', iso(10)],
    ]) {
      const before = structuredClone(s.rows());
      await expect(
        s.workflow.correctWorkoutTimes({ workoutId: id, startedAt, endedAt, expectedRevision: s.revision() }),
      ).rejects.toThrow();
      expect(s.rows()).toEqual(before);
    }
    const before = structuredClone(s.rows());
    await expect(
      s.workflow.correctWorkoutTimes({
        workoutId: id,
        startedAt: iso(0),
        endedAt: iso(10),
        expectedRevision: s.revision() - 1,
      }),
    ).rejects.toThrow();
    expect(s.rows()).toEqual(before);
  });
  it('old records without corrections still parse', () => {
    const s = setup();
    expect(() => v8WorkoutSchema.parse(s.rows().v8Workouts[0])).not.toThrow();
    expect(() =>
      v8WorkoutSchema.parse({
        ...s.rows().v8Workouts[0],
        timeCorrections: [{ startedAt: 'x', endedAt: 'y', createdAt: 'z' }],
      }),
    ).toThrow();
  });
});
