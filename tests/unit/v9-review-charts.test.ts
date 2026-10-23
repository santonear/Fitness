import { describe, expect, it } from 'vitest';
import {
  chartSeries,
  dayBuckets,
  weekBuckets,
  weekStart,
  weekStreak,
  weeklyRemaining,
  volumeKg,
  type ChartWorkout,
} from '../../src/application/review/charts';

const row = (
  id: string,
  startedAt: string,
  status: string,
  minutes: number,
  sets: ChartWorkout['sets'] = [],
): ChartWorkout => ({
  id,
  startedAt,
  endedAt: new Date(Date.parse(startedAt) + minutes * 60000).toISOString(),
  status,
  sets,
});
const tz = 'Asia/Shanghai';

describe('V9 review charts', () => {
  it('buckets moved sessions by local day and ignores abandoned or not started ones', () => {
    const rows = [
      row('a', '2026-10-19T01:00:00Z', 'complete', 30, [
        { reps: 10, loadGrams: 8000 },
        { reps: 8, loadGrams: 8000 },
        { durationSeconds: 30 },
      ]),
      row('b', '2026-10-19T16:30:00Z', 'partial', 12),
      row('c', '2026-10-21T02:00:00Z', 'abandoned', 20),
      row('d', '2026-10-22T02:00:00Z', 'not_started', 0),
      row('a', '2026-10-19T01:00:00Z', 'complete', 30),
    ];
    const series = chartSeries(rows, dayBuckets('2026-10-19'), tz);
    expect(series.map(point => point.sessions)).toEqual([1, 1, 0, 0, 0, 0, 0]);
    expect(series[0]).toMatchObject({ volumeKg: 144, minutes: 30 });
    expect(series[1]).toMatchObject({ volumeKg: 0, minutes: 12 });
  });
  it('builds Monday-based weeks for a month', () => {
    expect(weekStart('2026-10-19')).toBe('2026-10-19');
    expect(weekStart('2026-10-25')).toBe('2026-10-19');
    expect(weekBuckets('2026-10-01', '2026-10-31').map(bucket => bucket.from)).toEqual([
      '2026-09-28',
      '2026-10-05',
      '2026-10-12',
      '2026-10-19',
      '2026-10-26',
    ]);
  });
  it('counts a partial session as done for the weekly target', () => {
    expect(weeklyRemaining(3, 0, 1)).toEqual({ done: 1, left: 2 });
    expect(weeklyRemaining(2, 2, 1)).toEqual({ done: 3, left: 0 });
  });
  it('volume only counts loaded repetitions', () => {
    expect(
      volumeKg(
        row('x', '2026-10-19T01:00:00Z', 'complete', 1, [
          { reps: 5, loadGrams: 2500 },
          { reps: 9, loadGrams: null },
          { reps: 9 },
        ]),
      ),
    ).toBe(12.5);
  });
  it('counts consecutive weeks with any session', () => {
    const rows = [
      row('1', '2026-10-20T01:00:00Z', 'partial', 5),
      row('2', '2026-10-13T01:00:00Z', 'complete', 5),
      row('3', '2026-09-29T01:00:00Z', 'complete', 5),
    ];
    expect(weekStreak(rows, '2026-10-21', tz)).toBe(2);
    expect(weekStreak([], '2026-10-21', tz)).toBe(0);
  });
  it('uses the latest time correction for minutes and day, like the calendar', () => {
    const corrected: ChartWorkout = {
      ...row('c', '2026-10-20T01:00:00Z', 'complete', 90),
      timeCorrections: [
        { startedAt: '2026-10-20T16:30:00Z', endedAt: '2026-10-20T17:00:00Z', createdAt: '2026-10-21T00:00:00Z' },
      ],
    };
    const [tue, wed] = chartSeries([corrected], dayBuckets('2026-10-20').slice(0, 2), tz);
    expect(tue).toMatchObject({ sessions: 0, minutes: 0 });
    expect(wed).toMatchObject({ sessions: 1, minutes: 30 });
  });
});
