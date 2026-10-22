import { it, expect } from 'vitest';
import { deriveActivityEvidence } from '../../src/application/engine-activity-evidence';
import type { WorkoutRecord } from '../../src/domain/v8/contracts';
const record = (id: string, day: string): WorkoutRecord => ({
  id,
  startedAt: day + 'T01:00:00Z',
  endedAt: day + 'T02:00:00Z',
  localDate: day,
  timeZone: 'UTC',
  status: 'complete',
  plannedSetCount: 1,
  sets: [{ exerciseId: 'real-record', itemIndex: 0, setIndex: 0, reps: 8, completedAt: day + 'T01:30:00Z' }],
});
const input = () => ({
  records: [
    '2026-08-17',
    '2026-08-24',
    '2026-08-31',
    '2026-09-07',
    '2026-09-14',
    '2026-09-21',
    '2026-09-28',
    '2026-10-05',
  ].flatMap((day, i) => [record('a' + i, day), record('b' + i, day)]),
  asOfDate: '2026-10-12',
  timeZone: 'UTC',
  weeklyTarget: 2,
});
it('eight weeks of completed records cannot invent missing general symptom-report evidence', () => {
  const value = input(),
    before = structuredClone(value),
    result = deriveActivityEvidence(value);
  expect(result).toEqual({
    consecutiveRegularWeeks: 0,
    noSymptomReportsWeeks: 0,
    missingEvidence: ['general_symptom_report_coverage'],
  });
  expect(value).toEqual(before);
});
it('a single old record, empty weeks and unfinished current week cannot unlock', () => {
  const value = input();
  for (const records of [[], [record('old', '2025-01-01')], [record('current', '2026-10-12')]])
    expect(deriveActivityEvidence({ ...value, records })).toMatchObject({
      consecutiveRegularWeeks: 0,
      noSymptomReportsWeeks: 0,
    });
});
it('explicit discomfort and postpartum reports never become negative evidence', () => {
  const value = input();
  value.records[0].feedback = { reasons: ['discomfort'] };
  value.records[1].postpartumSymptoms = [{ recordedAt: '2026-08-17T02:00:00Z', urgent: ['fever'], regression: [] }];
  expect(deriveActivityEvidence(value).noSymptomReportsWeeks).toBe(0);
});
it('invalid timezone, missing target and duplicate records fail closed', () => {
  const value = input();
  for (const change of [
    { timeZone: 'invalid' },
    { weeklyTarget: 0 },
    { records: [value.records[0], value.records[0]] },
  ])
    expect(deriveActivityEvidence({ ...value, ...change })).toMatchObject({
      consecutiveRegularWeeks: 0,
      noSymptomReportsWeeks: 0,
    });
});
it('derives four and eight source-qualified closed weeks with real negative report events', () => {
  const value = input(),
    events = value.records.filter((_, i) => i % 2 === 0).map(r => ({ answeredAt: r.endedAt!, symptoms: false }));
  expect(deriveActivityEvidence({ ...value, screeningEvents: events })).toEqual({
    consecutiveRegularWeeks: 8,
    noSymptomReportsWeeks: 8,
    missingEvidence: [],
  });
  expect(
    deriveActivityEvidence({ ...value, records: value.records.slice(-8), screeningEvents: events.slice(-4) }),
  ).toMatchObject({ consecutiveRegularWeeks: 4, noSymptomReportsWeeks: 4 });
});
it('one unqualified week is not counted; two adjacent ones reset, while report positives break symptom streak', () => {
  const value = input(),
    events = value.records.filter((_, i) => i % 2 === 0).map(r => ({ answeredAt: r.endedAt!, symptoms: false }));
  const withoutLatest = events.slice(0, -1);
  expect(deriveActivityEvidence({ ...value, screeningEvents: withoutLatest })).toMatchObject({
    consecutiveRegularWeeks: 7,
    noSymptomReportsWeeks: 0,
  });
  expect(deriveActivityEvidence({ ...value, screeningEvents: events.slice(0, -2) }).consecutiveRegularWeeks).toBe(0);
  expect(
    deriveActivityEvidence({
      ...value,
      screeningEvents: [...events, { answeredAt: events.at(-1)!.answeredAt, symptoms: true }],
    }).noSymptomReportsWeeks,
  ).toBe(0);
});
it('requires real set completion as well as session counts and weekly target rate', () => {
  const value = input(),
    events = value.records.filter((_, i) => i % 2 === 0).map(r => ({ answeredAt: r.endedAt!, symptoms: false }));
  for (const r of value.records.slice(-4)) r.plannedSetCount = 10;
  expect(deriveActivityEvidence({ ...value, screeningEvents: events }).consecutiveRegularWeeks).toBe(0);
  expect(deriveActivityEvidence({ ...input(), weeklyTarget: 3, screeningEvents: events }).consecutiveRegularWeeks).toBe(
    0,
  );
});
it('assigns boundary instants by caller timezone and ignores unfinished local week', () => {
  const records = [record('one', '2026-10-11'), record('two', '2026-10-11')];
  records.forEach(r => (r.endedAt = '2026-10-11T23:30:00Z'));
  const value = {
    records,
    asOfDate: '2026-10-12',
    timeZone: 'UTC',
    weeklyTarget: 2,
    screeningEvents: [{ answeredAt: '2026-10-11T23:45:00Z', symptoms: false }],
  };
  expect(deriveActivityEvidence(value).consecutiveRegularWeeks).toBe(1);
  expect(deriveActivityEvidence({ ...value, timeZone: 'Asia/Shanghai' }).consecutiveRegularWeeks).toBe(0);
});
