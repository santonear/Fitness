import { describe, expect, it } from 'vitest';
import { EXERCISE_IDS } from '../../src/catalog/exercise-ids';
import { activeBuckets, groupSets, regionShares, shortDate } from '../../src/ui/pages/review/visuals';

describe('V9 review visuals', () => {
  it('counts saved sets per body region, largest first, with shares that sum to one', () => {
    const rows = [
      {
        sets: [
          { exerciseId: EXERCISE_IDS.bodyweightSquat },
          { exerciseId: EXERCISE_IDS.bodyweightSquat },
          { exerciseId: EXERCISE_IDS.plank },
        ],
      },
      { sets: [{ exerciseId: EXERCISE_IDS.bodyweightSquat }, { exerciseId: 'unknown-exercise' }] },
    ];
    const shares = regionShares(rows);
    expect(shares.map(share => [share.region, share.sets])).toEqual([
      ['legs', 3],
      ['core', 1],
    ]);
    expect(shares.reduce((sum, share) => sum + share.share, 0)).toBeCloseTo(1);
    expect(regionShares([])).toEqual([]);
  });
  it('counts buckets with a moved session and formats short dates', () => {
    const point = (sessions: number) => ({
      key: String(sessions),
      from: '',
      to: '',
      sessions,
      volumeKg: 0,
      minutes: 0,
    });
    expect(activeBuckets([point(0), point(2), point(1), point(0)])).toBe(2);
    expect(shortDate('2026-10-19')).toBe('10/19');
  });
  it('groups consecutive sets of one exercise and keeps every set note', () => {
    expect(
      groupSets([
        { exerciseId: 'a', text: '10 次' },
        { exerciseId: 'a', text: '10 次' },
        { exerciseId: 'b', text: '30 秒' },
        { exerciseId: 'b', text: '20 秒', note: '旧组原始备注' },
      ]),
    ).toEqual([
      { exerciseId: 'a', text: '2 × 10 次' },
      { exerciseId: 'b', text: '30 秒 / 20 秒 · 旧组原始备注' },
    ]);
  });
});
